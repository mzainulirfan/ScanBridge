use crate::realtime::RealtimeChannel;

pub fn build_pairing_url(session_id: &str) -> String {
    format!("https://scanbridge-mobile.vercel.app/connect?session={session_id}")
}

pub fn render_placeholder(channel: &RealtimeChannel) -> String {
    format!(
        "[ ScanBridge QR ]\n{}\nChannel: {}",
        build_pairing_url(&channel.session_id),
        channel.channel_name
    )
}
