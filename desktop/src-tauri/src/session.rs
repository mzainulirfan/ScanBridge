use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct SessionManager {
    id: String,
    connected: bool,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            connected: false,
        }
    }

    pub fn id(&self) -> String {
        self.id.clone()
    }

    pub fn mark_connected(&mut self) {
        self.connected = true;
    }

    pub fn is_connected(&self) -> bool {
        self.connected
    }
}

#[cfg(test)]
mod tests {
    use super::SessionManager;

    #[test]
    fn creates_non_empty_uuid() {
        let session = SessionManager::new();
        assert!(!session.id().is_empty());
    }
}
