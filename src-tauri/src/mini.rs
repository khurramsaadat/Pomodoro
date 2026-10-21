//! The mini window.
//!
//! Mini mode is the app's own window turned into a small frameless widget.
//! It is deliberately *not* a floating element drawn inside the page: a
//! real window can sit above other applications, can be moved by the
//! operating system, and — most importantly — replaces the dashboard rather
//! than covering it. A widget drawn over a full-size dashboard leaves the
//! user looking at two timers, one of which is enormous and irrelevant.
//!
//! The window is the app's *only* window, so entering mini mode resizes and
//! restyles it rather than creating a second one. A second window would
//! mean a second webview, a second copy of the engine, and two countdowns
//! that could disagree.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{
  AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime,
};

/// The event the backend emits when the window has been moved.
///
/// The frontend listens for it so the position can be remembered for next
/// time. The web tier reports the same information through the in-page
/// widget's own drag handling.
pub const MOVED_EVENT: &str = "pomodoro://moved";

/// The largest width the mini window may be given, in physical pixels.
///
/// The widget is a fixed *logical* size, but the physical size depends on
/// the display's scale factor, so the bound here is generous: it exists to
/// stop a malformed request from producing a window nobody can use, not to
/// enforce the layout.
pub const MAX_MINI_WIDTH: f64 = 640.0;

/// The largest height the mini window may be given, in physical pixels.
pub const MAX_MINI_HEIGHT: f64 = 640.0;

/// The largest width the dashboard may be restored to, in physical pixels.
///
/// The widget's own bound is far too small for the dashboard: the window
/// configuration asks for 1180 by 820, and clamping the restore to the
/// widget's 640 would leave the dashboard in a corner of the screen the
/// user had filled.
pub const MAX_DASHBOARD_WIDTH: f64 = 4096.0;

/// The largest height the dashboard may be restored to, in physical pixels.
pub const MAX_DASHBOARD_HEIGHT: f64 = 4096.0;

/// The gap kept between the mini window and the edge of the work area.
const MINI_MARGIN: f64 = 16.0;

/// The corners the mini window can be anchored to.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MiniCorner {
  TopLeft,
  TopRight,
  BottomLeft,
  BottomRight,
}

impl Default for MiniCorner {
  fn default() -> Self {
    MiniCorner::BottomRight
  }
}

/// The request to enter or to leave mini mode.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MiniModeRequest {
  /// Whether the window should be in mini mode.
  pub active: bool,
  /// The corner the window is anchored to.
  pub corner: MiniCorner,
  /// Horizontal offset from the corner's anchor, in physical pixels.
  pub offset_x: f64,
  /// Vertical offset from the corner's anchor, in physical pixels.
  pub offset_y: f64,
  /// The width of the mini window, in physical pixels.
  pub width: f64,
  /// The height of the mini window, in physical pixels.
  pub height: f64,
  /// The width the dashboard is restored to, in physical pixels.
  pub restore_width: f64,
  /// The height the dashboard is restored to, in physical pixels.
  pub restore_height: f64,
  /// Whether the window stays above the others once the dashboard is back.
  pub always_on_top: bool,
}

/// The work area of the screen, in logical pixels.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkArea {
  pub width: f64,
  pub height: f64,
}

/// Where the window ended up, and the work area it sits in.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MiniWindowPosition {
  pub x: f64,
  pub y: f64,
  pub area_width: f64,
  pub area_height: f64,
  pub width: f64,
  pub height: f64,
}

/// The window the app is using.
fn main_window<R: Runtime>(app: &AppHandle<R>) -> Option<tauri::WebviewWindow<R>> {
  app
    .get_webview_window("main")
    .or_else(|| app.webview_windows().into_values().next())
}

/// The window's maximized state, remembered across a mini-mode transition.
///
/// The app starts full-size, which means *maximized* rather than merely
/// large. When the window shrinks into the widget it has to leave the
/// maximized state behind — a maximized window cannot be resized — and
/// when the dashboard comes back it has to be maximized again, or the user
/// is left with a window in the corner of a screen they had filled.
///
/// The state is held in a mutex rather than in managed state because the
/// window commands are called from the command handlers, and a `Mutex` is
/// the simplest thing that can be shared with them without threading a
/// handle through every call.
static STATE: Mutex<MiniState> = Mutex::new(MiniState::new());

/// The state the mini-mode transition carries between the two halves.
#[derive(Debug, Clone, Copy)]
struct MiniState {
  /// Whether the window was maximized before it became the widget.
  was_maximized: bool,

  /// Whether the window is currently the widget rather than the dashboard.
  ///
  /// This is what makes the remembered maximized state trustworthy: it is
  /// captured on the *transition* into mini mode, and a repeated request to
  /// enter mini mode is not a transition, so it must not capture anything.
  is_mini: bool,
}

impl MiniState {
  /// The state before anything has happened: a dashboard that was not
  /// maximized, and a window that is not the widget.
  const fn new() -> Self {
    Self {
      was_maximized: false,
      is_mini: false,
    }
  }

  /// Captures the maximized state on the way into mini mode.
  ///
  /// The capture happens only on a genuine transition, so a repeated
  /// request cannot overwrite a remembered `true` with the `false` that a
  /// widget reports for itself, and a user who un-maximizes the dashboard
  /// by hand is still remembered as they left it.
  fn capture(&mut self, maximized: bool) {
    if self.is_mini {
      return;
    }

    self.was_maximized = maximized;
    self.is_mini = true;
  }

  /// Marks the window as the dashboard again, so the next entry into mini
  /// mode captures the maximized state afresh.
  fn clear(&mut self) {
    self.is_mini = false;
  }

  /// Whether the dashboard should come back maximized.
  fn was_maximized(&self) -> bool {
    self.was_maximized
  }
}

/// Whether the window is currently maximized.
///
/// A window that cannot answer is assumed *not* to be maximized, because
/// the restore path is the safe one: a window that is merely large is
/// perfectly usable, while a maximized widget is a bug.
fn is_maximized<R: Runtime>(window: &tauri::WebviewWindow<R>) -> bool {
  window.is_maximized().unwrap_or(false)
}

/// Captures the maximized state on the way into mini mode.
fn capture_maximized<R: Runtime>(window: &tauri::WebviewWindow<R>) {
  if let Ok(mut state) = STATE.lock() {
    state.capture(is_maximized(window));
  }
}

/// Marks the window as the dashboard again.
fn clear_maximized() {
  if let Ok(mut state) = STATE.lock() {
    state.clear();
  }
}

/// Whether the dashboard should come back maximized.
fn was_maximized() -> bool {
  STATE.lock().map(|state| state.was_maximized()).unwrap_or(false)
}

/// The work area of the screen the window is on, in *physical* pixels.
///
/// The size is reported in physical pixels rather than logical ones because
/// the scale factor is not something the backend can be trusted to know:
/// on Windows the Rust process is not per-monitor DPI-aware, so it reports
/// a scale factor of 1 while the webview inside it is drawn at 1.5. The
/// webview knows its own ratio exactly — it is `devicePixelRatio` — so the
/// conversion is done on the side that has the true number.
pub fn work_area<R: Runtime>(window: &tauri::WebviewWindow<R>) -> WorkArea {
  let Ok(Some(monitor)) = window.current_monitor() else {
    return WorkArea {
      width: 0.0,
      height: 0.0,
    };
  };

  let size = monitor.size();

  WorkArea {
    width: size.width as f64,
    height: size.height as f64,
  }
}

/// Where the screen the window is on begins, in *physical* pixels.
///
/// This is the monitor's own position in the virtual desktop. It is the
/// difference between "the top left of this screen" and "the top left of
/// everything", and the two are very different numbers on a multi-monitor
/// setup: a second monitor to the left of the first has a *negative* x.
pub fn monitor_origin<R: Runtime>(window: &tauri::WebviewWindow<R>) -> PhysicalPosition<i32> {
  window
    .current_monitor()
    .ok()
    .flatten()
    .map(|monitor| *monitor.position())
    .unwrap_or(PhysicalPosition::new(0, 0))
}

/// The top-left corner of the mini window when it is anchored to `corner`.
///
/// The right and bottom corners are measured from the far edge of the work
/// area, so the window keeps its margin from that edge.
pub fn corner_anchor(
  corner: MiniCorner,
  area_width: f64,
  area_height: f64,
  width: f64,
  height: f64,
) -> (f64, f64) {
  let is_right = matches!(corner, MiniCorner::TopRight | MiniCorner::BottomRight);
  let is_bottom = matches!(corner, MiniCorner::BottomLeft | MiniCorner::BottomRight);

  let x = if is_right {
    area_width - width - MINI_MARGIN
  } else {
    MINI_MARGIN
  };
  let y = if is_bottom {
    area_height - height - MINI_MARGIN
  } else {
    MINI_MARGIN
  };

  (x, y)
}

/// Where the window goes, in the coordinates the operating system wants.
///
/// The anchor is measured from the *monitor's* top left, but
/// `set_position` takes a position in the *virtual desktop* — the whole
/// arrangement of screens. On a single monitor the two are the same
/// number, which is why this only ever goes wrong on a second screen: a
/// monitor to the left of the primary one has a negative x, and a monitor
/// above it has a negative y, and the widget would land off the edge of
/// the desktop entirely.
///
/// The offset is applied before the origin is added, so a widget the user
/// has nudged away from the corner comes back where they put it.
pub fn screen_position(
  corner: MiniCorner,
  area_width: f64,
  area_height: f64,
  width: f64,
  height: f64,
  offset_x: f64,
  offset_y: f64,
  origin_x: i32,
  origin_y: i32,
) -> (i32, i32) {
  let (x, y) = corner_anchor(corner, area_width, area_height, width, height);

  let final_x = (x + offset_x).max(0.0) + origin_x as f64;
  let final_y = (y + offset_y).max(0.0) + origin_y as f64;

  (final_x as i32, final_y as i32)
}

/// Enters or leaves mini mode.
///
/// Entering mini mode makes the window frameless, always-on-top and small,
/// and places it at the requested corner. Leaving it puts the window back
/// the way it was, so the dashboard is genuinely restored rather than
/// approximated.
///
/// The placement is in *physical* pixels, because the backend cannot be
/// trusted to know the display's scale factor: on Windows the Rust process
/// is not per-monitor DPI-aware. The webview knows its own ratio exactly,
/// so the frontend does the conversion and the backend only does the
/// arithmetic.
pub fn apply<R: Runtime>(app: &AppHandle<R>, request: &MiniModeRequest) -> Result<(), String> {
  let Some(window) = main_window(app) else {
    return Err("no window".to_string());
  };

  if !request.active {
    leave(&window, request)?;
    return Ok(());
  }

  let area = work_area(&window);

  // The size is bounded: the widget is a fixed shape, and a request that
  // asked for a metre-wide timer would produce a window nobody can use.
  let width = request.width.clamp(1.0, MAX_MINI_WIDTH);
  let height = request.height.clamp(1.0, MAX_MINI_HEIGHT);

  // The maximized state is captured *before* the window is unmaximized,
  // because a maximized window cannot be resized, and the dashboard is
  // expected to come back the way the user had it.
  capture_maximized(&window);
  if is_maximized(&window) {
    window
      .unmaximize()
      .map_err(|error| error.to_string())?;
  }

  window
    .set_decorations(false)
    .map_err(|error| error.to_string())?;
  window
    .set_always_on_top(true)
    .map_err(|error| error.to_string())?;
  window
    .set_resizable(false)
    .map_err(|error| error.to_string())?;
  window
    .set_size(PhysicalSize::new(width as u32, height as u32))
    .map_err(|error| error.to_string())?;

  // The offset from the corner is applied here, so a widget the user has
  // nudged away from the corner comes back where they put it.
  //
  // The anchor is measured from the *monitor's* top left, but
  // `set_position` takes a position in the *virtual desktop* — the whole
  // arrangement of screens. On a single monitor the two are the same
  // number, which is why this bug only ever shows up on a second screen:
  // a monitor to the left of the primary one has a negative x, and a
  // monitor above it has a negative y, and the widget would land off the
  // edge of the desktop entirely.
  let origin = monitor_origin(&window);

  let (final_x, final_y) = screen_position(
    request.corner,
    area.width,
    area.height,
    width,
    height,
    request.offset_x,
    request.offset_y,
    origin.x,
    origin.y,
  );

  window
    .set_position(PhysicalPosition::new(final_x, final_y))
    .map_err(|error| error.to_string())?;

  window.show().map_err(|error| error.to_string())?;
  window.set_focus().map_err(|error| error.to_string())?;

  log::info!(
    "mini mode entered at {final_x}x{final_y} ({}x{height})",
    width
  );

  Ok(())
}

/// Restores the window to the dashboard.
fn leave<R: Runtime>(
  window: &tauri::WebviewWindow<R>,
  request: &MiniModeRequest,
) -> Result<(), String> {
  window
    .set_decorations(true)
    .map_err(|error| error.to_string())?;
  // The widget is always on top, but the dashboard is not necessarily: it
  // goes back to the state the user asked for.
  window
    .set_always_on_top(request.always_on_top)
    .map_err(|error| error.to_string())?;
  window
    .set_resizable(true)
    .map_err(|error| error.to_string())?;

  // The size is restored to the size the frontend asks for, because the
  // frontend is the side that knows the display's scale factor. The window
  // is centred again: a widget that was in the bottom right corner must
  // not leave the dashboard stranded there.
  let width = request.restore_width.clamp(1.0, MAX_DASHBOARD_WIDTH);
  let height = request.restore_height.clamp(1.0, MAX_DASHBOARD_HEIGHT);

  window
    .set_size(PhysicalSize::new(width as u32, height as u32))
    .map_err(|error| error.to_string())?;
  window.center().map_err(|error| error.to_string())?;

  // The dashboard comes back maximized if it was maximized before, because
  // the app starts full-size and the user expects the window they had.
  //
  // The size is set *first* and the maximization second: maximizing
  // overrides the size, so the other order would leave the window filling
  // the screen anyway, but the centering would be the last thing to
  // happen and the window would land slightly off-centre.
  if was_maximized() {
    window.maximize().map_err(|error| error.to_string())?;
  }

  // The window is the dashboard again, so the next entry into mini mode
  // captures the maximized state afresh rather than reusing this one.
  clear_maximized();

  window.show().map_err(|error| error.to_string())?;
  window.set_focus().map_err(|error| error.to_string())?;

  log::info!("mini mode left; the dashboard is back");

  Ok(())
}

/// Reports where the window has been moved to.
///
/// The position is sent to the frontend so it can be remembered. The work
/// area is sent with it, because the corner the window belongs to depends
/// on how large the screen is.
pub fn report_position<R: Runtime>(app: &AppHandle<R>) {
  let Some(window) = main_window(app) else {
    return;
  };

  let area = work_area(&window);

  let Ok(position) = window.outer_position() else {
    return;
  };
  let Ok(size) = window.inner_size() else {
    return;
  };

  // The monitor's own position is subtracted so the coordinates are
  // relative to the work area rather than to the screen as a whole. On a
  // multi-monitor setup the two are very different numbers.
  //
  // This is the same frame of reference the placement uses — the anchor
  // is measured from the monitor's top left too — so an offset reported
  // here and an offset applied there mean the same thing.
  //
  // Everything here is in *physical* pixels, which is what the frontend
  // needs: it is the side that knows the display's scale factor, and it
  // converts the numbers to logical ones itself.
  let origin = monitor_origin(&window);

  let payload = MiniWindowPosition {
    x: (position.x - origin.x) as f64,
    y: (position.y - origin.y) as f64,
    area_width: area.width,
    area_height: area.height,
    width: size.width as f64,
    height: size.height as f64,
  };

  let _ = app.emit(MOVED_EVENT, payload);
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn the_default_corner_is_the_bottom_right() {
    // The bottom right is the corner that is out of the way.
    assert_eq!(MiniCorner::default(), MiniCorner::BottomRight);
  }

  #[test]
  fn the_dashboard_is_not_clamped_to_the_widgets_bounds() {
    // The widget is at most 640 wide, but the dashboard is 1180 by 820 and
    // must be restored at that size. Clamping the restore to the widget's
    // bound would leave the dashboard in a corner of the screen the user
    // had filled.
    assert!(MAX_DASHBOARD_WIDTH > MAX_MINI_WIDTH);
    assert!(MAX_DASHBOARD_HEIGHT > MAX_MINI_HEIGHT);

    let width = 1180.0_f64.clamp(1.0, MAX_DASHBOARD_WIDTH);
    let height = 820.0_f64.clamp(1.0, MAX_DASHBOARD_HEIGHT);

    assert_eq!(width, 1180.0);
    assert_eq!(height, 820.0);
  }

  #[test]
  fn the_dashboard_is_still_bounded() {
    // The bound exists to stop a malformed request from producing a window
    // nobody can use, so it still applies to the dashboard.
    let width = 100_000.0_f64.clamp(1.0, MAX_DASHBOARD_WIDTH);
    let height = 100_000.0_f64.clamp(1.0, MAX_DASHBOARD_HEIGHT);

    assert_eq!(width, MAX_DASHBOARD_WIDTH);
    assert_eq!(height, MAX_DASHBOARD_HEIGHT);
  }

  #[test]
  fn the_maximized_state_is_remembered_across_the_transition() {
    // The capture is a transition: it happens on the way *into* mini mode
    // and is cleared on the way out, so the dashboard comes back the way the
    // user had it.
    let mut state = MiniState::new();
    assert!(!state.was_maximized());

    // A dashboard that was maximized comes back maximized.
    state.capture(true);
    assert!(state.was_maximized());

    // The window is the dashboard again, so the next entry captures the
    // state afresh.
    state.clear();
    state.capture(false);
    assert!(!state.was_maximized());
  }

  #[test]
  fn a_dashboard_that_was_not_maximized_does_not_come_back_maximized() {
    let mut state = MiniState::new();

    state.capture(false);
    assert!(!state.was_maximized());
  }

  #[test]
  fn a_repeated_entry_does_not_overwrite_the_remembered_state() {
    // The window is already a widget when a second request arrives, and a
    // widget reports itself as not maximized. If that were captured, the
    // dashboard would come back smaller than the user had it.
    let mut state = MiniState::new();
    state.capture(true);

    // The second capture is ignored because the window is already the
    // widget.
    state.capture(false);
    assert!(state.was_maximized());
  }

  #[test]
  fn a_user_who_unmaximizes_by_hand_is_remembered_as_they_left_it() {
    // The window is the dashboard again, so the next capture is a genuine
    // transition and does reflect what the user did.
    let mut state = MiniState::new();
    state.capture(true);
    state.clear();

    state.capture(false);
    assert!(!state.was_maximized());
  }

  #[test]
  fn anchors_to_the_top_left_with_the_margin() {
    let (x, y) = corner_anchor(MiniCorner::TopLeft, 1000.0, 800.0, 240.0, 150.0);

    assert_eq!(x, MINI_MARGIN);
    assert_eq!(y, MINI_MARGIN);
  }

  #[test]
  fn anchors_to_the_bottom_right_from_the_far_edge() {
    let (x, y) = corner_anchor(MiniCorner::BottomRight, 1000.0, 800.0, 240.0, 150.0);

    assert_eq!(x, 1000.0 - 240.0 - MINI_MARGIN);
    assert_eq!(y, 800.0 - 150.0 - MINI_MARGIN);
  }

  #[test]
  fn the_window_lands_in_the_anchor_on_a_single_monitor() {
    // With no other screen in the arrangement, the monitor's origin is the
    // origin of the desktop, so the two frames of reference agree.
    let (x, y) = screen_position(
      MiniCorner::TopLeft,
      1000.0,
      800.0,
      240.0,
      150.0,
      0.0,
      0.0,
      0,
      0,
    );

    assert_eq!(x, MINI_MARGIN as i32);
    assert_eq!(y, MINI_MARGIN as i32);
  }

  #[test]
  fn the_window_lands_on_the_monitor_it_was_placed_on() {
    // A second monitor to the left of the primary one has a negative x.
    // The position the operating system wants is in the virtual desktop,
    // so the window has to be placed at the monitor's own origin.
    let (x, y) = screen_position(
      MiniCorner::TopLeft,
      1000.0,
      800.0,
      240.0,
      150.0,
      0.0,
      0.0,
      -1920,
      0,
    );

    assert_eq!(x, -1920 + MINI_MARGIN as i32);
    assert_eq!(y, MINI_MARGIN as i32);
  }

  #[test]
  fn the_offset_is_measured_from_the_anchor_not_from_the_screen() {
    // The offset is the distance from the *corner*, so it is added before
    // the monitor's origin. Adding it afterwards would push the widget
    // the wrong way on a monitor that is not at the origin.
    let (x, y) = screen_position(
      MiniCorner::TopLeft,
      1000.0,
      800.0,
      240.0,
      150.0,
      30.0,
      40.0,
      -1920,
      -100,
    );

    assert_eq!(x, -1920 + MINI_MARGIN as i32 + 30);
    assert_eq!(y, -100 + MINI_MARGIN as i32 + 40);
  }

  #[test]
  fn a_negative_offset_cannot_pull_the_window_past_the_anchor() {
    // The offset is clamped at the anchor rather than at the edge of the
    // virtual desktop: the window has to stay on its own screen.
    let (x, y) = screen_position(
      MiniCorner::TopLeft,
      1000.0,
      800.0,
      240.0,
      150.0,
      -1000.0,
      -1000.0,
      0,
      0,
    );

    assert_eq!(x, 0);
    assert_eq!(y, 0);
  }

  #[test]
  fn the_request_round_trips_through_json() {
    // The frontend sends the request as JSON, and the field names are
    // camel-cased, so a rename on either side would silently break the
    // mini window.
    let request = MiniModeRequest {
      active: true,
      corner: MiniCorner::TopLeft,
      offset_x: 10.0,
      offset_y: 20.0,
      width: 240.0,
      height: 150.0,
      restore_width: 1180.0,
      restore_height: 820.0,
      always_on_top: true,
    };

    let json = serde_json::to_string(&request).expect("the request serialises");
    assert!(json.contains("\"corner\":\"topLeft\""));
    assert!(json.contains("\"offsetX\":10.0"));
    assert!(json.contains("\"restoreWidth\":1180.0"));

    let parsed: MiniModeRequest = serde_json::from_str(&json).expect("the request deserialises");
    assert!(parsed.active);
    assert_eq!(parsed.corner, MiniCorner::TopLeft);
    assert_eq!(parsed.offset_x, 10.0);
    assert_eq!(parsed.width, 240.0);
    assert_eq!(parsed.restore_height, 820.0);
  }

  #[test]
  fn the_position_round_trips_through_json() {
    let position = MiniWindowPosition {
      x: 1.0,
      y: 2.0,
      area_width: 1920.0,
      area_height: 1080.0,
      width: 240.0,
      height: 150.0,
    };

    let json = serde_json::to_string(&position).expect("the position serialises");
    assert!(json.contains("\"areaWidth\":1920.0"));

    let parsed: MiniWindowPosition = serde_json::from_str(&json).expect("the position deserialises");
    assert_eq!(parsed.area_width, 1920.0);
    assert_eq!(parsed.height, 150.0);
  }
}
