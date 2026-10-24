// Minimal types for two small pure-JS libraries used to make share GIFs.

declare module 'gifenc' {
  type Palette = number[][];
  type Format = 'rgb565' | 'rgb444' | 'rgba4444';
  interface Encoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: Palette;
        delay?: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): Encoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: Format; oneBitAlpha?: boolean | number },
  ): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: Format): Uint8Array;
}

declare module 'upng-js' {
  interface Image {
    width: number;
    height: number;
  }
  const UPNG: {
    decode(buffer: ArrayBuffer): Image;
    toRGBA8(image: Image): ArrayBuffer[];
  };
  export default UPNG;
}
