mod app;
mod commands;
mod config;
mod contracts;
mod history;
mod keyboard;
mod qr;
mod realtime;
mod session;
mod settings;
mod supabase;
mod tray;

use app::DesktopApp;
use commands::AppState;
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            app: Mutex::new(DesktopApp::new()),
        })
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("ScanBridge");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_pairing_info,
            commands::get_status,
            commands::get_settings,
            commands::update_settings,
            commands::receive_scan,
            commands::mark_connected
        ])
        .run(tauri::generate_context!())
        .expect("error while running ScanBridge desktop");
}
