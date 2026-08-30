#[cfg(desktop)]
use tauri::{Emitter, Manager};

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
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            // On Windows/Linux, a deep-link redirect (Discord/Twitch/
            // Xbox OAuth callbacks — see lib/oauthRedirect.js and
            // AppContext.jsx's Xbox effect) reaches an already-running
            // app as a plain CLI argument to this SECOND launch
            // attempt, not as a direct event — the deep-link plugin's
            // own docs note "you must also check argv here" for
            // exactly this reason. Without forwarding it, the window
            // above still gets focused but the actual callback URL
            // (with the real OAuth code) never reaches the frontend
            // at all — confirmed live as Xbox sign-in silently
            // "flicking back to the app" with nothing ever completing.
            // Forwarding it means re-emitting the same event
            // @tauri-apps/plugin-deep-link's onOpenUrl listens on.
            if let Some(url) = args.into_iter().find(|a| a.starts_with("lykodex://")) {
                let _ = app.emit("deep-link://new-url", vec![url]);
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init());

    // Registers the lykodex:// scheme with the OS at runtime — only
    // needed on Windows/Linux for an unbundled dev build (a real
    // installer registers it itself via tauri.conf.json's plugins.
    // deep-link config). Harmless to call again if already registered.
    #[cfg(any(windows, target_os = "linux"))]
    let builder = builder.setup(|app| {
        use tauri_plugin_deep_link::DeepLinkExt;
        app.deep_link().register_all()?;
        Ok(())
    });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
