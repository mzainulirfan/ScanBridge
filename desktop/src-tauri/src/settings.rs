use crate::config::AppConfig;
use crate::storage::{read_json_or_default, write_json_atomic};
use std::{io, path::Path};

pub fn load_settings(path: impl AsRef<Path>) -> AppConfig {
    read_json_or_default(path)
}

pub fn save_settings(path: impl AsRef<Path>, settings: &AppConfig) -> io::Result<()> {
    write_json_atomic(path, settings)
}

#[cfg(test)]
mod tests {
    use super::{load_settings, save_settings};
    use crate::config::AppConfig;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn round_trips_settings_json() {
        let path = test_path("settings-round-trip");
        let mut settings = AppConfig::default();
        settings.prefix = "SKU-".to_string();

        save_settings(&path, &settings).expect("save settings");
        let loaded = load_settings(&path);

        assert_eq!(loaded.auto_enter, settings.auto_enter);
        assert_eq!(loaded.prefix, "SKU-");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn invalid_settings_fall_back_to_default() {
        let path = test_path("settings-invalid");
        fs::write(&path, "{invalid").expect("write invalid settings");

        let loaded = load_settings(&path);

        assert_eq!(loaded.auto_enter, AppConfig::default().auto_enter);
        let _ = fs::remove_file(path);
    }

    fn test_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("{name}-{}.json", Uuid::new_v4()))
    }
}
