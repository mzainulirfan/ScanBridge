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
mod storage;

use app::DesktopApp;
use commands::AppState;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            app.manage(AppState {
                app: Mutex::new(DesktopApp::load(data_dir)),
            });
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("ScanBridge");
            }
            let open_item = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            let exit_item = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &exit_item])?;
            let mut tray_builder = TrayIconBuilder::new().menu(&menu).show_menu_on_left_click(true);
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            tray_builder
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("tray-opened", ());
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "exit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_pairing_info,
            commands::reset_pairing_code,
            commands::get_status,
            commands::get_settings,
            commands::update_settings,
            commands::get_history,
            commands::clear_history,
            commands::receive_scan,
            commands::mark_connected,
            commands::mark_disconnected,
            commands::hide_main_window,
            commands::show_main_window,
            commands::exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running ScanBridge desktop");
}
