import { Platform } from 'react-native';
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import UPNG from 'upng-js';

/**
 * 'ready': the file is made but the phone refused to open the share sheet this late after the
 * tap; call sendPrepared() from a fresh tap. 'cancelled': the user closed the share sheet.
 */
export type ShareResult = 'shared' | 'downloaded' | 'unavailable' | 'ready' | 'cancelled';
type CardRef = RefObject<ComponentRef<typeof View> | null>;

/** GIF size: half of a 1080×1920 Story keeps files small, and pixel art stays crisp. */
const GIF_W = 360;
const GIF_H = 640;

/** Lets React draw a new frame before it's captured. */
export const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 20))));

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function capturePng(ref: CardRef, size?: { width: number; height: number }): Promise<string> {
  if (Platform.OS === 'web') return captureWebPng(ref.current as unknown as HTMLElement, size);
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri', ...size });
  return uri.slice(uri.indexOf(',') + 1);
}

/**
 * Web capture with a see-through background. view-shot's web version lets html2canvas paint
 * white behind the card, so transparent stickers came out white once pasted into Instagram.
 */
async function captureWebPng(el: HTMLElement, size?: { width: number; height: number }): Promise<string> {
  const html2canvas = (await import('html2canvas-pro')).default;
  let canvas = await html2canvas(el, { useCORS: true, backgroundColor: null });
  if (size) {
    // A fresh canvas starts fully transparent, so resizing keeps the clear pixels clear.
    const resized = document.createElement('canvas');
    resized.width = size.width;
    resized.height = size.height;
    resized.getContext('2d')?.drawImage(canvas, 0, 0, size.width, size.height);
    canvas = resized;
  }
  const uri = canvas.toDataURL('image/png');
  return uri.slice(uri.indexOf(',') + 1);
}

/** The share waiting for a fresh tap after the phone said "not allowed" (see ShareResult). */
let prepared: (() => Promise<void>) | null = null;

const errorName = (e: unknown) => (e instanceof Error || e instanceof DOMException ? e.name : '');

/**
 * Opens the share sheet for the file made last, from a tap. It calls the browser straight
 * away, before anything else, so the tap still counts as the user asking to share.
 */
export function sendPrepared(): Promise<ShareResult> {
  const send = prepared;
  prepared = null;
  if (!send) return Promise.resolve('unavailable');
  return send().then(
    () => 'shared' as const,
    (e) => {
      if (errorName(e) === 'AbortError') return 'cancelled' as const;
      throw e;
    },
  );
}

/** Opens the share sheet for a file; on the web, the browser's share sheet or a download. */
async function shareBytes(bytes: Uint8Array, name: string, mimeType: string, uti: string, title: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    const file = new globalThis.File([bytes as BlobPart], name, { type: mimeType });
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      const send = () => navigator.share({ files: [file], title });
      try {
        await send();
        return 'shared';
      } catch (e) {
        if (errorName(e) === 'AbortError') return 'cancelled';
        // iPhone Safari only opens the share sheet within about a second of a tap, and drawing
        // the card (or every GIF frame) takes longer. Keep the file for one more tap.
        if (errorName(e) === 'NotAllowedError') {
          prepared = send;
          return 'ready';
        }
        throw e;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
  }
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const file = new File(Paths.cache, `${Date.now()}-${name}`);
  await file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: title });
  return 'shared';
}

/** Shares the card as it looks now, as a PNG (with real transparency when the card has none). */
export async function shareStill(ref: CardRef, title: string): Promise<ShareResult> {
  if (!ref.current) return 'unavailable';
  const bytes = base64ToBytes(await capturePng(ref));
  return shareBytes(bytes, 'flex-up-workout.png', 'image/png', 'public.png', title);
}

/**
 * Copies the card as a PNG, so it can be pasted into an Instagram Story as a movable sticker.
 * `beforeCapture` readies the card (e.g. shows the still frame). Returns false where the
 * clipboard can't hold images.
 */
export async function copyStill(ref: CardRef, beforeCapture: () => Promise<void>): Promise<boolean> {
  if (!ref.current) return false;
  if (Platform.OS === 'web' && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    // Safari only lets a page write to the clipboard during the tap itself, so the clipboard is
    // asked right now and given a promise of the image, which fills in once it's drawn.
    const png = (async () => {
      await beforeCapture();
      return new Blob([base64ToBytes(await capturePng(ref)) as BlobPart], { type: 'image/png' });
    })();
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await beforeCapture();
    await Clipboard.setImageAsync(await capturePng(ref));
    return true;
  } catch {
    return false;
  }
}

export interface GifOptions {
  frames: number;
  delay: number;
  /** Output size in pixels. */
  size?: { width: number; height: number };
  /** Fewer colours make smaller files; pixel art needs few. */
  colors?: number;
  /** Keep see-through pixels see-through (GIFs only do fully clear or fully solid). */
  transparent?: boolean;
  name?: string;
}

/**
 * Records the card as a looping GIF: `setFrame` moves the card to each frame, it's captured,
 * and the frames are encoded with one shared colour palette.
 */
export async function shareGif(
  ref: CardRef,
  setFrame: (frame: number) => void,
  opts: GifOptions,
  title: string,
  onProgress?: (done: number) => void,
): Promise<ShareResult> {
  if (!ref.current) return 'unavailable';
  const { frames, delay, size = { width: GIF_W, height: GIF_H }, colors = 256, transparent = false } = opts;
  const shots: string[] = [];
  for (let f = 0; f < frames; f++) {
    setFrame(f);
    await nextPaint();
    shots.push(await capturePng(ref, size));
    onProgress?.(f + 1);
  }

  const decode = (b64: string) => {
    const img = UPNG.decode(base64ToBytes(b64).buffer as ArrayBuffer);
    return { rgba: new Uint8Array(UPNG.toRGBA8(img)[0]), w: img.width, h: img.height };
  };
  const format = transparent ? 'rgba4444' : 'rgb565';
  // The palette comes from the last frame: numbers finished counting, every colour on screen.
  const palette = quantize(decode(shots[shots.length - 1]).rgba, colors, {
    format,
    oneBitAlpha: transparent ? 127 : undefined,
  });
  const clear = transparent ? palette.findIndex((c) => c[3] === 0) : -1;
  const gif = GIFEncoder();
  shots.forEach((shot, i) => {
    const { rgba, w, h } = decode(shot);
    gif.writeFrame(applyPalette(rgba, palette, format), w, h, {
      // The first frame carries the palette for the whole GIF.
      ...(i === 0 ? { palette, repeat: 0 } : {}),
      delay,
      // With transparency each frame must clear the last one, or old poses would show through.
      ...(clear >= 0 ? { transparent: true, transparentIndex: clear, dispose: 2 } : {}),
    });
  });
  gif.finish();
  return shareBytes(gif.bytes(), opts.name ?? 'flex-up-workout.gif', 'image/gif', 'com.compuserve.gif', title);
}
