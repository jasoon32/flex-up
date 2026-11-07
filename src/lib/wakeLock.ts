/** Keeps the screen on while held, so the rest-over ding isn't missed to auto-lock. */
interface Sentinel extends EventTarget {
  released: boolean;
  release: () => Promise<void>;
}

let sentinel: Sentinel | null = null;
let wanted = false;
let requesting = false;

async function acquire() {
  const wl = (navigator as { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } }).wakeLock;
  if (!wl || !wanted || requesting || (sentinel && !sentinel.released) || document.visibilityState !== 'visible')
    return;
  requesting = true;
  try {
    const s = await wl.request('screen');
    if (!wanted) {
      s.release().catch(() => {});
      return;
    }
    sentinel = s;
    // The browser can drop the lock while the page is showing (low battery); take it back.
    s.addEventListener('release', () => void acquire(), { once: true });
  } catch {
    // Not allowed right now (low battery mode, hidden tab); the timer still works.
  } finally {
    requesting = false;
  }
}

function release() {
  sentinel?.release().catch(() => {});
  sentinel = null;
}

// The browser drops the lock when the page is hidden; take it back on return.
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => void acquire());

export function keepScreenOn(on: boolean): void {
  wanted = on;
  if (on) void acquire();
  else release();
}
