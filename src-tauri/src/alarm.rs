//! The deadline-driven native alarm.
//!
//! The countdown in the app is drawn from a deadline: `endsAt - now()`. That
//! is what makes it immune to a throttled or suspended webview. The alarm
//! here is scheduled against that *same* deadline, which is the only way a
//! notification can be correct — a timer that fires "roughly when the phase
//! ends" is a timer that is wrong in exactly the way a user notices.
//!
//! The alarm runs on a dedicated thread rather than on the webview's event
//! loop, because the whole point of the native tier is that the notification
//! does not depend on the webview being alive.

use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, UserAttentionType};
use tauri_plugin_notification::NotificationExt;

/// The event emitted when the alarm fires, so the frontend can bring the
/// countdown forward and play its own chime.
const ALARM_EVENT: &str = "pomodoro://alarm";

/// The payload the alarm event carries.
///
/// The deadline travels with the phase because the webview may have been
/// asleep when the alarm fired: the frontend has to be able to tell that
/// this alarm is about the phase it is showing, rather than about one that
/// ended long ago.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlarmSignal {
  /// The phase that ended.
  pub phase: String,
  /// The deadline the alarm was scheduled against, in epoch milliseconds.
  pub ends_at: i64,
}

/// How long the thread waits when nothing is scheduled.
///
/// It is only reached after a `Clear`, and it exists so the thread notices
/// a dropped channel rather than blocking on it forever.
const IDLE_WAIT_MS: u64 = 60_000;

/// A request to the alarm thread.
enum Request {
  /// Schedule an alarm for a deadline.
  Set {
    ends_at: i64,
    phase: String,
    notify: bool,
    attention: bool,
  },
  /// Cancel any scheduled alarm.
  Clear,
}

/// An alarm that is waiting for its deadline.
struct Pending {
  ends_at: i64,
  phase: String,
  notify: bool,
  attention: bool,
}

/// The handle the rest of the app uses to talk to the alarm thread.
#[derive(Clone)]
pub struct Alarm {
  sender: Sender<Request>,
}

impl Alarm {
  /// Starts the alarm thread and returns the handle to it.
  pub fn new(app: AppHandle) -> Self {
    let (sender, receiver) = channel::<Request>();

    thread::Builder::new()
      .name("pomodoro-alarm".to_string())
      .spawn(move || run(app, receiver))
      .expect("the alarm thread could not be started");

    Alarm { sender }
  }

  /// Schedules an alarm for a deadline, replacing any previous one.
  pub fn set(&self, ends_at: i64, phase: String, notify: bool, attention: bool) {
    let _ = self.sender.send(Request::Set {
      ends_at,
      phase,
      notify,
      attention,
    });
  }

  /// Cancels any scheduled alarm.
  pub fn clear(&self) {
    let _ = self.sender.send(Request::Clear);
  }
}

/// The alarm thread.
///
/// It sleeps until the next deadline, wakes, fires the notification, and then
/// waits for the next request. A new request interrupts the sleep, so
/// starting or pausing the timer takes effect immediately rather than at the
/// next deadline.
fn run(app: AppHandle, receiver: Receiver<Request>) {
  // The deadline the thread is currently waiting for, if any.
  let mut pending: Option<Pending> = None;

  loop {
    // How long the thread may sleep before it must act.
    //
    // With nothing scheduled the thread waits for a request rather than for
    // a deadline, so the wait is bounded by a long interval instead.
    let wait = match pending.as_ref() {
      Some(current) => {
        let remaining = current.ends_at - now_ms();
        if remaining <= 0 {
          // The deadline has already passed. Fire and wait for the next
          // request rather than sleeping for a negative duration.
          fire(
            &app,
            &current.phase,
            current.ends_at,
            current.notify,
            current.attention,
          );
          pending = None;
          match receiver.recv() {
            Ok(Request::Set {
              ends_at,
              phase,
              notify,
              attention,
            }) => {
              pending = Some(Pending {
                ends_at,
                phase,
                notify,
                attention,
              });
            }
            Ok(Request::Clear) => {}
            Err(_) => return,
          }
          continue;
        }
        Duration::from_millis(remaining as u64)
      }
      None => {
        match receiver.recv() {
          Ok(Request::Set {
            ends_at,
            phase,
            notify,
            attention,
          }) => {
            pending = Some(Pending {
              ends_at,
              phase,
              notify,
              attention,
            });
            continue;
          }
          Ok(Request::Clear) => {}
          Err(_) => return,
        }
        Duration::from_millis(IDLE_WAIT_MS)
      }
    };

    match receiver.recv_timeout(wait) {
      Ok(Request::Set {
        ends_at,
        phase,
        notify,
        attention,
      }) => {
        pending = Some(Pending {
          ends_at,
          phase,
          notify,
          attention,
        });
      }
      Ok(Request::Clear) => {
        pending = None;
      }
      Err(RecvTimeoutError::Timeout) => {
        // The wait elapsed, so the deadline is due.
        if let Some(current) = pending.take() {
          fire(
            &app,
            &current.phase,
            current.ends_at,
            current.notify,
            current.attention,
          );
        }
      }
      Err(RecvTimeoutError::Disconnected) => return,
    }
  }
}

/// Fires the scheduled alarm.
///
/// The notification text is built here rather than being sent from the
/// frontend, so the notification is right even if the webview has gone away.
///
/// The two flags are the user's preferences, carried with the alarm rather
/// than read at the moment it fires: this thread cannot ask the page
/// anything, because the page may be asleep.
fn fire(app: &AppHandle, phase: &str, ends_at: i64, notify: bool, attention: bool) {
  let (title, body) = describe(phase);

  // The notification is a preference, not a fact about the timer. A user
  // who has turned it off should not see a toast, even though the phase
  // still completes.
  if notify {
    if let Err(error) = app
      .notification()
      .builder()
      .title(title)
      .body(body)
      .sound(NOTIFICATION_SOUND)
      .show()
    {
      log::warn!("the notification could not be shown: {error}");
    } else {
      log::info!("the notification for {phase} was shown");
    }
  }

  // The attention request is the taskbar flash. It asks the window to be
  // noticed without bringing it forward, because a timer that steals focus
  // interrupts the very work it was set up to protect.
  if attention {
    if let Some(window) = app.get_webview_window("main") {
      // `None` is not "the gentlest request", it is a *cancellation*: the
      // parameter is the request to make, and the only way to ask for
      // attention is to name a kind of it. Informational is the gentle one
      // — the taskbar button flashes and the window stays where it is.
      match window.request_user_attention(Some(UserAttentionType::Informational)) {
        Ok(()) => log::info!("the window asked for attention"),
        Err(error) => log::warn!("the window could not ask for attention: {error}"),
      }
    }
  }

  // The frontend is told as well, so its own chime and toast still run when
  // the window happens to be visible.
  //
  // The deadline travels with the phase, because the webview may have been
  // asleep when the alarm fired: the app has to be able to tell that this
  // alarm is about the phase it is showing, rather than about one that
  // ended long ago.
  let _ = app.emit(
    ALARM_EVENT,
    AlarmSignal {
      phase: phase.to_string(),
      ends_at,
    },
  );
}

/// The sound the system notification plays.
///
/// The notification is the desktop tier's *only* cue when the window is
/// hidden, so a silent notification is a timer that says nothing. The
/// sound is one of the names the Windows notification system understands;
/// it is ignored on the platforms that have no such notion.
const NOTIFICATION_SOUND: &str = "Reminder";

/// The notification text for a phase.
fn describe(phase: &str) -> (String, String) {
  if phase == "work" {
    (
      "Focus session complete".to_string(),
      "Take a break. You have earned it.".to_string(),
    )
  } else {
    ("Break over".to_string(), "Back to work.".to_string())
  }
}

/// The current time in epoch milliseconds.
fn now_ms() -> i64 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn describes_a_focus_session_as_a_completion() {
    let (title, body) = describe("work");
    assert!(title.contains("complete"));
    assert!(!body.is_empty());
  }

  #[test]
  fn describes_a_break_as_being_over() {
    let (title, _) = describe("shortBreak");
    assert!(title.contains("Break over"));
  }

  #[test]
  fn an_unknown_phase_is_treated_as_a_break() {
    // A phase the backend does not know about must not produce an empty
    // notification; a break is the safe default.
    let (title, body) = describe("somethingNew");
    assert!(!title.is_empty());
    assert!(!body.is_empty());
  }

  #[test]
  fn the_clock_is_read_from_the_system() {
    // The alarm is scheduled against an absolute deadline, so the clock it
    // reads has to be the real one.
    let now = now_ms();
    assert!(now > 1_600_000_000_000, "the clock reads {now}");
  }
}
