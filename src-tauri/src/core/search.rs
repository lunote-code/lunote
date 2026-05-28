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
    .map(|token| {
      let escaped = token.replace('"', "\"\"");
      format!("\"{escaped}\"")
    })
    .collect::<Vec<_>>()
    .join(" ")
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
