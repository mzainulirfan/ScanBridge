use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub auto_enter: bool,
    pub auto_tab: bool,
    pub prefix: String,
    pub suffix: String,
    pub history_enabled: bool,
    pub history_limit: usize,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            auto_enter: true,
            auto_tab: false,
            prefix: String::new(),
            suffix: String::new(),
            history_enabled: true,
            history_limit: 100,
        }
    }
}
