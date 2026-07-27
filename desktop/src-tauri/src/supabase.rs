use crate::{
    contracts::{ScanAckEvent, ScanEvent},
    realtime::RealtimeChannel,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct SupabaseConfig {
    pub url: String,
    pub anon_key: String,
}

impl SupabaseConfig {
    pub fn from_env() -> Option<Self> {
        let url = std::env::var("SUPABASE_URL").ok()?;
        let anon_key = std::env::var("SUPABASE_ANON_KEY").ok()?;
        Some(Self { url, anon_key })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimeFrame<T> {
    pub topic: String,
    pub event: String,
    pub payload: T,
    pub r#ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinPayload {
    pub config: BroadcastConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastConfig {
    pub broadcast: BroadcastOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastOptions {
    #[serde(rename = "self")]
    pub self_broadcast: bool,
}

impl SupabaseConfig {
    pub fn websocket_url(&self) -> String {
        let base = self.url.trim_end_matches('/').replace("https://", "wss://").replace("http://", "ws://");
        format!(
            "{base}/realtime/v1/websocket?apikey={}&vsn=1.0.0",
            urlencoding::encode(&self.anon_key)
        )
    }
}

#[derive(Debug)]
pub struct SupabaseRealtimeBridge {
    pub config: SupabaseConfig,
    pub channel: RealtimeChannel,
}

impl SupabaseRealtimeBridge {
    pub fn new(config: SupabaseConfig, channel: RealtimeChannel) -> Self {
        Self { config, channel }
    }

    pub async fn subscribe_scans<F>(&self, _handler: F) -> Result<(), String>
    where
        F: FnMut(ScanEvent) -> Result<ScanAckEvent, String> + Send + 'static,
    {
        Err("Supabase realtime bridge for Rust desktop is not wired yet; use Tauri command receive_scan until websocket client is added".to_string())
    }

    pub fn join_frame(&self) -> RealtimeFrame<JoinPayload> {
        RealtimeFrame {
            topic: format!("realtime:{}", self.channel.channel_name),
            event: "phx_join".to_string(),
            payload: JoinPayload {
                config: BroadcastConfig {
                    broadcast: BroadcastOptions {
                        self_broadcast: true,
                    },
                },
            },
            r#ref: Some("1".to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::SupabaseConfig;

    #[test]
    fn builds_websocket_url() {
        let config = SupabaseConfig {
            url: "https://example.supabase.co".to_string(),
            anon_key: "anon key".to_string(),
        };

        assert_eq!(
            config.websocket_url(),
            "wss://example.supabase.co/realtime/v1/websocket?apikey=anon%20key&vsn=1.0.0"
        );
    }
}
