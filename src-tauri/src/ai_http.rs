use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use base64::Engine;
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method};
use tauri::ipc::Channel;
use tauri::State;

#[derive(Debug, Default)]
pub struct AiHttpCancelRegistry(Mutex<HashMap<String, Arc<AtomicBool>>>);

impl AiHttpCancelRegistry {
  pub fn register(&self, request_id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut map) = self.0.lock() {
      map.insert(request_id.to_string(), flag.clone());
    }
    flag
  }

  pub fn cancel(&self, request_id: &str) {
    if let Ok(map) = self.0.lock() {
      if let Some(flag) = map.get(request_id) {
        flag.store(true, Ordering::Relaxed);
      }
    }
  }

  pub fn remove(&self, request_id: &str) {
    if let Ok(mut map) = self.0.lock() {
      map.remove(request_id);
    }
  }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHttpRequestPayload {
  pub url: String,
  pub method: Option<String>,
  pub headers: Option<HashMap<String, String>>,
  pub body: Option<String>,
  pub timeout_ms: Option<u64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHttpResponsePayload {
  pub status: u16,
  pub body: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum AiHttpStreamEvent {
  Meta { status: u16 },
  Chunk { bytes: String },
  Done,
  Error { message: String },
}

fn validate_ai_http_url(url: &str) -> Result<(), String> {
  let trimmed = url.trim();
  if trimmed.is_empty() {
    return Err("URL is empty".to_string());
  }
  let parsed = reqwest::Url::parse(trimmed).map_err(|error| format!("Invalid URL: {error}"))?;
  match parsed.scheme() {
    "http" | "https" => {}
    scheme => return Err(format!("Unsupported URL scheme: {scheme}")),
  }
  if parsed.host().is_none() {
    return Err("URL must include a host".to_string());
  }
  Ok(())
}

fn map_reqwest_error(error: reqwest::Error) -> String {
  if error.is_timeout() {
    return "timeout".to_string();
  }
  error.to_string()
}

fn build_client(timeout_ms: Option<u64>) -> Result<Client, String> {
  let timeout = Duration::from_millis(timeout_ms.unwrap_or(15_000).clamp(1_000, 300_000));
  Client::builder()
    .timeout(timeout)
    .redirect(reqwest::redirect::Policy::limited(8))
    .build()
    .map_err(|error| error.to_string())
}

fn build_header_map(headers: &Option<HashMap<String, String>>) -> Result<HeaderMap, String> {
  let mut header_map = HeaderMap::new();
  let Some(headers) = headers else {
    return Ok(header_map);
  };
  for (name, value) in headers {
    let name = name.trim();
    if name.is_empty() {
      continue;
    }
    let header_name = HeaderName::from_bytes(name.as_bytes())
      .map_err(|_| format!("Invalid header name: {name}"))?;
    let header_value = HeaderValue::from_str(value)
      .map_err(|_| format!("Invalid header value for {name}"))?;
    header_map.insert(header_name, header_value);
  }
  Ok(header_map)
}

fn build_request(client: &Client, payload: &AiHttpRequestPayload) -> Result<reqwest::RequestBuilder, String> {
  validate_ai_http_url(&payload.url)?;
  let method = payload
    .method
    .as_deref()
    .unwrap_or("GET")
    .trim()
    .to_ascii_uppercase();
  let method = Method::from_bytes(method.as_bytes()).map_err(|error| error.to_string())?;
  let mut request = client
    .request(method, payload.url.trim())
    .headers(build_header_map(&payload.headers)?);
  if let Some(body) = payload.body.as_ref() {
    if !body.is_empty() {
      request = request.body(body.clone());
    }
  }
  Ok(request)
}

#[tauri::command]
pub async fn ai_http_request(payload: AiHttpRequestPayload) -> Result<AiHttpResponsePayload, String> {
  let client = build_client(payload.timeout_ms)?;
  let response = build_request(&client, &payload)?
    .send()
    .await
    .map_err(map_reqwest_error)?;
  let status = response.status().as_u16();
  let body = response.text().await.map_err(map_reqwest_error)?;
  Ok(AiHttpResponsePayload { status, body })
}

#[tauri::command]
pub async fn ai_http_stream(
  payload: AiHttpRequestPayload,
  request_id: String,
  on_event: Channel<AiHttpStreamEvent>,
  cancel_registry: State<'_, AiHttpCancelRegistry>,
) -> Result<(), String> {
  let cancel = cancel_registry.register(&request_id);
  let client = build_client(payload.timeout_ms)?;
  let response = match build_request(&client, &payload)?.send().await {
    Ok(response) => response,
    Err(error) => {
      cancel_registry.remove(&request_id);
      let message = map_reqwest_error(error);
      let _ = on_event.send(AiHttpStreamEvent::Error { message: message.clone() });
      return Err(message);
    }
  };

  let status = response.status().as_u16();
  if on_event
    .send(AiHttpStreamEvent::Meta { status })
    .is_err()
  {
    cancel_registry.remove(&request_id);
    return Ok(());
  }

  let mut stream = response.bytes_stream();
  while let Some(next) = stream.next().await {
    if cancel.load(Ordering::Relaxed) {
      break;
    }
    let chunk = match next {
      Ok(chunk) => chunk,
      Err(error) => {
        let message = map_reqwest_error(error);
        let _ = on_event.send(AiHttpStreamEvent::Error { message: message.clone() });
        cancel_registry.remove(&request_id);
        return Err(message);
      }
    };
    if chunk.is_empty() {
      continue;
    }
    let encoded = base64::engine::general_purpose::STANDARD.encode(chunk);
    if on_event
      .send(AiHttpStreamEvent::Chunk { bytes: encoded })
      .is_err()
    {
      break;
    }
  }

  cancel_registry.remove(&request_id);
  let _ = on_event.send(AiHttpStreamEvent::Done);
  Ok(())
}

#[tauri::command]
pub fn ai_http_stream_cancel(
  request_id: String,
  cancel_registry: State<'_, AiHttpCancelRegistry>,
) {
  cancel_registry.cancel(&request_id);
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn validate_ai_http_url_accepts_http_and_https() {
    validate_ai_http_url("http://192.168.1.1:11434/v1").expect("lan http");
    validate_ai_http_url("https://api.openai.com/v1").expect("https");
  }

  #[test]
  fn validate_ai_http_url_rejects_unsupported_schemes() {
    assert!(validate_ai_http_url("file:///etc/passwd").is_err());
    assert!(validate_ai_http_url("javascript:alert(1)").is_err());
  }
}
