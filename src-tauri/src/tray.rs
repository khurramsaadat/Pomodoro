//! The system tray.
//!
//! The tray is the app's second view of the timer. A Pomodoro timer that
//! only works while its window is open is a timer the user has to babysit;
//! one that lives in the notification area keeps showing the time, and can
//! be driven from the tray menu without the window ever coming forward.
//!
//! The tray is *not* a place to hide the window. Closing the window ends
//! the app, as it should — a program that survives its own close button is
//! a program the user cannot get rid of. The tray stays because it is a
//! control panel, not a hiding place.
//!
//! The tray icon is created in Rust rather than from the frontend, because
//! the menu has to exist before the window does.

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::{SHOW_EVENT, TOGGLE_EVENT};

/// The tray's state, as the frontend sees it.
///
/// The frontend sends this on every change so the tooltip and the menu
/// describe the timer as it actually is. A tray that lies is worse than no
/// tray at all.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayState {
  /// The phase currently running, as `work`, `shortBreak` or `longBreak`.
  pub phase: String,
  /// The formatted time left, such as `24:58`.
  pub remaining: String,
  /// Whether the timer is running.
  pub running: bool,
}

impl Default for TrayState {
  fn default() -> Self {
    TrayState {
      phase: "work".to_string(),
      remaining: "25:00".to_string(),
      running: false,
    }
  }
}

/// The identifiers of the tray's menu items.
const MENU_TOGGLE: &str = "toggle";
const MENU_SHOW: &str = "show";
const MENU_QUIT: &str = "quit";

/// The id of the tray icon.
///
/// The icon is looked up by this id rather than as managed state: a lookup
/// by state panics when the icon has not been registered, and a panic in a
/// command handler takes the whole app down.
pub const TRAY_ID: &str = "pomodoro-tray";

/// Installs the tray icon and its menu.
pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
  let show = MenuItem::with_id(app, MENU_SHOW, "Show Pomodoro", true, None::<&str>)?;
  let toggle = MenuItem::with_id(app, MENU_TOGGLE, "Start / pause", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, MENU_QUIT, "Quit Pomodoro", true, None::<&str>)?;
  let separator = PredefinedMenuItem::separator(app)?;
  let menu = Menu::with_items(app, &[&show, &toggle, &separator, &quit])?;

  TrayIconBuilder::with_id(TRAY_ID)
    .icon(app.default_window_icon().cloned().unwrap())
    .tooltip("Pomodoro: 25:00")
    .menu(&menu)
    // A left click shows the menu rather than doing something surprising, so
    // a mis-click cannot start or stop the timer by accident.
    .show_menu_on_left_click(true)
    .on_menu_event(move |app, event| match event.id.as_ref() {
      MENU_TOGGLE => {
        let _ = app.emit(TOGGLE_EVENT, ());
      }
      MENU_SHOW => {
        focus_main(app);
      }
      MENU_QUIT => {
        app.exit(0);
      }
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      // A double click on the tray icon brings the window forward, which is
      // what a user does when they want to look at the timer.
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        focus_main(tray.app_handle());
      }
    })
    .build(app)?;

  Ok(())
}

/// Applies a new state to the tray icon.
pub fn apply<R: Runtime>(tray: &tauri::tray::TrayIcon<R>, state: &TrayState) {
  let status = if state.running { "running" } else { "paused" };
  let tooltip = format!("Pomodoro: {} ({status})", state.remaining);

  if let Err(error) = tray.set_tooltip(Some(&tooltip)) {
    log::warn!("the tray tooltip could not be set: {error}");
  }
}

/// Brings the main window forward, creating it if it is not there.
pub fn focus_main<R: Runtime>(app: &AppHandle<R>) {
  let Some(window) = app.get_webview_window("main") else {
    let _ = app.emit(SHOW_EVENT, ());
    return;
  };

  let _ = window.show();
  let _ = window.unminimize();
  let _ = window.set_focus();
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn the_default_state_is_a_paused_focus_session() {
    let state = TrayState::default();
    assert_eq!(state.phase, "work");
    assert_eq!(state.remaining, "25:00");
    assert!(!state.running);
  }

  #[test]
  fn the_state_round_trips_through_json() {
    // The frontend sends the state as JSON, and the field names are
    // camel-cased, so a rename on either side would silently break the
    // tray's tooltip.
    let state = TrayState {
      phase: "shortBreak".to_string(),
      remaining: "04:59".to_string(),
      running: true,
    };

    let json = serde_json::to_string(&state).expect("the state serialises");
    assert!(json.contains("\"remaining\""));
    assert!(json.contains("\"running\""));

    let parsed: TrayState = serde_json::from_str(&json).expect("the state deserialises");
    assert_eq!(parsed.phase, "shortBreak");
    assert_eq!(parsed.remaining, "04:59");
    assert!(parsed.running);
  }
}
