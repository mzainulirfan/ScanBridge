use crate::contracts::{DesktopStatusEvent, ScanAckEvent};

#[derive(Debug, Clone)]
pub struct RealtimeChannel {
    pub session_id: String,
    pub channel_name: String,
}

impl RealtimeChannel {
    pub fn new(session_id: impl Into<String>) -> Self {
        let session_id = session_id.into();
        Self {
            channel_name: format!("scanbridge:session:{session_id}"),
            session_id,
        }
    }
}

#[derive(Debug, Default)]
pub struct RealtimeClient;

impl RealtimeClient {
    pub fn create_status(&self, session_id: &str, status: &str, device_count: u32) -> DesktopStatusEvent {
        DesktopStatusEvent::new(session_id.to_string(), status, device_count)
    }

    pub fn ack_scan(&self, session_id: &str, barcode: &str, message: &str) -> ScanAckEvent {
        ScanAckEvent::typed(session_id.to_string(), barcode, message)
    }
}
