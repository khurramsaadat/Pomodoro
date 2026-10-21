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

  let (x, y) = corner_anchor(request.corner, area.width, area.height, width, height);

  // The offset from the corner is applied here, so a widget the user has
  // nudged away from the corner comes back where they put it.
  let final_x = (x + request.offset_x).max(0.0);
  let final_y = (y + request.offset_y).max(0.0);

  window
    .set_position(PhysicalPosition::new(final_x as i32, final_y as i32))
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
  let width = request.restore_width.clamp(1.0, MAX_MINI_WIDTH);
  let height = request.restore_height.clamp(1.0, MAX_MINI_HEIGHT);

  window
    .set_size(PhysicalSize::new(width as u32, height as u32))
    .map_err(|error| error.to_string())?;
  window.center().map_err(|error| error.to_string())?;
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
  // Everything here is in *physical* pixels, which is what the frontend
  // needs: it is the side that knows the display's scale factor, and it
  // converts the numbers to logical ones itself.
  let monitor_origin = window
    .current_monitor()
    .ok()
    .flatten()
    .map(|monitor| *monitor.position())
    .unwrap_or(PhysicalPosition::new(0, 0));

  let payload = MiniWindowPosition {
    x: (position.x - monitor_origin.x) as f64,
    y: (position.y - monitor_origin.y) as f64,
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
