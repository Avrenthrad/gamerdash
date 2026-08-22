// Suppresses the console window Windows otherwise opens alongside the
// app in release builds (kept in debug builds so `cargo run`/`tauri dev`
// output is still visible while developing).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Entry point kept deliberately minimal — Lykodex is a wrapped web
// app (the same React/Vite build everything else in this project
// uses), not a native Rust app with its own logic. All the real
// functionality lives in the web app itself; this just gives it a
// native window and installer.
fn main() {
    lykodex_lib::run();
}
