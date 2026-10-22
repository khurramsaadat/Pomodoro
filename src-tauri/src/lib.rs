//! The native tier of the Pomodoro timer.
//!
//! The web tier and this one share a single source tree, and the seam between
//! them is a small set of commands. Everything the frontend cannot do in a
//! browser lives here:
//!
//!  - a **system tray** icon that shows the live timer and offers start/pause
//!    and quit, so the app is reachable from anywhere;
//!  - a **window that can be kept above the others**, so a timer the user
//!    would otherwise have to go looking for is always in view;
//!  - a **global shortcut** that starts and pauses the timer from anywhere;
//!  - a **deadline-driven alarm**, so a phase that ends while the window is
//!    in the background still fires its notification on time rather than
//!    whenever the user happens to bring the window forward.
//!
//! The last point is the important one. The web tier can only fire a chime
//! while the tab is alive, because a browser gives a backgrounded tab no
//! timer it can trust. The native tier has no such limitation, and the
//! deadline is already the source of truth for the countdown — so the alarm
//! is scheduled against the same deadline the UI is drawing.

mod alarm;
mod mini;
mod tray;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use alarm::Alarm;
use mini::{MiniModeRequest, WorkArea};
use tray::TrayState;

/// The event the frontend listens for when the user asks, from the tray or
/// the global shortcut, for the timer to be started or paused.
pub const TOGGLE_EVENT: &str = "pomodoro://toggle";

/// The event the frontend listens for when the tray asks for the window to
/// be shown.
pub const SHOW_EVENT: &str = "pomodoro://show";

/// The payload the frontend sends when it schedules the native alarm.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlarmPayload {
  /// The deadline the alarm fires at, in epoch milliseconds.
  pub ends_at: i64,
  /// The phase that is ending, as `work`, `shortBreak` or `longBreak`.
  pub phase: String,
  /// Whether a notification should be shown when the deadline is reached.
  ///
  /// The preference travels with the alarm rather than being read at the
  /// moment it fires, because the alarm runs on its own thread: by then the
  /// page may not be able to answer the question.
  #[serde(default)]
  pub notify: bool,
  /// Whether the window should ask for the user's attention at the deadline.
  #[serde(default)]
  pub attention: bool,
}

/// A notification the frontend asks the host to show.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationRequest {
  /// The notification's title.
  pub title: String,
  /// The notification's body.
  pub body: String,
}

/// What the frontend can learn about the tier it is running on.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
  /// The platform the app is running on.
  pub platform: String,
  /// Whether the native tier is in charge, rather than the browser.
  pub native: bool,
  /// Whether the window can be hidden to the tray.
  pub supports_tray: bool,
  /// Whether a global shortcut can be registered.
  pub supports_global_shortcut: bool,
  /// Whether the host can turn its window into a mini timer.
  pub supports_mini_window: bool,
  /// Whether the host can keep the window above the others.
  pub supports_always_on_top: bool,
  /// Whether the host can ask for the user's attention.
  pub supports_attention: bool,
}

/// The name the notification system shows for the app.
const WINDOWS_APP_NAME: &str = "Pomodoro";

/// Registers the application id with the Windows notification system.
///
/// Windows will not show a toast for an application it has never heard
/// of, and an *unpackaged* application — which is what a build that is not
/// installed is — has to introduce itself. The key is what makes the
/// notification carry the app's name and icon rather than an anonymous
/// one.
///
/// The id has to be the app's configured identifier, because that is the
/// id the notification plugin uses when it shows the toast.
///
/// A failure is logged rather than fatal: a missing notification is a
/// smaller problem than an app that will not start.
fn register_windows_app_id(identifier: &str) {
  #[cfg(target_os = "windows")]
  {
    use windows_registry::CURRENT_USER;

    let path = format!(r"SOFTWARE\Classes\AppUserModelId\{identifier}");

    let result = (|| -> windows_registry::Result<()> {
      let key = CURRENT_USER.create(&path)?;
      key.set_string("DisplayName", WINDOWS_APP_NAME)?;
      key.set_string("IconBackgroundColor", "0")?;
      Ok(())
    })();

    match result {
      Ok(()) => log::info!("the Windows application id {identifier} was registered"),
      Err(error) => log::warn!("the Windows application id could not be registered: {error}"),
    }
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = (identifier, WINDOWS_APP_NAME);
  }
}

/// Reports what the native tier can do.
///
/// The frontend calls this once on start-up to decide which affordances to
/// offer. A browser has no tray and no global shortcut, so it must not draw
/// buttons that do nothing.
#[tauri::command]
fn platform_info() -> PlatformInfo {
  PlatformInfo {
    platform: std::env::consts::OS.to_string(),
    native: true,
    supports_tray: cfg!(not(any(target_os = "android", target_os = "ios"))),
    supports_global_shortcut: cfg!(not(any(target_os = "android", target_os = "ios"))),
    supports_mini_window: cfg!(not(any(target_os = "android", target_os = "ios"))),
    supports_always_on_top: cfg!(not(any(target_os = "android", target_os = "ios"))),
    supports_attention: cfg!(not(any(target_os = "android", target_os = "ios"))),
  }
}

/// Enters or leaves mini mode.
///
/// The window is the app's only window, so entering mini mode *replaces* the
/// dashboard rather than covering it. That is the whole point of the
/// feature: a widget drawn on top of a full-size dashboard leaves the user
/// looking at two timers, one of them enormous and irrelevant.
#[tauri::command]
fn set_mini_window(app: AppHandle, request: MiniModeRequest) -> Result<(), String> {
  mini::apply(&app, &request)
}

/// Reports the area of the screen the window may be placed in.
///
/// The numbers are in logical pixels, so the frontend can compare them with
/// the positions it is given without knowing the scale factor.
#[tauri::command]
fn work_area(app: AppHandle) -> WorkArea {
  app
    .get_webview_window("main")
    .map(|window| mini::work_area(&window))
    .unwrap_or(WorkArea {
      width: 0.0,
      height: 0.0,
    })
}

/// Schedules the native alarm for a phase deadline.
///
/// The alarm is set on the *deadline*, not on a duration, so the notification
/// lands at the right moment even if the app was busy when it was scheduled.
/// A second call replaces the first, which is what happens every time the
/// timer is started, paused or reset.
#[tauri::command]
fn set_alarm(app: AppHandle, payload: AlarmPayload) -> Result<(), String> {
  log::info!("alarm scheduled for {}", payload.ends_at);
  app.state::<Alarm>().set(
    payload.ends_at,
    payload.phase,
    payload.notify,
    payload.attention,
  );
  Ok(())
}

/// Reports where the app keeps its data.
///
/// The path is resolved by the operating system, so the answer is whatever
/// the user actually has on disk rather than a guess.
#[tauri::command]
fn storage_location(app: AppHandle) -> Result<String, String> {
  let path = app
    .path()
    .app_local_data_dir()
    .map_err(|error| error.to_string())?;

  Ok(path.to_string_lossy().to_string())
}

/// Cancels the native alarm.
///
/// Called when the timer is paused, reset or skipped, so a cancelled phase
/// does not fire a notification later.
#[tauri::command]
fn clear_alarm(app: AppHandle) -> Result<(), String> {
  app.state::<Alarm>().clear();
  Ok(())
}

/// Updates the tray icon's tooltip to match the timer.
///
/// The tray is a second view of the timer, and a stale one is worse than
/// none: a tooltip that says "24:58" when the timer is paused is a lie.
#[tauri::command]
fn set_tray_state(app: AppHandle, state: TrayState) -> Result<(), String> {
  log::info!("tray state: {} {} (running: {})", state.phase, state.remaining, state.running);

  // The tray is looked up by its id rather than as managed state, because
  // the icon is created in the setup hook and a lookup by state panics if
  // it has not been registered. A tray that cannot be updated is a
  // cosmetic problem; a panic in a command handler takes the app down.
  let tray = app
    .tray_by_id(tray::TRAY_ID)
    .ok_or_else(|| "the tray icon is not available".to_string())?;

  tray::apply(&tray, &state);
  Ok(())
}

/// Keeps the window above the other windows, or lets it sink back.
///
/// This is the one thing the web tier genuinely cannot do, and it is the
/// reason the desktop app is worth having: a timer whose window the user
/// has to go looking for is a timer whose deadline they will miss.
///
/// The window is looked up by its label, with the first window as a
/// fallback, because the label is a configuration detail and a window that
/// cannot be found must not take the app down.
#[tauri::command]
fn set_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .or_else(|| app.webview_windows().into_values().next())
    .ok_or("no main window")?;

  log::info!("always on top: {always_on_top}");
  window
    .set_always_on_top(always_on_top)
    .map_err(|error| error.to_string())
}

/// The global shortcut that starts and pauses the timer from anywhere.
///
/// `Ctrl+Shift+Space` is used because it is unlikely to be taken by another
/// application, and because it does not collide with the in-window shortcuts
/// the web tier already offers.
const TOGGLE_SHORTCUT: &str = "CommandOrControl+Shift+Space";

/// Builds and runs the application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      // A second launch focuses the window that already exists rather than
      // starting a second timer, which would double every statistic.
      tray::focus_main(app);
    }))
    .plugin(tauri_plugin_notification::init())
    .plugin(
      // The global shortcut drives the timer from outside the window, so it
      // is forwarded to the frontend as an event. The plugin is registered
      // on the builder with its handler, because registering it twice — once
      // plain and once with a handler — makes the second registration fail.
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
          if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
            let _ = app.emit(TOGGLE_EVENT, ());
          }
        })
        .build(),
    )
    .plugin(
      // The logger is registered on the builder rather than inside the
      // setup hook, because a plugin registered later misses the events
      // that happen before it arrives.
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        // The builder's defaults already include every target, so naming
        // two of them without clearing the rest writes every line twice —
        // once by the default target and once by the named one.
        .clear_targets()
        .target(tauri_plugin_log::Target::new(
          tauri_plugin_log::TargetKind::Stdout,
        ))
        .target(tauri_plugin_log::Target::new(
          tauri_plugin_log::TargetKind::LogDir { file_name: None },
        ))
        .build(),
    )
    .setup(|app| {
      // The notification system has to know the app before it will show a
      // toast for it.
      register_windows_app_id(&app.config().identifier);

      tray::install(app.handle())?;
      app.manage(Alarm::new(app.handle().clone()));

      // A shortcut that another application already owns is simply not
      // registered — losing a shortcut must never stop the app from
      // starting.
      if let Err(error) = app
        .handle()
        .global_shortcut()
        .register(TOGGLE_SHORTCUT)
      {
        log::warn!("the global shortcut {TOGGLE_SHORTCUT} could not be registered: {error}");
      }

      Ok(())
    })
    .on_window_event(|window, event| {
      // A moved window is reported so the frontend can remember where the
      // user put it. The event is only raised once the drag has finished,
      // so the position that is reported is the one the window came to rest
      // at rather than every pixel it passed through.
      if let WindowEvent::Moved(_) = event {
        mini::report_position(window.app_handle());
      }
    })
    .invoke_handler(tauri::generate_handler![
      platform_info,
      set_alarm,
      clear_alarm,
      set_tray_state,
      set_always_on_top,
      set_mini_window,
      work_area,
      storage_location
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|_, _| {});
}
