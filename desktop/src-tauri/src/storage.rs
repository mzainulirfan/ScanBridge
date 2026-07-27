use serde::{de::DeserializeOwned, Serialize};
use std::{
    fs::{self, File},
    io::{self, Write},
    path::{Path, PathBuf},
};
use uuid::Uuid;

pub fn read_json_or_default<T>(path: impl AsRef<Path>) -> T
where
    T: DeserializeOwned + Default,
{
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn write_json_atomic<T>(path: impl AsRef<Path>, value: &T) -> io::Result<()>
where
    T: Serialize,
{
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let temp_path = temporary_path(path);
    let bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let mut temp_file = File::create(&temp_path)?;
    temp_file.write_all(&bytes)?;
    temp_file.sync_all()?;

    if path.exists() {
        let backup_path = path.with_extension("backup");
        let _ = fs::remove_file(&backup_path);
        fs::rename(path, &backup_path)?;
        if let Err(error) = fs::rename(&temp_path, path) {
            let _ = fs::rename(&backup_path, path);
            let _ = fs::remove_file(&temp_path);
            return Err(error);
        }
        let _ = fs::remove_file(backup_path);
    } else {
        fs::rename(temp_path, path)?;
    }

    Ok(())
}

fn temporary_path(path: &Path) -> PathBuf {
    let extension = format!("tmp-{}", Uuid::new_v4());
    path.with_extension(extension)
}

