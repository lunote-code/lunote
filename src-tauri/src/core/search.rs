use std::path::Path;

use rusqlite::{params, Connection};

#[derive(serde::Serialize)]
pub struct SearchResult {
  pub path: String,
  pub title: String,
  pub snippet: String,
}

pub fn init_schema(conn: &Connection) -> Result<(), String> {
  conn
    .execute_batch(
      r#"
      CREATE VIRTUAL TABLE IF NOT EXISTS note_index USING fts5(
        path UNINDEXED,
        title,
        body
      );
      "#,
    )
    .map_err(|e| format!("Failed to initialize search index: {e}"))
}

/// Convert user input into FTS5 literal queries to avoid syntax characters being used as operators.
pub fn escape_fts5_query(raw: &str) -> String {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return String::new();
  }
  trimmed
    .split_whitespace()
    .map(fts_token_query)
    .collect::<Vec<_>>()
    .join(" ")
}

fn fts_token_query(token: &str) -> String {
  let escaped = token.replace('"', "\"\"");
  if token.chars().any(is_cjk_ideograph) {
    format!("(\"{escaped}\") OR (\"{escaped}\"*)")
  } else {
    format!("\"{escaped}\"")
  }
}

fn is_cjk_ideograph(ch: char) -> bool {
  matches!(
    ch as u32,
    0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0xF900..=0xFAFF
  )
}

fn strip_frontmatter(content: &str) -> &str {
  let bytes = content.as_bytes();
  if bytes.len() < 4 || &bytes[0..3] != b"---" {
    return content;
  }
  let mut idx = 3usize;
  if bytes.get(idx) == Some(&b'\r') {
    idx += 1;
  }
  if bytes.get(idx) != Some(&b'\n') {
    return content;
  }
  idx += 1;
  let rest = &content[idx..];
  if let Some(close) = rest
    .find("\n---\n")
    .or_else(|| rest.find("\n---\r\n"))
    .or_else(|| rest.find("\n---"))
  {
    return &rest[close + 1..].trim_start_matches(['\r', '\n']);
  }
  content
}

fn parse_frontmatter_title(content: &str) -> Option<String> {
  let bytes = content.as_bytes();
  if bytes.len() < 4 || &bytes[0..3] != b"---" {
    return None;
  }
  let mut idx = 3usize;
  if bytes.get(idx) == Some(&b'\r') {
    idx += 1;
  }
  if bytes.get(idx) != Some(&b'\n') {
    return None;
  }
  idx += 1;
  let rest = &content[idx..];
  let close = rest
    .find("\n---\n")
    .or_else(|| rest.find("\n---\r\n"))
    .or_else(|| rest.find("\n---"))?;
  let frontmatter = &rest[..close];
  for line in frontmatter.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
      continue;
    }
    if let Some(raw) = trimmed.strip_prefix("title:") {
      let value = raw.trim().trim_matches(['"', '\'']);
      if !value.is_empty() {
        return Some(value.to_string());
      }
    }
  }
  None
}

fn parse_first_markdown_heading(content: &str) -> Option<String> {
  for line in strip_frontmatter(content).lines() {
    let trimmed = line.trim();
    if !trimmed.starts_with('#') {
      continue;
    }
    let mut chars = trimmed.chars();
    let hash_count = chars.by_ref().take_while(|c| *c == '#').count();
    if hash_count == 0 || hash_count > 6 {
      continue;
    }
    let text = chars.collect::<String>().trim().to_string();
    if !text.is_empty() {
      return Some(text);
    }
  }
  None
}

/// Resolve the human-facing title stored in the FTS `title` column.
pub fn note_index_title(content: &str, file_name: &str) -> String {
  if let Some(title) = parse_frontmatter_title(content) {
    return title;
  }
  if let Some(heading) = parse_first_markdown_heading(content) {
    return heading;
  }
  Path::new(file_name)
    .file_stem()
    .and_then(|stem| stem.to_str())
    .filter(|stem| !stem.is_empty())
    .unwrap_or("untitled")
    .to_string()
}

pub fn rebuild_index(
  conn: &Connection,
  notes: &[(String, String, String)],
) -> Result<usize, String> {
  let tx = conn
    .unchecked_transaction()
    .map_err(|e| format!("Failed to create transaction: {e}"))?;
  {
    tx.execute("DELETE FROM note_index", [])
      .map_err(|e| format!("Failed to clear index: {e}"))?;
    let mut stmt = tx
      .prepare("INSERT INTO note_index(path, title, body) VALUES (?1, ?2, ?3)")
      .map_err(|e| format!("Failed to prepare to write to index: {e}"))?;
    for (path, title, body) in notes {
      stmt
        .execute(params![path, title, body])
        .map_err(|e| format!("Failed to write to index: {e}"))?;
    }
  }
  tx.commit().map_err(|e| format!("Failed to submit index: {e}"))?;
  Ok(notes.len())
}

pub fn clear_index(conn: &Connection) -> Result<(), String> {
  conn
    .execute("DELETE FROM note_index", [])
    .map_err(|e| format!("Failed to clear index: {e}"))?;
  Ok(())
}

pub fn apply_index_delta(
  conn: &Connection,
  upserts: &[(String, String, String)],
  removed: &[String],
) -> Result<usize, String> {
  let tx = conn
    .unchecked_transaction()
    .map_err(|e| format!("Failed to create transaction: {e}"))?;
  for path in removed {
    tx.execute("DELETE FROM note_index WHERE path = ?1", params![path])
      .map_err(|e| format!("Failed to delete expired index: {e}"))?;
  }
  for (path, title, body) in upserts {
    tx.execute("DELETE FROM note_index WHERE path = ?1", params![path])
      .map_err(|e| format!("Failed to update index: {e}"))?;
    tx.execute(
      "INSERT INTO note_index(path, title, body) VALUES (?1, ?2, ?3)",
      params![path, title, body],
    )
    .map_err(|e| format!("Failed to write to index: {e}"))?;
  }
  tx.commit().map_err(|e| format!("Failed to submit index: {e}"))?;
  Ok(upserts.len())
}

pub fn query(conn: &Connection, q: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
  let fts_query = escape_fts5_query(q);
  if fts_query.is_empty() {
    return Ok(Vec::new());
  }
  let mut stmt = conn
    .prepare(
      "SELECT path, title, snippet(note_index, 2, '<mark>', '</mark>', '…', 18)
       FROM note_index
       WHERE note_index MATCH ?1
       LIMIT ?2",
    )
    .map_err(|e| format!("Preparing query failed: {e}"))?;

  let rows = stmt
    .query_map(params![fts_query, limit as i64], |row| {
      Ok(SearchResult {
        path: row.get(0)?,
        title: row.get(1)?,
        snippet: row.get(2)?,
      })
    })
    .map_err(|e| format!("Failed to execute query: {e}"))?;

  let mut results = Vec::new();
  for row in rows {
    results.push(row.map_err(|e| format!("Failed to read result: {e}"))?);
  }
  Ok(results)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn note_index_title_prefers_frontmatter_then_heading() {
    let with_frontmatter = "---\ntitle: 推广网站\n---\n\n## Other\n";
    assert_eq!(note_index_title(with_frontmatter, "note.md"), "推广网站");

    let with_heading = "# Title\n\n## 推广网站\n\nBody\n";
    assert_eq!(note_index_title(with_heading, "sites.md"), "Title");

    let h2_only = "## 推广网站\n\nBody\n";
    assert_eq!(note_index_title(h2_only, "sites.md"), "推广网站");
  }

  #[test]
  fn escape_fts5_query_adds_prefix_wildcard_for_cjk() {
    let q = escape_fts5_query("推广");
    assert!(q.contains("\"推广\""));
    assert!(q.contains("\"推广\"*"));
  }

  #[test]
  fn query_finds_cjk_heading_in_body() {
    let conn = Connection::open_in_memory().expect("memory db");
    init_schema(&conn).expect("schema");
    let content = "## 推广网站\n\n- https://example.com\n";
    let title = note_index_title(&content, "promo-sites.md");
    rebuild_index(
      &conn,
      &[(
        "/vault/promo-sites.md".to_string(),
        title,
        content.to_string(),
      )],
    )
    .expect("rebuild");
    let hits = query(&conn, "推广", 10).expect("query");
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].title, "推广网站");
  }

  #[test]
  fn clear_index_drops_plaintext_bodies() {
    let conn = Connection::open_in_memory().expect("memory db");
    init_schema(&conn).expect("schema");
    rebuild_index(
      &conn,
      &[(
        "/vault/secret.md".to_string(),
        "Secret".to_string(),
        "classified body".to_string(),
      )],
    )
    .expect("rebuild");
    assert_eq!(query(&conn, "classified", 10).expect("query").len(), 1);
    clear_index(&conn).expect("clear");
    assert!(query(&conn, "classified", 10).expect("query after clear").is_empty());
  }
}
