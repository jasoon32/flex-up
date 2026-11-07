/**
 * The rest-over ding on the web.
 *
 * iPhone Safari stops other apps' audio (Spotify, Apple Music) when a page plays an
 * <audio> element, and doesn't start it again. So the ding goes through Web Audio
 * with the page's audio session set to "ambient", which mixes with other audio.
 */
const SOUND_URL = '/rest-done.wav';

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading = false;

/** Safari 17+: play alongside other apps' audio instead of taking it over. */
function mixWithOtherAudio() {
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== 'ambient') session.type = 'ambient';
}

/**
 * Unlocks sound; Safari only allows it from a tap, and the rest ends without one.
 * Safe to call on every tap.
 */
export function primeRestSound(): void {
  try {
    mixWithOtherAudio();
    const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (!buffer && !loading) {
      loading = true;
      fetch(SOUND_URL)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx!.decodeAudioData(data))
        .then((b) => (buffer = b))
        .catch(() => {})
        .finally(() => (loading = false));
    }
  } catch {
    // No sound on this browser; the banner still shows.
  }
}

export function playRestSound(): void {
  if (!ctx || !buffer) return;
  mixWithOtherAudio();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}
