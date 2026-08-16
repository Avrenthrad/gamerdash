// Entry point kept deliberately minimal — Lykodex is a wrapped web
// app (the same React/Vite build everything else in this project
// uses), not a native Rust app with its own logic. All the real
// functionality lives in the web app itself; this just gives it a
// native window and installer.
fn main() {
    lykodex_lib::run();
}
