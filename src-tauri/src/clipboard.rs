use arboard::{Clipboard, ImageData};
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{ImageBuffer, ImageFormat, Rgba};
use serde::Serialize;
use std::path::Path;

use crate::core::security;

#[derive(Serialize)]
pub struct ClipboardImageDto {
  pub mime_type: String,
  pub data_base64: String,
}

#[derive(Serialize)]
pub struct ClipboardImageReadResult {
  pub image: Option<ClipboardImageDto>,
  pub issue: Option<String>,
}

const IMAGE_EXTS: &[&str] = &[
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "tif", "heic", "heif",
];

pub fn read_text() -> Option<String> {
  let mut cb = Clipboard::new().ok()?;
  let text = cb.get_text().ok()?;
  if text.is_empty() {
    return None;
  }
  if should_suppress_filename_text(&mut cb, text.trim()) {
    return None;
  }
  Some(text)
}

enum FileListImageOutcome {
  Image(ClipboardImageDto),
  HeicUnsupported,
  Missing,
}

pub fn read_image() -> ClipboardImageReadResult {
  //When Finder copies files, the raster on the pasteboard is often the system "JPG file icon", not the original image pixels.
  match read_image_from_file_list() {
    FileListImageOutcome::Image(dto) => ClipboardImageReadResult {
      image: Some(dto),
      issue: None,
    },
    FileListImageOutcome::HeicUnsupported => ClipboardImageReadResult {
      image: None,
      issue: Some("heic_unsupported".to_string()),
    },
    FileListImageOutcome::Missing => match read_raster_image() {
      Some(dto) => ClipboardImageReadResult {
        image: Some(dto),
        issue: None,
      },
      None => ClipboardImageReadResult {
        image: None,
        issue: None,
      },
    },
  }
}

fn read_raster_image() -> Option<ClipboardImageDto> {
  let mut cb = Clipboard::new().ok()?;
  let img = cb.get_image().ok()?;
  let png = rgba_to_png(&img)?;
  Some(encode_dto(png, "image/png"))
}

fn read_image_from_file_list() -> FileListImageOutcome {
  let mut cb = match Clipboard::new() {
    Ok(cb) => cb,
    Err(_) => return FileListImageOutcome::Missing,
  };
  let paths = match cb.get().file_list() {
    Ok(paths) => paths,
    Err(_) => return FileListImageOutcome::Missing,
  };
  for path in paths {
    if !is_image_path(&path) {
      continue;
    }
    if let Some(dto) = encode_image_file(&path) {
      return FileListImageOutcome::Image(dto);
    }
    if is_heic_path(&path) {
      return FileListImageOutcome::HeicUnsupported;
    }
  }
  FileListImageOutcome::Missing
}

fn is_heic_path(path: &Path) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .is_some_and(|ext| ext.eq_ignore_ascii_case("heic") || ext.eq_ignore_ascii_case("heif"))
}

fn should_suppress_filename_text(cb: &mut Clipboard, text: &str) -> bool {
  let Ok(paths) = cb.get().file_list() else {
    return false;
  };
  if !paths.iter().any(|path| is_image_path(path)) {
    return false;
  }
  paths.iter().any(|path| text_matches_image_path(text, path))
}

fn text_matches_image_path(text: &str, path: &Path) -> bool {
  if text == path.to_string_lossy() {
    return true;
  }
  path
    .file_name()
    .and_then(|name| name.to_str())
    .is_some_and(|name| text == name)
}

fn is_image_path(path: &Path) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(|ext| {
      IMAGE_EXTS
        .iter()
        .any(|candidate| ext.eq_ignore_ascii_case(candidate))
    })
    .unwrap_or(false)
}

fn encode_image_file(path: &Path) -> Option<ClipboardImageDto> {
  let meta = std::fs::metadata(path).ok()?;
  security::ensure_clipboard_image_file_size(meta.len()).ok()?;
  let bytes = std::fs::read(path).ok()?;
  security::ensure_binary_payload_size(&bytes, "clipboard image").ok()?;
  if bytes.len() < 16 {
    return None;
  }
  //Preserve original JPEG/PNG and other formats to avoid unnecessary transcoding
  if let Some(mime) = mime_for_image_bytes(&bytes) {
    return Some(encode_dto(bytes, mime));
  }
  encode_image_bytes(&bytes)
}

fn mime_for_image_bytes(bytes: &[u8]) -> Option<&'static str> {
  if bytes.len() >= 8
    && bytes[0] == 0x89
    && bytes[1] == 0x50
    && bytes[2] == 0x4e
    && bytes[3] == 0x47
  {
    return Some("image/png");
  }
  if bytes.len() >= 2 && bytes[0] == 0xff && bytes[1] == 0xd8 {
    return Some("image/jpeg");
  }
  if bytes.len() >= 6 && (&bytes[0..6] == b"GIF87a" || &bytes[0..6] == b"GIF89a") {
    return Some("image/gif");
  }
  None
}

fn encode_image_bytes(bytes: &[u8]) -> Option<ClipboardImageDto> {
  security::ensure_binary_payload_size(bytes, "clipboard image").ok()?;
  let img = image::load_from_memory(bytes).ok()?;
  let (width, height) = (img.width(), img.height());
  security::ensure_clipboard_raster_dimensions(width, height).ok()?;
  let mut out = Vec::new();
  img
    .write_to(&mut std::io::Cursor::new(&mut out), ImageFormat::Png)
    .ok()?;
  security::ensure_binary_payload_size(&out, "clipboard image").ok()?;
  Some(encode_dto(out, "image/png"))
}

fn encode_dto(bytes: Vec<u8>, mime_type: &str) -> ClipboardImageDto {
  ClipboardImageDto {
    mime_type: mime_type.to_string(),
    data_base64: STANDARD.encode(bytes),
  }
}

fn rgba_to_png(img: &ImageData) -> Option<Vec<u8>> {
  let width: u32 = img.width.try_into().ok()?;
  let height: u32 = img.height.try_into().ok()?;
  security::ensure_clipboard_raster_dimensions(width, height).ok()?;
  let expected = width as usize * height as usize * 4;
  if img.bytes.len() < expected {
    return None;
  }
  let buffer: ImageBuffer<Rgba<u8>, Vec<u8>> =
    ImageBuffer::from_raw(width, height, img.bytes[..expected].to_vec())?;
  let mut out = Vec::new();
  let mut cursor = std::io::Cursor::new(&mut out);
  buffer.write_to(&mut cursor, ImageFormat::Png).ok()?;
  security::ensure_binary_payload_size(&out, "clipboard image").ok()?;
  Some(out)
}

#[tauri::command]
pub fn read_clipboard_text() -> Option<String> {
  read_text()
}

#[tauri::command]
pub fn read_clipboard_image() -> ClipboardImageReadResult {
  read_image()
}

#[cfg(test)]
mod tests {
  use super::{is_heic_path, is_image_path};
  use std::path::Path;

  #[test]
  fn is_heic_path_matches_common_extensions() {
    assert!(is_heic_path(Path::new("/tmp/photo.heic")));
    assert!(is_heic_path(Path::new("/tmp/photo.HEIF")));
    assert!(!is_heic_path(Path::new("/tmp/photo.jpg")));
  }

  #[test]
  fn is_image_path_includes_heic() {
    assert!(is_image_path(Path::new("/tmp/photo.heic")));
  }
}
