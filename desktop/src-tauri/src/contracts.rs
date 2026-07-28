use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanEvent {
    pub r#type: String,
    pub scan_id: String,
    pub session_id: String,
    pub client_id: String,
    pub barcode: String,
    pub symbology: Option<String>,
    pub timestamp: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanAckEvent {
    pub r#type: String,
    pub scan_id: String,
    pub session_id: String,
    pub barcode: String,
    pub success: bool,
    pub message: String,
    pub timestamp: String,
}

impl ScanAckEvent {
    pub fn new(
        scan_id: String,
        session_id: String,
        barcode: &str,
        success: bool,
        message: &str,
    ) -> Self {
        Self {
            r#type: "scan_ack".to_string(),
            scan_id,
            session_id,
            barcode: barcode.to_string(),
            success,
            message: message.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
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
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}
