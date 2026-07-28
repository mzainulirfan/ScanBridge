use crate::{
    config::AppConfig,
    contracts::{DesktopStatusEvent, ScanAckEvent, ScanEvent},
    history::{HistoryItem, HistoryStore},
    keyboard,
    realtime::{RealtimeChannel, RealtimeClient},
    session::SessionManager,
};
use std::path::PathBuf;

pub struct DesktopApp {
    pub session: SessionManager,
    pub config: AppConfig,
    pub history: HistoryStore,
    pub realtime: RealtimeClient,
    pub channel: RealtimeChannel,
    data_dir: PathBuf,
}

impl DesktopApp {
    pub fn load(data_dir: PathBuf) -> Self {
        let session = SessionManager::new();
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
        }
    }

    pub fn status(&self) -> DesktopStatusEvent {
        let state = if self.session.is_connected() {
            "connected"
        } else {
            "waiting_pairing"
        };
        self.realtime.create_status(&self.session.id(), state, 0)
    }

    pub fn receive_scan(&mut self, event: ScanEvent) -> Result<(String, ScanAckEvent), String> {
        let type_result = keyboard::type_scan(
            &self.config.prefix,
            &event.barcode,
            &self.config.suffix,
            self.config.auto_enter,
            self.config.auto_tab,
        );
        let history_save_error = if self.config.history_enabled {
            self.history.push(HistoryItem {
                barcode: event.barcode.clone(),
                symbology: event.symbology.clone(),
                received_at: event.timestamp.clone(),
                typed: type_result.is_ok(),
                message: type_result.as_ref().err().cloned(),
            });
            self.save_history().err()
        } else {
            None
        };

        let typed = type_result?;
        let message = history_save_error
            .map(|error| format!("typed / riwayat gagal disimpan: {error}"))
            .unwrap_or_else(|| "typed".to_string());
        let ack = self
            .realtime
            .ack_scan(&self.session.id(), &event.barcode, &message);
        Ok((typed, ack))
    }

    pub fn update_settings(&mut self, config: AppConfig) -> Result<AppConfig, String> {
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

    pub fn connect(&mut self) {
        self.session.mark_connected();
    }

    pub fn disconnect(&mut self) {
        self.session.mark_disconnected();
    }

    pub fn reset_pairing(&mut self) {
        self.session.reset();
        self.channel = RealtimeChannel::new(self.session.id());
    }

    fn save_history(&self) -> Result<(), String> {
        self.history
            .save(self.data_dir.join("history.json"))
            .map_err(|error| error.to_string())
    }
}
