fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new().app_manifest(
      tauri_build::AppManifest::new().commands(&[
        "platform_info",
        "set_alarm",
        "clear_alarm",
        "set_tray_state",
        "set_keep_alive",
        "hide_window",
      ]),
    ),
  )
  .expect("failed to run tauri-build");
}
