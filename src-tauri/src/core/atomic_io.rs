use std::io::Write;
use std::path::Path;

/// Rename the temporary file after writing it to avoid half-write damage caused by crash.
pub fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
  let parent = path
    .parent()
    .ok_or_else(|| "Invalid destination path".to_string())?;
  std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
  let tmp_name = format!(
    ".luna-write-{}-{}.tmp",
    std::process::id(),
    std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map(|d| d.as_nanos())
      .unwrap_or(0)
  );
  let tmp_path = parent.join(tmp_name);
  {
    let mut file =
      std::fs::File::create(&tmp_path).map_err(|e| format!("Failed to create temporary file: {e}"))?;
    file.write_all(content)
      .map_err(|e| format!("Failed to write to temporary file: {e}"))?;
    file.sync_all()
      .map_err(|e| format!("Failed to synchronize temporary files: {e}"))?;
  }
  commit_atomic_file(&tmp_path, path)
}

fn commit_atomic_file(tmp_path: &Path, dest_path: &Path) -> Result<(), String> {
  #[cfg(windows)]
  {
    return commit_atomic_file_windows(tmp_path, dest_path);
  }
  #[cfg(not(windows))]
  {
    std::fs::rename(tmp_path, dest_path).map_err(|e| {
      let _ = std::fs::remove_file(tmp_path);
      format!("Failed to submit file: {e}")
    })
  }
}

#[cfg(windows)]
fn commit_atomic_file_windows(tmp_path: &Path, dest_path: &Path) -> Result<(), String> {
  use std::os::windows::ffi::OsStrExt;
  use windows_sys::Win32::Foundation::GetLastError;
  use windows_sys::Win32::Storage::FileSystem::{
    MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
  };

  let tmp_wide: Vec<u16> = tmp_path
    .as_os_str()
    .encode_wide()
    .chain(std::iter::once(0))
    .collect();
  let dest_wide: Vec<u16> = dest_path
    .as_os_str()
    .encode_wide()
    .chain(std::iter::once(0))
    .collect();

  let ok = unsafe {
    MoveFileExW(
      tmp_wide.as_ptr(),
      dest_wide.as_ptr(),
      MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
    )
  };
  if ok == 0 {
    let err = unsafe { GetLastError() };
    let _ = std::fs::remove_file(tmp_path);
    return Err(format!("Failed to submit file: Win32 error {err}"));
  }
  Ok(())
}
