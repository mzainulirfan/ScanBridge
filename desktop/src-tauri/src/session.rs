use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct SessionManager {
    id: String,
    connected: bool,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            id: create_pairing_code(),
            connected: false,
        }
    }

    pub fn id(&self) -> String {
        self.id.clone()
    }

    pub fn mark_connected(&mut self) {
        self.connected = true;
    }

    pub fn mark_disconnected(&mut self) {
        self.connected = false;
    }

    pub fn reset(&mut self) {
        self.id = create_pairing_code();
        self.connected = false;
    }

    pub fn is_connected(&self) -> bool {
        self.connected
    }
}

fn create_pairing_code() -> String {
    let digits: String = Uuid::new_v4()
        .as_u128()
        .to_string()
        .chars()
        .take(6)
        .collect();
    format!("{digits:0<6}")
}

#[cfg(test)]
mod tests {
    use super::SessionManager;

    #[test]
    fn creates_six_digit_pairing_code() {
        let session = SessionManager::new();
        assert_eq!(session.id().len(), 6);
        assert!(session.id().chars().all(|char| char.is_ascii_digit()));
    }
}
