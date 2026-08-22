#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // The updater only makes sense for the desktop build — mobile app
    // stores (Play Store/App Store) handle their own update delivery,
    // and the plugin isn't supported on those targets anyway.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
