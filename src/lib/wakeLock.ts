/** Keeps the screen on while held, so the rest-over ding isn't missed to auto-lock. */
interface Sentinel {
  released: boolean;
  release: () => Promise<void>;
}

let sentinel: Sentinel | null = null;
let wanted = false;

async function acquire() {
  const wl = (navigator as { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } }).wakeLock;
  if (!wl || !wanted || (sentinel && !sentinel.released) || document.visibilityState !== 'visible') return;
  try {
    sentinel = await wl.request('screen');
    if (!wanted) release();
  } catch {
    // Not allowed right now (low battery mode, hidden tab); the timer still works.
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
