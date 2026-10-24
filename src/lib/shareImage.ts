import { Platform } from 'react-native';
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import UPNG from 'upng-js';

export type ShareResult = 'shared' | 'downloaded' | 'unavailable';
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
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri', ...size });
  return uri.slice(uri.indexOf(',') + 1);
}

/** Opens the share sheet for a file; on the web, the browser's share sheet or a download. */
async function shareBytes(bytes: Uint8Array, name: string, mimeType: string, uti: string, title: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    const file = new globalThis.File([bytes as BlobPart], name, { type: mimeType });
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
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
 * Returns false where the clipboard can't hold images.
 */
export async function copyStill(ref: CardRef): Promise<boolean> {
  if (!ref.current) return false;
  try {
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
