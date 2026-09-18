use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

pub const PARALLEL_IO_THRESHOLD: usize = 32;
const MAX_PARALLEL_IO_WORKERS: usize = 8;
const PROGRESS_INTERVAL: usize = 10;

pub type ParallelProgressCallback = Option<Arc<dyn Fn(usize, usize) + Send + Sync>>;

pub fn parallel_io_worker_count(item_count: usize) -> usize {
  if item_count == 0 {
    return 1;
  }
  std::thread::available_parallelism()
    .map(|count| count.get())
    .unwrap_or(4)
    .clamp(2, MAX_PARALLEL_IO_WORKERS)
    .min(item_count)
}

fn report_progress(progress: &ParallelProgressCallback, processed: usize, total: usize) {
  if processed == 0 || processed == total || processed % PROGRESS_INTERVAL == 0 {
    if let Some(report) = progress {
      report(processed, total);
    }
  }
}

pub const WORKSPACE_MIGRATION_CANCELLED: &str = "WORKSPACE_MIGRATION_CANCELLED";
pub const WORKSPACE_INDEX_CANCELLED: &str = "WORKSPACE_INDEX_CANCELLED";

fn is_cancelled(cancel: &Option<Arc<AtomicBool>>) -> bool {
  cancel.as_ref().is_some_and(|token| token.load(Ordering::Acquire))
}

pub fn parallel_for_each_paths(
  paths: &[PathBuf],
  progress: ParallelProgressCallback,
  cancel: Option<Arc<AtomicBool>>,
  op: Arc<dyn Fn(&Path) -> Result<(), String> + Send + Sync>,
) -> Result<(), String> {
  let total = paths.len();
  if total == 0 {
    return Ok(());
  }

  if is_cancelled(&cancel) {
    return Err(WORKSPACE_MIGRATION_CANCELLED.to_string());
  }

  if total < PARALLEL_IO_THRESHOLD {
    for (index, path) in paths.iter().enumerate() {
      if is_cancelled(&cancel) {
        return Err(WORKSPACE_MIGRATION_CANCELLED.to_string());
      }
      op(path)?;
      report_progress(&progress, index + 1, total);
    }
    return Ok(());
  }

  let processed = Arc::new(AtomicUsize::new(0));
  let failed = Arc::new(Mutex::new(None::<String>));
  let workers = parallel_io_worker_count(total);
  let chunk_size = total.div_ceil(workers);

  std::thread::scope(|scope| {
    for chunk in paths.chunks(chunk_size) {
      let chunk = chunk.to_vec();
      let failed = Arc::clone(&failed);
      let progress = progress.clone();
      let op = Arc::clone(&op);
      let processed = Arc::clone(&processed);
      let cancel = cancel.clone();
      scope.spawn(move || {
        for path in &chunk {
          if is_cancelled(&cancel) {
            if let Ok(mut guard) = failed.lock() {
              if guard.is_none() {
                *guard = Some(WORKSPACE_MIGRATION_CANCELLED.to_string());
              }
            }
            return;
          }
          if failed.lock().ok().and_then(|guard| guard.clone()).is_some() {
            return;
          }
          match op(path) {
            Ok(()) => {
              let done = processed.fetch_add(1, Ordering::Relaxed) + 1;
              report_progress(&progress, done, total);
            }
            Err(err) => {
              if let Ok(mut guard) = failed.lock() {
                if guard.is_none() {
                  *guard = Some(err);
                }
              }
            }
          }
        }
      });
    }
  });

  if let Some(err) = failed.lock().ok().and_then(|guard| guard.clone()) {
    return Err(err);
  }
  Ok(())
}

pub fn parallel_filter_map_strings_with_progress<T>(
  items: &[String],
  progress: ParallelProgressCallback,
  cancel: Option<Arc<AtomicBool>>,
  op: Arc<dyn Fn(&str) -> Option<T> + Send + Sync>,
) -> Result<(Vec<T>, usize), String>
where
  T: Send,
{
  if items.is_empty() {
    return Ok((Vec::new(), 0));
  }

  if is_cancelled(&cancel) {
    return Err(WORKSPACE_INDEX_CANCELLED.to_string());
  }

  let total = items.len();
  if total < PARALLEL_IO_THRESHOLD {
    let mut results = Vec::new();
    let mut skipped = 0usize;
    for (index, item) in items.iter().enumerate() {
      if is_cancelled(&cancel) {
        return Err(WORKSPACE_INDEX_CANCELLED.to_string());
      }
      match op(item) {
        Some(value) => results.push(value),
        None => skipped += 1,
      }
      report_progress(&progress, index + 1, total);
    }
    return Ok((results, skipped));
  }

  let results = Arc::new(Mutex::new(Vec::new()));
  let skipped = Arc::new(AtomicUsize::new(0));
  let processed = Arc::new(AtomicUsize::new(0));
  let failed = Arc::new(Mutex::new(None::<String>));
  let workers = parallel_io_worker_count(items.len());
  let chunk_size = items.len().div_ceil(workers);

  std::thread::scope(|scope| {
    for chunk in items.chunks(chunk_size) {
      let chunk: Vec<String> = chunk.to_vec();
      let results = Arc::clone(&results);
      let op = Arc::clone(&op);
      let skipped = Arc::clone(&skipped);
      let progress = progress.clone();
      let processed = Arc::clone(&processed);
      let cancel = cancel.clone();
      let failed = Arc::clone(&failed);
      scope.spawn(move || {
        let mut local = Vec::new();
        let mut local_skipped = 0usize;
        for item in &chunk {
          if is_cancelled(&cancel) {
            if let Ok(mut guard) = failed.lock() {
              if guard.is_none() {
                *guard = Some(WORKSPACE_INDEX_CANCELLED.to_string());
              }
            }
            return;
          }
          if failed.lock().ok().and_then(|guard| guard.clone()).is_some() {
            return;
          }
          match op(item) {
            Some(value) => local.push(value),
            None => local_skipped += 1,
          }
          let done = processed.fetch_add(1, Ordering::Relaxed) + 1;
          report_progress(&progress, done, total);
        }
        if !local.is_empty() {
          if let Ok(mut guard) = results.lock() {
            guard.extend(local);
          }
        }
        skipped.fetch_add(local_skipped, Ordering::Relaxed);
      });
    }
  });

  if let Some(err) = failed.lock().ok().and_then(|guard| guard.clone()) {
    return Err(err);
  }

  Ok((
    results
      .lock()
      .map(|mut guard| std::mem::take(&mut *guard))
      .unwrap_or_default(),
    skipped.load(Ordering::Relaxed),
  ))
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::atomic::{AtomicUsize, Ordering as AtomicOrdering};

  #[test]
  fn parallel_filter_map_strings_preserves_all_matches() {
    let items: Vec<String> = (0..80).map(|index| index.to_string()).collect();
    let (values, skipped) = parallel_filter_map_strings_with_progress(&items, None, None, Arc::new(|item: &str| {
      let parsed = item.parse::<u32>().ok()?;
      if parsed % 2 == 0 {
        Some(parsed)
      } else {
        None
      }
    }))
    .expect("filter map");
    assert_eq!(skipped, 40);
    assert_eq!(values.len(), 40);
    assert!(values.contains(&0));
    assert!(values.contains(&78));
  }

  #[test]
  fn parallel_for_each_paths_runs_all_items() {
    let paths: Vec<PathBuf> = (0..48).map(|index| PathBuf::from(format!("/tmp/item-{index}"))).collect();
    let seen = Arc::new(AtomicUsize::new(0));
    let seen_for_op = Arc::clone(&seen);
    parallel_for_each_paths(&paths, None, None, Arc::new(move |_path| {
      seen_for_op.fetch_add(1, AtomicOrdering::Relaxed);
      Ok(())
    }))
    .expect("parallel for each");
    assert_eq!(seen.load(AtomicOrdering::Relaxed), 48);
  }

  #[test]
  fn parallel_for_each_paths_honours_cancel_token() {
    let paths: Vec<PathBuf> = (0..48).map(|index| PathBuf::from(format!("/tmp/item-{index}"))).collect();
    let cancel = Arc::new(AtomicBool::new(true));
    let err = parallel_for_each_paths(&paths, None, Some(cancel), Arc::new(|_path| Ok(())))
      .expect_err("cancelled migration must fail");
    assert!(err.contains(WORKSPACE_MIGRATION_CANCELLED));
  }

  #[test]
  fn parallel_filter_map_strings_honours_cancel_token() {
    let items: Vec<String> = (0..80).map(|index| index.to_string()).collect();
    let cancel = Arc::new(AtomicBool::new(true));
    let err = parallel_filter_map_strings_with_progress(
      &items,
      None,
      Some(cancel),
      Arc::new(|item: &str| item.parse::<u32>().ok()),
    )
    .expect_err("cancelled index read must fail");
    assert!(err.contains(WORKSPACE_INDEX_CANCELLED));
  }
}
