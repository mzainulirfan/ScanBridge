use crate::{
    config::AppConfig,
    contracts::{DesktopStatusEvent, ScanAckEvent, ScanEvent},
    history::{HistoryItem, HistoryStore},
    keyboard,
    realtime::{RealtimeChannel, RealtimeClient},
    session::SessionManager,
};
use std::{collections::VecDeque, path::PathBuf};

const RECENT_SCAN_LIMIT: usize = 1024;

pub struct DesktopApp {
    pub session: SessionManager,
    pub config: AppConfig,
    pub history: HistoryStore,
    pub realtime: RealtimeClient,
    pub channel: RealtimeChannel,
    data_dir: PathBuf,
    recent_scans: VecDeque<(String, String, ScanAckEvent)>,
}

impl DesktopApp {
    pub fn load(data_dir: PathBuf) -> Self {
        let session = SessionManager::load(data_dir.join("session.json"));
        let _ = session.save(data_dir.join("session.json"));
        let channel = RealtimeChannel::new(session.id());
        let config = crate::settings::load_settings(data_dir.join("settings.json"));
        let history = HistoryStore::load(data_dir.join("history.json"), config.history_limit);
        Self {
            session,
            config,
            history,
            realtime: RealtimeClient::default(),
            channel,
            data_dir,
            recent_scans: VecDeque::new(),
        }
    }

    pub fn status(&self) -> DesktopStatusEvent {
        let state = if self.session.is_connected() {
            "connected"
        } else {
            "waiting_pairing"
        };
        let mut status = self.realtime.create_status(&self.session.id(), state, 0);
        if self.session.is_connected() {
            status.device_count = 1;
            status.client_id = self.session.trusted_client_id();
        }
        status
    }

    pub fn receive_scan(&mut self, event: ScanEvent) -> Result<(String, ScanAckEvent), String> {
        self.receive_scan_with(event, keyboard::type_scan)
    }

    fn receive_scan_with(
        &mut self,
        event: ScanEvent,
        type_scan: impl FnOnce(&str, &str, &str, bool, bool) -> Result<String, String>,
    ) -> Result<(String, ScanAckEvent), String> {
        self.validate_scan(&event)?;
        if let Some((_, typed, ack)) = self.recent_scans.iter().find(|(id, _, _)| id == &event.scan_id) {
            return Ok((typed.clone(), ack.clone()));
        }
        let barcode = event.barcode.trim().to_string();
        let type_result = type_scan(
            &self.config.prefix,
            &barcode,
            &self.config.suffix,
            self.config.auto_enter,
            self.config.auto_tab,
        );
        let history_save_error = if self.config.history_enabled {
            self.history.push(HistoryItem {
                barcode: barcode.clone(),
                symbology: event.symbology.clone(),
                received_at: event.timestamp.clone(),
                typed: type_result.is_ok(),
                message: type_result.as_ref().err().cloned(),
            });
            self.save_history().err()
        } else {
            None
        };

        let success = type_result.is_ok();
        let message = match (&type_result, history_save_error) {
            (Ok(_), Some(error)) => format!("typed / riwayat gagal disimpan: {error}"),
            (Ok(_), None) => "typed".to_string(),
            (Err(error), _) => error.clone(),
        };
        let ack = self.realtime.ack_scan(
            &event.scan_id,
            &self.session.id(),
            &barcode,
            success,
            &message,
        );
        let typed = type_result.unwrap_or_default();
        if self.recent_scans.len() >= RECENT_SCAN_LIMIT {
            self.recent_scans.pop_front();
        }
        self.recent_scans.push_back((event.scan_id, typed.clone(), ack.clone()));
        Ok((typed, ack))
    }

    pub fn update_settings(&mut self, config: AppConfig) -> Result<AppConfig, String> {
        let config = config.normalized();
        self.history.set_limit(config.history_limit);
        crate::settings::save_settings(self.data_dir.join("settings.json"), &config)
            .map_err(|error| error.to_string())?;
        self.config = config.clone();
        self.save_history()?;
        Ok(config)
    }

    pub fn history(&self) -> Vec<HistoryItem> {
        self.history.latest()
    }

    pub fn clear_history(&mut self) -> Result<(), String> {
        self.history.clear();
        self.save_history()
    }

    pub fn connect(&mut self, client_id: &str) -> Result<bool, String> {
        if !self.session.trust_client(client_id) {
            return Ok(false);
        }
        self.session.mark_connected();
        self.save_session()?;
        Ok(true)
    }

    pub fn disconnect(&mut self) -> Result<(), String> {
        self.session.mark_disconnected();
        self.save_session()
    }

    pub fn test_scan(&self, barcode: &str) -> Result<String, String> {
        let barcode = barcode.trim();
        if barcode.is_empty() || barcode.chars().count() > 256 {
            return Err("Barcode harus berisi 1-256 karakter".to_string());
        }
        keyboard::type_scan(
            &self.config.prefix,
            barcode,
            &self.config.suffix,
            self.config.auto_enter,
            self.config.auto_tab,
        )
    }

    pub fn reset_pairing(&mut self) -> Result<(), String> {
        self.session.reset();
        self.recent_scans.clear();
        self.channel = RealtimeChannel::new(self.session.id());
        self.save_session()
    }

    fn save_history(&self) -> Result<(), String> {
        self.history
            .save(self.data_dir.join("history.json"))
            .map_err(|error| error.to_string())
    }

    fn save_session(&self) -> Result<(), String> {
        self.session
            .save(self.data_dir.join("session.json"))
            .map_err(|error| error.to_string())
    }

    fn validate_scan(&self, event: &ScanEvent) -> Result<(), String> {
        if event.r#type != "scan" || event.source != "mobile" {
            return Err("Payload scan tidak valid".to_string());
        }
        if event.session_id != self.session.id() {
            return Err("Sesi scan tidak cocok".to_string());
        }
        if !self.session.is_trusted(&event.client_id) {
            return Err("Perangkat mobile tidak dikenali".to_string());
        }
        let barcode = event.barcode.trim();
        if barcode.is_empty() || barcode.chars().count() > 256 {
            return Err("Barcode harus berisi 1-256 karakter".to_string());
        }
        if event.scan_id.trim().is_empty()
            || chrono::DateTime::parse_from_rfc3339(&event.timestamp).is_err()
        {
            return Err("Metadata scan tidak valid".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::DesktopApp;
    use crate::contracts::ScanEvent;
    use uuid::Uuid;

    fn app() -> DesktopApp {
        let mut app = DesktopApp::load(
            std::env::temp_dir().join(format!("scanbridge-app-{}", Uuid::new_v4())),
        );
        app.connect("client-1").expect("trust test client");
        app
    }

    fn event(app: &DesktopApp) -> ScanEvent {
        ScanEvent {
            r#type: "scan".to_string(),
            scan_id: Uuid::new_v4().to_string(),
            session_id: app.session.id(),
            client_id: "client-1".to_string(),
            barcode: "899123".to_string(),
            symbology: Some("EAN_13".to_string()),
            timestamp: chrono::Utc::now().to_rfc3339(),
            source: "mobile".to_string(),
        }
    }

    #[test]
    fn rejects_scan_from_another_session() {
        let app = app();
        let mut invalid = event(&app);
        invalid.session_id = "ZZZZZZ".to_string();
        assert!(app.validate_scan(&invalid).is_err());
    }

    #[test]
    fn rejects_invalid_scan_metadata() {
        let app = app();
        let mut invalid = event(&app);
        invalid.barcode.clear();
        assert!(app.validate_scan(&invalid).is_err());
    }

    #[test]
    fn timeout_preserves_trusted_client_and_pairing_code() {
        let mut app = app();
        let code = app.session.id();
        app.disconnect().unwrap();
        assert!(!app.session.is_connected());
        assert_eq!(app.session.id(), code);
        assert!(app.session.is_trusted("client-1"));
        assert!(!app.connect("client-2").unwrap());
        let loaded = DesktopApp::load(app.data_dir.clone());
        assert!(loaded.session.is_trusted("client-1"));
        assert!(app.connect("client-1").unwrap());
        assert_eq!(app.status().client_id.as_deref(), Some("client-1"));
        assert_eq!(app.status().device_count, 1);
    }

    #[test]
    fn duplicate_scan_returns_original_ack_without_typing_again() {
        let mut app = app();
        let event = event(&app);
        let first = app.receive_scan_with(event.clone(), |_, barcode, _, _, _| Ok(barcode.into())).unwrap();
        let replay = app.receive_scan_with(event, |_, _, _, _, _| panic!("duplicate typed again")).unwrap();
        assert_eq!(first.0, replay.0);
        assert_eq!(first.1.timestamp, replay.1.timestamp);
        assert!(replay.1.success);
        assert_eq!(app.history().len(), 1);
    }

    #[test]
    fn failed_scan_is_not_retyped_and_cache_is_bounded() {
        let mut app = app();
        app.config.history_enabled = false;
        let first_event = event(&app);
        app.receive_scan_with(first_event.clone(), |_, _, _, _, _| Err("partial typing failure".into())).unwrap();
        let replay = app.receive_scan_with(first_event, |_, _, _, _, _| panic!("failed scan typed again")).unwrap();
        assert!(!replay.1.success);
        for _ in 0..super::RECENT_SCAN_LIMIT {
            let next = event(&app);
            app.receive_scan_with(next, |_, barcode, _, _, _| Ok(barcode.into())).unwrap();
        }
        assert_eq!(app.recent_scans.len(), super::RECENT_SCAN_LIMIT);
        app.reset_pairing().unwrap();
        assert!(app.recent_scans.is_empty());
    }
}
