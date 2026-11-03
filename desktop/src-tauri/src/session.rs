use crate::storage::{read_json_or_default, write_json_atomic};
use serde::{Deserialize, Serialize};
use std::{io, path::Path};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionManager {
    id: String,
    trusted_client_id: Option<String>,
    #[serde(skip)]
    connected: bool,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            id: create_pairing_code(),
            trusted_client_id: None,
            connected: false,
        }
    }

    pub fn load(path: impl AsRef<Path>) -> Self {
        let session = read_json_or_default::<Self>(path);
        if session.id.len() == 32 && session.id.chars().all(|char| char.is_ascii_hexdigit()) {
            session
        } else {
            Self::new()
        }
    }

    pub fn save(&self, path: impl AsRef<Path>) -> io::Result<()> {
        write_json_atomic(path, self)
    }

    pub fn id(&self) -> String {
        self.id.clone()
    }

    pub fn mark_connected(&mut self) {
        self.connected = true;
    }

    pub fn trust_client(&mut self, client_id: &str) -> bool {
        match self.trusted_client_id.as_deref() {
            Some(trusted) => trusted == client_id,
            None => {
                self.trusted_client_id = Some(client_id.to_string());
                true
            }
        }
    }

    pub fn is_trusted(&self, client_id: &str) -> bool {
        self.trusted_client_id.as_deref() == Some(client_id)
    }

    pub fn has_trusted_client(&self) -> bool {
        self.trusted_client_id.is_some()
    }

    pub fn trusted_client_id(&self) -> Option<String> {
        self.trusted_client_id.clone()
    }

    pub fn mark_disconnected(&mut self) {
        self.connected = false;
    }

    pub fn forget_trusted_client(&mut self) {
        self.trusted_client_id = None;
    }

    pub fn reset(&mut self) {
        self.id = create_pairing_code();
        self.trusted_client_id = None;
        self.connected = false;
    }

    pub fn is_connected(&self) -> bool {
        self.connected
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

fn create_pairing_code() -> String {
    Uuid::new_v4().simple().to_string().to_uppercase()
}

#[cfg(test)]
mod tests {
    use super::SessionManager;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn creates_128_bit_pairing_code() {
        let session = SessionManager::new();
        assert_eq!(session.id().len(), 32);
        assert!(session.id().chars().all(|char| char.is_ascii_hexdigit()));
    }

    #[test]
    fn persists_pairing_code_and_trusted_client() {
        let path = std::env::temp_dir().join(format!("scanbridge-session-{}.json", Uuid::new_v4()));
        let mut session = SessionManager::new();
        let pairing_code = session.id();
        assert!(session.trust_client("mobile-1"));
        session.save(&path).expect("save session");

        let loaded = SessionManager::load(&path);
        assert_eq!(loaded.id(), pairing_code);
        assert!(loaded.is_trusted("mobile-1"));
        assert!(!loaded.is_connected());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn rejects_another_client_after_pairing() {
        let mut session = SessionManager::new();
        assert!(session.trust_client("mobile-1"));
        assert!(!session.trust_client("mobile-2"));
    }

    #[test]
    fn allows_a_new_client_after_forgetting_the_old_one() {
        let mut session = SessionManager::new();
        assert!(session.trust_client("mobile-1"));
        session.forget_trusted_client();
        assert!(session.trust_client("mobile-2"));
    }
}
