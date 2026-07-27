use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseEvent {
    pub r#type: String,
    pub session_id: String,
    pub timestamp: String,
}

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

impl ScanEvent {
    pub fn new(session_id: String, barcode: impl Into<String>, symbology: Option<&str>) -> Self {
        Self {
            r#type: "scan".to_string(),
            session_id,
            barcode: barcode.into(),
            symbology: symbology.map(ToOwned::to_owned),
            timestamp: "2026-07-27T12:00:00.000Z".to_string(),
            source: "mobile".to_string(),
        }
    }
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RealtimeEvent {
    #[serde(rename = "scan")]
    Scan(ScanEvent),
    #[serde(rename = "scan_ack")]
    ScanAck(ScanAckEvent),
    #[serde(rename = "desktop_status")]
    DesktopStatus(DesktopStatusEvent),
}
