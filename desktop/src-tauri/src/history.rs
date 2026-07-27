use serde::{Deserialize, Serialize};
use std::{io, path::Path};

use crate::storage::{read_json_or_default, write_json_atomic};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub barcode: String,
    pub symbology: Option<String>,
    pub received_at: String,
    pub typed: bool,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug)]
pub struct HistoryStore {
    items: Vec<HistoryItem>,
    limit: usize,
}

impl HistoryStore {
    pub fn new(limit: usize) -> Self {
        Self {
            items: Vec::new(),
            limit,
        }
    }

    pub fn push(&mut self, item: HistoryItem) {
        self.items.push(item);
        if self.items.len() > self.limit {
            let overflow = self.items.len() - self.limit;
            self.items.drain(0..overflow);
        }
    }

    pub fn latest(&self) -> Vec<HistoryItem> {
        self.items.iter().rev().cloned().collect()
    }

    pub fn clear(&mut self) {
        self.items.clear();
    }

    pub fn set_limit(&mut self, limit: usize) {
        self.limit = limit.max(1);
        if self.items.len() > self.limit {
            let overflow = self.items.len() - self.limit;
            self.items.drain(0..overflow);
        }
    }

    pub fn load(path: impl AsRef<Path>, limit: usize) -> Self {
        let items: Vec<HistoryItem> = read_json_or_default(path);
        let mut store = Self {
            items,
            limit: limit.max(1),
        };
        store.set_limit(limit);
        store
    }

    pub fn save(&self, path: impl AsRef<Path>) -> io::Result<()> {
        write_json_atomic(path, &self.items)
    }
}

impl Default for HistoryStore {
    fn default() -> Self {
        Self::new(100)
    }
}

#[cfg(test)]
mod tests {
    use super::{HistoryItem, HistoryStore};
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn enforces_limit_and_returns_newest_first() {
        let mut store = HistoryStore::new(100);
        for index in 0..101 {
            store.push(item(&index.to_string(), index % 2 == 0));
        }

        let latest = store.latest();
        assert_eq!(latest.len(), 100);
        assert_eq!(latest[0].barcode, "100");
        assert_eq!(latest[99].barcode, "1");
    }

    #[test]
    fn persists_and_clears_history() {
        let path = test_path("history-round-trip");
        let mut store = HistoryStore::new(100);
        store.push(item("899123", true));
        store.save(&path).expect("save history");

        let mut loaded = HistoryStore::load(&path, 100);
        assert_eq!(loaded.latest()[0].barcode, "899123");
        loaded.clear();
        loaded.save(&path).expect("clear persisted history");
        assert!(HistoryStore::load(&path, 100).latest().is_empty());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn invalid_history_falls_back_to_empty() {
        let path = test_path("history-invalid");
        fs::write(&path, "[invalid").expect("write invalid history");
        assert!(HistoryStore::load(&path, 100).latest().is_empty());
        let _ = fs::remove_file(path);
    }

    fn item(barcode: &str, typed: bool) -> HistoryItem {
        HistoryItem {
            barcode: barcode.to_string(),
            symbology: Some("EAN_13".to_string()),
            received_at: "2026-07-28T00:00:00.000Z".to_string(),
            typed,
            message: None,
        }
    }

    fn test_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("{name}-{}.json", Uuid::new_v4()))
    }
}
