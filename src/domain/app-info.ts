/**
 * The app's own metadata.
 *
 * The About dialog needs to say what this program is, and it needs to say
 * it without reaching into the build system: the version is a *fact* about
 * the app, and the fact lives here so that the dialog, the manifest and
 * the test that guards them can all agree on one answer.
 *
 * The version is kept in step with `package.json` and `tauri.conf.json` by
 * a test, because a version that is only right in one of the three places
 * is a version the user cannot rely on.
 */

/** The name the app calls itself. */
export const APP_NAME = 'Pomodoro';

/** The version of the app. */
export const APP_VERSION = '0.1.0';

/** The one-line description of what the app is. */
export const APP_TAGLINE = 'Focus deliberately. Break fully.';

/** Who made it. */
export const APP_AUTHOR = 'Khurram';

/** The copyright line, which is also the footer's. */
export const APP_COPYRIGHT = `© 2006 ${APP_NAME} by ${APP_AUTHOR}`;

/** The identifier the desktop app registers itself under. */
export const APP_IDENTIFIER = 'com.khurram.pomodoro';

/**
 * Where the app is published.
 *
 * The releases page is the app's shop window: the desktop installers are
 * attached to it, and the update check asks the same host whether a newer
 * version exists. One place to look is one place to keep up to date.
 */
export const APP_REPOSITORY_URL = 'https://github.com/khurramsaadat/Pomodoro';

/** Where the installers live. */
export const APP_RELEASES_URL = `${APP_REPOSITORY_URL}/releases`;

/**
 * The address the update check reads to learn the latest published version.
 *
 * This is the API rather than the releases page, because the page is an
 * HTML document and the app needs a fact: which version is newest, and
 * where its release lives. GitHub answers it without a key, and it allows
 * any origin to read it, so both tiers can ask.
 */
export const APP_LATEST_RELEASE_API =
  'https://api.github.com/repos/khurramsaadat/Pomodoro/releases/latest';
