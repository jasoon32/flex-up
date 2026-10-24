// Draws the Flex Up "Rising Steps" logo (from the design canvas) into every app icon file.
// Run: node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const LIME = [0xc6, 0xf4, 0x32];
const INK = [0x11, 0x11, 0x11];

// The logo in its 100×100 design box: three rising bars and an up arrow.
const BARS = [
  { x: 12, y: 62, w: 20, h: 24, r: 3 },
  { x: 40, y: 46, w: 20, h: 40, r: 3 },
  { x: 68, y: 30, w: 20, h: 56, r: 3 },
];
const ARROW = [
  [78, 6],
  [93, 24],
  [63, 24],
];

function inRoundedRect(px, py, { x, y, w, h, r }) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function inTriangle(px, py, [a, b, c]) {
  const side = (p, q) => (q[0] - p[0]) * (py - p[1]) - (q[1] - p[1]) * (px - p[0]);
  const d1 = side(a, b), d2 = side(b, c), d3 = side(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

const inLogo = (u, v) => BARS.some((b) => inRoundedRect(u, v, b)) || inTriangle(u, v, ARROW);

/**
 * Renders a size×size image. `mark` is the logo's share of the width (0.7 in the design);
 * `bg` null makes a transparent background. 4×4 supersampling smooths the edges.
 */
function render(size, { bg, fg, mark }) {
  const png = new PNG({ width: size, height: size });
  const box = size * mark;
  const off = (size - box) / 2;
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS - off) / box) * 100;
          const v = ((y + (sy + 0.5) / SS - off) / box) * 100;
          if (inLogo(u, v)) hits++;
        }
      }
      const cover = hits / (SS * SS);
      const i = (y * size + x) * 4;
      if (bg) {
        for (let c = 0; c < 3; c++) png.data[i + c] = Math.round(bg[c] + (fg[c] - bg[c]) * cover);
        png.data[i + 3] = 255;
      } else {
        for (let c = 0; c < 3; c++) png.data[i + c] = fg[c];
        png.data[i + 3] = Math.round(cover * 255);
      }
    }
  }
  return png;
}

function solid(size, color) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([...color, 255], i);
  return png;
}

const root = path.join(__dirname, '..');
const write = (file, png, opaque) => {
  // App Store icons must have no alpha channel at all, so opaque files are saved as plain RGB.
  const buf = PNG.sync.write(png, opaque ? { colorType: 2 } : {});
  fs.writeFileSync(path.join(root, file), buf);
  console.log(`${file}  ${png.width}×${png.height}`);
};

const appIcon = render(1024, { bg: LIME, fg: INK, mark: 0.7 });
write('assets/icon.png', appIcon, true);
// Web home-screen icons: Apple's 180 px touch icon, plus the 192 / 512 px icons manifests expect.
write('public/apple-touch-icon.png', render(180, { bg: LIME, fg: INK, mark: 0.7 }), true);
write('public/icon-192.png', render(192, { bg: LIME, fg: INK, mark: 0.7 }), true);
write('public/icon-512.png', render(512, { bg: LIME, fg: INK, mark: 0.7 }), true);
write('public/icon-1024.png', appIcon, true);
write('assets/splash-icon.png', render(1024, { bg: null, fg: INK, mark: 0.7 }), false);
write('assets/favicon.png', render(48, { bg: LIME, fg: INK, mark: 0.7 }), true);
// Android adaptive icons crop to a circle or squircle, so the mark sits inside the safe zone.
write('assets/android-icon-background.png', solid(512, LIME), true);
write('assets/android-icon-foreground.png', render(512, { bg: null, fg: INK, mark: 0.46 }), false);
write('assets/android-icon-monochrome.png', render(432, { bg: null, fg: [0xff, 0xff, 0xff], mark: 0.46 }), false);
