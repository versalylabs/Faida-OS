/**
 * Generates every Faida OS icon from one liquid-glass design.
 *   node scripts/generate-icons.cjs
 * Writes: public/icon.svg, src/app/icon.svg, public/icon-192.png, public/icon-512.png,
 *         public/icon-maskable-512.png, public/apple-touch-icon.png, src/app/favicon.ico
 * Uses `sharp` (already installed with Next.js).
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");

// The mark: a rounded "F" whose middle arm is a lightning bolt (the existing brand idea), drawn as glass.
function svg({ rounded = true, scale = 1 } = {}) {
  const c = 256;
  const t = `translate(${c} ${c}) scale(${scale}) translate(${-c - 2} ${-c - 20})`;
  const base = rounded ? `<rect width="512" height="512" rx="116" fill="url(#bg)"/>` : `<rect width="512" height="512" fill="url(#bg)"/>`;
  const clip = rounded ? `<rect width="512" height="512" rx="116"/>` : `<rect width="512" height="512"/>`;
  const rim = rounded ? `<rect x="2.5" y="2.5" width="507" height="507" rx="113.5" fill="none" stroke="url(#rim)" stroke-width="5"/>` : "";
  const shapes = `
      <rect x="120" y="112" width="64" height="288" rx="32"/>
      <path d="M152 112 H368 C385.6 112 396.8 129.6 390.4 145.6 L377.6 177.6 C373.6 186.4 364.8 192 355.2 192 H152 Z"/>
      <path d="M152 228 H312 C326.4 228 334.4 244 326.4 255.2 L260 320 H308 C321.6 320 328.8 336 320 346.4 L216 432 C206.4 440 192 430.4 196.8 419.2 L224 356 H152 Z"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2c3b94"/>
      <stop offset="0.5" stop-color="#101a48"/>
      <stop offset="1" stop-color="#060c26"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0.18" cy="0.08" r="0.75">
      <stop offset="0" stop-color="#8d9dff" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#8d9dff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.88" cy="0.96" r="0.7">
      <stop offset="0" stop-color="#6ee7d0" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#6ee7d0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.65"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#b9f5e8" stop-opacity="0.3"/>
    </linearGradient>
    <linearGradient id="mark" x1="120" y1="110" x2="400" y2="440" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f3f5ff"/>
      <stop offset="0.35" stop-color="#b7c3ff"/>
      <stop offset="0.7" stop-color="#7d92ff"/>
      <stop offset="1" stop-color="#4fe0c4"/>
    </linearGradient>
    <linearGradient id="markHi" x1="0" y1="110" x2="0" y2="330" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="face">${clip}</clipPath>
    <clipPath id="mk">${shapes}</clipPath>
    <filter id="drop" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#050a24" flood-opacity="0.5"/>
    </filter>
  </defs>

  ${base}
  <g clip-path="url(#face)">
    <rect width="512" height="512" fill="url(#glowA)"/>
    <rect width="512" height="512" fill="url(#glowB)"/>
    <rect width="512" height="300" fill="url(#sheen)"/>
  </g>
  ${rim}

  <g transform="${t}">
    <g filter="url(#drop)">
      <g clip-path="url(#mk)">
        <rect x="100" y="90" width="320" height="370" fill="url(#mark)"/>
        <rect x="100" y="90" width="320" height="230" fill="url(#markHi)"/>
      </g>
    </g>
    <circle cx="378" cy="146" r="15" fill="#ffffff"/>
    <circle cx="378" cy="146" r="15" fill="none" stroke="#4fe0c4" stroke-opacity="0.9" stroke-width="3"/>
    <circle cx="214" cy="424" r="11" fill="#4fe0c4"/>
  </g>
</svg>`;
}

async function png(markup, size, file) {
  await sharp(Buffer.from(markup), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
}

// A .ico can carry PNG images directly; browsers read these fine.
async function ico(markup, sizes, file) {
  const images = [];
  for (const s of sizes) images.push({ s, data: await sharp(Buffer.from(markup), { density: 384 }).resize(s, s).png().toBuffer() });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map((img) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(img.s >= 256 ? 0 : img.s, 0);
    e.writeUInt8(img.s >= 256 ? 0 : img.s, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(img.data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += img.data.length;
    return e;
  });
  fs.writeFileSync(file, Buffer.concat([header, ...entries, ...images.map((i) => i.data)]));
}

(async () => {
  const rounded = svg({ rounded: true, scale: 1 });
  const square = (scale) => svg({ rounded: false, scale });

  fs.writeFileSync(path.join(root, "public/icon.svg"), rounded);
  fs.writeFileSync(path.join(root, "src/app/icon.svg"), rounded);
  await png(rounded, 192, path.join(root, "public/icon-192.png"));
  await png(rounded, 512, path.join(root, "public/icon-512.png"));
  // Maskable: the system crops it to its own shape, so the artwork fills the square and stays inside the middle 80%.
  await png(square(0.74), 512, path.join(root, "public/icon-maskable-512.png"));
  // iOS rounds the corners itself and wants an opaque square.
  await png(square(0.82), 180, path.join(root, "public/apple-touch-icon.png"));
  await ico(rounded, [16, 32, 48], path.join(root, "src/app/favicon.ico"));
  console.log("icons written");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
