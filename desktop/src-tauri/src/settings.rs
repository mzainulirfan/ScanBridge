use crate::config::AppConfig;
use std::{fs, io, path::Path};

pub fn load_settings(path: impl AsRef<Path>) -> io::Result<AppConfig> {
    let raw = fs::read_to_string(path)?;
    let settings = serde_json::from_str(&raw).unwrap_or_default();
    Ok(settings)
}

pub fn save_settings(path: impl AsRef<Path>, settings: &AppConfig) -> io::Result<()> {
    let raw = serde_json::to_string_pretty(settings)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    fs::write(path, raw)
}

#[cfg(test)]
mod tests {
    use super::{load_settings, save_settings};
    use crate::config::AppConfig;
    use std::fs;

    #[test]
    fn round_trips_settings_json() {
        let path = std::env::temp_dir().join("scanbridge_settings_test.json");
        let settings = AppConfig::default();

        save_settings(&path, &settings).expect("save settings");
        let loaded = load_settings(&path).expect("load settings");

        assert_eq!(loaded.auto_enter, settings.auto_enter);
        let _ = fs::remove_file(path);
    }
}
