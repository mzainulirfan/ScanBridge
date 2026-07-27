use crate::{
    config::AppConfig,
    contracts::{DesktopStatusEvent, ScanAckEvent, ScanEvent},
    history::{HistoryItem, HistoryStore},
    keyboard,
    realtime::{RealtimeChannel, RealtimeClient},
    session::SessionManager,
    tray::TrayState,
};

pub struct DesktopApp {
    pub session: SessionManager,
    pub config: AppConfig,
    pub history: HistoryStore,
    pub tray: TrayState,
    pub realtime: RealtimeClient,
    pub channel: RealtimeChannel,
}

impl DesktopApp {
    pub fn new() -> Self {
        let session = SessionManager::new();
        let channel = RealtimeChannel::new(session.id());
        Self {
            session,
            config: AppConfig::default(),
            history: HistoryStore::new(100),
            tray: TrayState::default(),
            realtime: RealtimeClient::default(),
            channel,
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
        let typed = keyboard::type_scan(
            &self.config.prefix,
            &event.barcode,
            &self.config.suffix,
            self.config.auto_enter,
            self.config.auto_tab,
        )?;
        self.history.push(HistoryItem {
            barcode: event.barcode.clone(),
            symbology: event.symbology.clone(),
            received_at: event.timestamp.clone(),
            typed: true,
        });
        let ack = self.realtime.ack_scan(&self.session.id(), &event.barcode, "typed");
        Ok((typed, ack))
    }

    pub fn connect(&mut self) {
        self.session.mark_connected();
    }

    pub fn reset_pairing(&mut self) {
        self.session.reset();
        self.channel = RealtimeChannel::new(self.session.id());
    }
}
