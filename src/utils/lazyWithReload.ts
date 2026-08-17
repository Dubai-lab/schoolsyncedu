import { lazy, type ComponentType } from 'react';

/**
 * React.lazy that survives a deploy.
 *
 * Every build gives each chunk a new content hash — SiteThemePanel-CtJqnNze.js
 * becomes SiteThemePanel-CZ1n6DCZ.js. A tab that was open across a deploy is
 * still running the old entry, so the first time it lazy-loads a panel it asks
 * for a file that no longer exists, gets a 404, and the import rejects:
 *
 *   Failed to fetch dynamically imported module: .../SiteThemePanel-CtJqnNze.js
 *
 * The page is not broken and the code is not wrong — the browser is simply
 * holding a build the server has replaced. A reload fixes it, and there is no
 * reason to make a proprietor work that out from an error message.
 *
 * So: on a failed chunk fetch, reload once. The guard is a sessionStorage
 * stamp rather than a boolean, because a genuinely missing chunk — a bad
 * deploy, a file that never uploaded — would otherwise reload forever. After
 * one attempt inside ten seconds the error is allowed through to the
 * ErrorBoundary, where at least it is visible and reportable.
 */

const STAMP = 'schoolsync:chunk-reload';
const WINDOW_MS = 10_000;

function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(STAMP) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(STAMP, String(Date.now()));
  } catch {
    // Private mode, storage disabled. One reload is still better than a dead
    // panel, and without the stamp the worst case is a loop the user can stop
    // by closing the tab — which they would have to do anyway.
  }
  window.location.reload();
  return true;
}

export function lazyWithReload<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    factory().catch((err) => {
      if (reloadOnce()) {
        // The reload is already scheduled. Hand back a promise that never
        // settles so React does not render an error state in the frame before
        // the page goes away.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }),
  );
}

/**
 * Vite fires this when a preloaded chunk fails, which covers the links it
 * injects ahead of a lazy import rather than the import itself. Same cause,
 * same fix, and calling preventDefault stops Vite throwing on top of it.
 */
export function installChunkReloadHandler() {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnce();
  });
}
