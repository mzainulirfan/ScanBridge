use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanEvent {
    pub r#type: String,
    pub session_id: String,
    pub barcode: String,
    pub symbology: Option<String>,
    pub timestamp: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanAckEvent {
    pub r#type: String,
    pub session_id: String,
    pub barcode: String,
    pub success: bool,
    pub message: String,
    pub timestamp: String,
}

impl ScanAckEvent {
    pub fn typed(session_id: String, barcode: &str, message: &str) -> Self {
        Self {
            r#type: "scan_ack".to_string(),
            session_id,
            barcode: barcode.to_string(),
            success: true,
            message: message.to_string(),
            timestamp: "2026-07-27T12:00:00.150Z".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopStatusEvent {
    pub r#type: String,
    pub session_id: String,
    pub status: String,
    pub device_count: u32,
    pub timestamp: String,
}

impl DesktopStatusEvent {
    pub fn new(session_id: String, status: impl Into<String>, device_count: u32) -> Self {
        Self {
            r#type: "desktop_status".to_string(),
            session_id,
            status: status.into(),
            device_count,
            timestamp: "2026-07-27T12:00:00.000Z".to_string(),
        }
    }
}
