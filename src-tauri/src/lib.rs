use tauri::Manager;

/// Custom Tauri commands exposed to the frontend

/// Get system GPU info for the engine diagnostics panel
#[tauri::command]
fn get_system_info() -> serde_json::Value {
    serde_json::json!({
        "platform": std::env::consts::OS,
        "arch":     std::env::consts::ARCH,
        "engine":   "Midnight Engine v0.1.0"
    })
}

/// Toggle fullscreen on the main window
#[tauri::command]
async fn toggle_fullscreen(window: tauri::Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!is_fullscreen).map_err(|e| e.to_string())
}

/// Set window title (useful for scene names)
#[tauri::command]
async fn set_window_title(window: tauri::Window, title: String) -> Result<(), String> {
    window.set_title(&title).map_err(|e| e.to_string())
}

/// Save game data to a file via native dialog
#[tauri::command]
async fn save_game_data(data: String) -> Result<String, String> {
    // Placeholder — real implementation uses tauri-plugin-fs
    Ok(format!("Saved {} bytes", data.len()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            toggle_fullscreen,
            set_window_title,
            save_game_data,
        ])
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();
            // Centre window on startup (window-state plugin persists position on close)
            main_window.center().ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Midnight Engine");
}
