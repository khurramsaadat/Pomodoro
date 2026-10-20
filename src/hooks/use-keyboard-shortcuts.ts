import { useEffect } from 'react';

/** The actions the shortcuts drive. */
export interface KeyboardShortcutActions {
  /** Starts or pauses the timer. */
  readonly toggle: () => void;
  /** Skips to the next phase. */
  readonly skip: () => void;
  /** Resets the current phase. */
  readonly reset: () => void;
}

/**
 * Keyboard shortcuts for the primary timer actions.
 *
 * Start/pause, skip and reset are all frequent actions, and all three
 * otherwise require a mouse.
 *
 * The bindings are ignored whenever the focus is in a text field, which is
 * where a task title or a preference is being typed — so a bare letter is
 * safe after all, and no modifier is required.
 */
export function useKeyboardShortcuts({ toggle, skip, reset }: KeyboardShortcutActions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // A shortcut must not fire while the user is typing.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      // The user may be holding a modifier for their own shortcut.
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      switch (event.key) {
        case ' ':
        case 'k':
        case 'K':
          // Space is also the key that activates a focused button, so it is
          // ignored when one has the focus — otherwise the timer would
          // toggle twice for a single press.
          if (event.key === ' ' && isActivatable(target)) {
            return;
          }
          event.preventDefault();
          toggle();
          return;
        case 'ArrowRight':
        case 'j':
        case 'J':
          event.preventDefault();
          skip();
          return;
        case 'ArrowLeft':
        case 'l':
        case 'L':
          event.preventDefault();
          reset();
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [toggle, skip, reset]);
}

/**
 * Whether the focused element is one that space or enter would activate.
 *
 * A button, a link, or a checkbox all treat space as their own trigger, so
 * the global space shortcut has to step aside for them.
 */
function isActivatable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  return (
    tag === 'BUTTON' ||
    tag === 'A' ||
    tag === 'SUMMARY' ||
    target.getAttribute('role') === 'button' ||
    target.getAttribute('role') === 'checkbox' ||
    target.getAttribute('role') === 'switch'
  );
}
