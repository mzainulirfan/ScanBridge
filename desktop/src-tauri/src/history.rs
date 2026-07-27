use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryItem {
    pub barcode: String,
    pub symbology: Option<String>,
    pub received_at: String,
    pub typed: bool,
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

    pub fn all(&self) -> &[HistoryItem] {
        &self.items
    }
}

impl Default for HistoryStore {
    fn default() -> Self {
        Self::new(100)
    }
}
