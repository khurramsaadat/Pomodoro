//! The native tier of the Pomodoro timer.
//!
//! The web tier and this one share a single source tree, and the seam between
//! them is a small set of commands. Everything the frontend cannot do in a
//! browser lives here:
//!
//!  - a **system tray** icon that keeps the app reachable when the window is
//!    closed;
//!  - a **window that hides to the tray** instead of quitting, so a running
//!    timer survives the user tidying their desktop;
//!  - a **global shortcut** that starts and pauses the timer from anywhere;
//!  - a **deadline-driven alarm**, so a phase that ends while the window is
//!    hidden still fires its notification on time rather than whenever the
//!    user happens to bring the window forward.
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
  app.state::<Alarm>().set(payload.ends_at, payload.phase);
  Ok(())
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

/// Sets whether closing the window hides it instead of quitting.
///
/// This is what makes "hide to tray" work: the window is hidden, but the
/// process stays alive so the timer keeps running and the tray icon keeps
/// working.
#[tauri::command]
fn set_keep_alive(state: tauri::State<'_, KeepAlive>, keep_alive: bool) -> Result<(), String> {
  state.set(keep_alive);
  Ok(())
}

/// Hides the main window to the system tray.
///
/// The keep-alive flag is set first, so the window stays hidden rather than
/// being closed — a closed window would take the timer with it.
#[tauri::command]
fn hide_window(app: AppHandle, state: tauri::State<'_, KeepAlive>) -> Result<(), String> {
  state.set(true);

  // The window is looked up by its label. The first window is used as a
  // fallback, because the label is a configuration detail and a window
  // that cannot be found must not leave the user with no way back.
  let window = app
    .get_webview_window("main")
    .or_else(|| app.webview_windows().into_values().next())
    .ok_or("no main window")?;

  log::info!("hiding the window to the tray");
  window.hide().map_err(|error| error.to_string())
}

/// The flags that decide whether the app may end.
///
/// They are shared through an `Arc` rather than held as managed state,
/// because the tray's menu handler and the runtime's exit handler both
/// need them, and managed state is not available in every one of those
/// places — a `state()` lookup before `manage()` panics.
#[derive(Clone, Default)]
pub struct KeepAlive {
  alive: std::sync::Arc<std::sync::atomic::AtomicBool>,
  quitting: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl KeepAlive {
  fn set(&self, value: bool) {
    self.alive.store(value, std::sync::atomic::Ordering::Relaxed);
  }

  fn get(&self) -> bool {
    self.alive.load(std::sync::atomic::Ordering::Relaxed)
  }

  /// Marks the exit as deliberate, so it is allowed to proceed.
  fn request_quit(&self) {
    self.quitting.store(true, std::sync::atomic::Ordering::Relaxed);
  }

  /// Whether the user asked for the app to end.
  fn is_quitting(&self) -> bool {
    self.quitting.load(std::sync::atomic::Ordering::Relaxed)
  }
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
        .target(tauri_plugin_log::Target::new(
          tauri_plugin_log::TargetKind::Stdout,
        ))
        .target(tauri_plugin_log::Target::new(
          tauri_plugin_log::TargetKind::LogDir { file_name: None },
        ))
        .build(),
    )
    .setup(|app| {
      // The keep-alive flags are created here and shared by clone, rather
      // than being managed state looked up on demand. The tray's menu
      // handler and the runtime's exit handler both need them, and a
      // `state()` lookup in either of those places can run before the
      // state has been managed — which panics.
      let keep_alive = KeepAlive::default();
      app.manage(keep_alive.clone());

      // The notification system has to know the app before it will show a
      // toast for it.
      register_windows_app_id(&app.config().identifier);

      tray::install(app.handle(), keep_alive)?;
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
      // The close button hides the window rather than ending the process. A
      // Pomodoro timer that stops when its window is closed is a timer that
      // cannot be trusted to be there when the break is due.
      if let WindowEvent::CloseRequested { api, .. } = event {
        // `try_state` rather than `state`: the lookup can run before the
        // state has been managed, and a panic in a window event takes the
        // app down.
        let keep_alive = window
          .try_state::<KeepAlive>()
          .map(|state| state.get())
          .unwrap_or(false);

        if keep_alive {
          api.prevent_close();
          let _ = window.hide();
        }
      }

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
      set_keep_alive,
      hide_window,
      set_mini_window,
      work_area
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      // Hiding the last window would otherwise end the process, which is
      // precisely what the tray exists to prevent: the timer has to keep
      // running with no window on screen.
      //
      // The exit is only allowed to proceed when the app was asked to quit
      // deliberately — from the tray's Quit item — and never when a window
      // merely went away.
      if let tauri::RunEvent::ExitRequested { api, code, .. } = &event {
        // `try_state` rather than `state`: a lookup before the state has
        // been managed panics, and a panic in the exit handler takes the
        // whole app down.
        let keep_alive = app.try_state::<KeepAlive>();

        let (alive, quitting) = keep_alive
          .as_ref()
          .map(|state| (state.get(), state.is_quitting()))
          .unwrap_or((false, false));

        log::info!("exit requested (code: {code:?}, alive: {alive}, quitting: {quitting})");

        // The exit proceeds only when the user asked for it — from the
        // tray's Quit item. A window that merely went away is not a reason
        // to end a running timer.
        if alive && !quitting {
          api.prevent_exit();
          log::info!("the exit was prevented; the timer keeps running");
        }
      }
    });
}

