use crate::{
    app::DesktopApp,
    config::AppConfig,
    contracts::{DesktopStatusEvent, ScanAckEvent, ScanEvent},
    history::HistoryItem,
    qr,
};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{State, WebviewWindow};

pub struct AppState {
    pub app: Mutex<DesktopApp>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingInfo {
    pub session_id: String,
    pub channel_name: String,
    pub pairing_url: String,
    pub qr_placeholder: String,
}

#[tauri::command]
pub fn get_pairing_info(state: State<'_, AppState>) -> Result<PairingInfo, String> {
    let app = state.app.lock().map_err(|error| error.to_string())?;
    Ok(PairingInfo {
        session_id: app.session.id(),
        channel_name: app.channel.channel_name.clone(),
        pairing_url: qr::build_pairing_url(&app.session.id()),
        qr_placeholder: qr::render_placeholder(&app.channel),
    })
}

#[tauri::command]
pub fn reset_pairing_code(state: State<'_, AppState>) -> Result<PairingInfo, String> {
    let mut app = state.app.lock().map_err(|error| error.to_string())?;
    app.reset_pairing();
    Ok(PairingInfo {
        session_id: app.session.id(),
        channel_name: app.channel.channel_name.clone(),
        pairing_url: qr::build_pairing_url(&app.session.id()),
        qr_placeholder: qr::render_placeholder(&app.channel),
    })
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> Result<DesktopStatusEvent, String> {
    let app = state.app.lock().map_err(|error| error.to_string())?;
    Ok(app.status())
}

#[tauri::command]
pub fn mark_connected(state: State<'_, AppState>) -> Result<DesktopStatusEvent, String> {
    let mut app = state.app.lock().map_err(|error| error.to_string())?;
    app.connect();
    Ok(app.status())
}

#[tauri::command]
pub fn mark_disconnected(state: State<'_, AppState>) -> Result<DesktopStatusEvent, String> {
    let mut app = state.app.lock().map_err(|error| error.to_string())?;
    app.disconnect();
    Ok(app.status())
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let app = state.app.lock().map_err(|error| error.to_string())?;
    Ok(app.config.clone())
}

#[tauri::command]
pub fn update_settings(settings: AppConfig, state: State<'_, AppState>) -> Result<AppConfig, String> {
    let mut app = state.app.lock().map_err(|error| error.to_string())?;
    app.update_settings(settings)
}

#[tauri::command]
pub fn get_history(state: State<'_, AppState>) -> Result<Vec<HistoryItem>, String> {
    let app = state.app.lock().map_err(|error| error.to_string())?;
    Ok(app.history())
}

#[tauri::command]
pub fn clear_history(state: State<'_, AppState>) -> Result<(), String> {
    let mut app = state.app.lock().map_err(|error| error.to_string())?;
    app.clear_history()
}

#[tauri::command]
pub fn receive_scan(event: ScanEvent, state: State<'_, AppState>) -> Result<ScanAckEvent, String> {
    let mut app = state.app.lock().map_err(|error| error.to_string())?;
    let (_typed, ack) = app.receive_scan(event)?;
    Ok(ack)
}

#[tauri::command]
pub fn hide_main_window(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn show_main_window(window: WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}
