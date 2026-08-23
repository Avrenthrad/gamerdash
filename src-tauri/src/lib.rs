#[cfg(desktop)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // The updater only makes sense for the desktop build — mobile app
    // stores (Play Store/App Store) handle their own update delivery,
    // and the plugin isn't supported on those targets anyway.
    //
    // single-instance must be registered first (Tauri requirement) —
    // without it, launching the app while it's already running spawns
    // a second full process/window instead of focusing the existing
    // one. The callback here just brings the original window forward.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
