// Draws the Flex Up Pro icon: the "Rising Steps" mark above a lime PRO badge, on ink.
// Run: node scripts/make-pro-icons.js
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const LIME = [0xc6, 0xf4, 0x32];
const INK = [0x11, 0x11, 0x11];

// The mark in its 100×100 design box: three rising bars and an up arrow (as in make-icons.js).
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

function inPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const inMark = (u, v) => BARS.some((b) => inRoundedRect(u, v, b)) || inPolygon(u, v, ARROW);

// Icon layout in a 100×100 box: the mark sits up top, the badge below it.
const MARK = { x: 21, y: 8, size: 58 };
const BADGE = { x: 24, y: 71, w: 52, h: 20, r: 10 };

// Bold geometric letters, 12 high with a 3-wide stroke, drawn in ink on the badge.
const H = 12;
const S = 3;
const LETTER_W = 9.5;
const GAP = 3.2;
const lettersX = 50 - (3 * LETTER_W + 2 * GAP) / 2;
const lettersY = BADGE.y + (BADGE.h - H) / 2;

function inBowl(px, py, x0, y0) {
  const outer = inRoundedRect(px, py, { x: x0, y: y0, w: LETTER_W, h: 7.5, r: 3.75 });
  const inner = inRoundedRect(px, py, { x: x0 + S, y: y0 + S, w: LETTER_W - 2 * S - 0.5, h: 7.5 - 2 * S, r: 0.75 });
  return outer && !inner && px >= x0;
}

function inP(px, py, x0) {
  const y0 = lettersY;
  return inRoundedRect(px, py, { x: x0, y: y0, w: S, h: H, r: 0.6 }) || inBowl(px, py, x0, y0);
}

function inR(px, py, x0) {
  const y0 = lettersY;
  const leg = [
    [x0 + 3.6, y0 + 6.2],
    [x0 + 6.9, y0 + 6.2],
    [x0 + LETTER_W + 0.3, y0 + H],
    [x0 + LETTER_W - 3.1, y0 + H],
  ];
  return inP(px, py, x0) || inPolygon(px, py, leg);
}

function inO(px, py, x0) {
  const y0 = lettersY;
  const outer = inRoundedRect(px, py, { x: x0, y: y0, w: LETTER_W + 0.5, h: H, r: 5 });
  const inner = inRoundedRect(px, py, { x: x0 + S, y: y0 + S, w: LETTER_W + 0.5 - 2 * S, h: H - 2 * S, r: 2 });
  return outer && !inner;
}

const inText = (u, v) =>
  inP(u, v, lettersX) || inR(u, v, lettersX + LETTER_W + GAP) || inO(u, v, lettersX + 2 * (LETTER_W + GAP));

/** Colour of one point of the icon (u, v in the 100×100 box). */
function colorAt(u, v) {
  if (inRoundedRect(u, v, BADGE)) return inText(u, v) ? INK : LIME;
  const mu = ((u - MARK.x) / MARK.size) * 100;
  const mv = ((v - MARK.y) / MARK.size) * 100;
  return inMark(mu, mv) ? LIME : INK;
}

/** size×size, 4×4 supersampled so the edges and letters stay smooth at every size. */
function render(size) {
  const png = new PNG({ width: size, height: size });
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt(((x + (sx + 0.5) / SS) / size) * 100, ((y + (sy + 0.5) / SS) / size) * 100);
          sum[0] += c[0];
          sum[1] += c[1];
          sum[2] += c[2];
        }
      }
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) png.data[i + c] = Math.round(sum[c] / (SS * SS));
      png.data[i + 3] = 255;
    }
  }
  return png;
}

const root = path.join(__dirname, '..');
const write = (file, size) => {
  // Home-screen icons are fully opaque, saved as plain RGB.
  fs.writeFileSync(path.join(root, file), PNG.sync.write(render(size), { colorType: 2 }));
  console.log(`${file}  ${size}×${size}`);
};

write('public/apple-touch-icon.png', 180);
write('public/icon-192.png', 192);
write('public/icon-512.png', 512);
write('public/icon-1024.png', 1024);
write('assets/favicon.png', 48);
