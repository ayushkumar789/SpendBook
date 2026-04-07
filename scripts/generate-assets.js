/**
 * generate-assets.js
 * Generates all required Expo image assets as PNG files using only Node.js built-ins.
 * Run: node scripts/generate-assets.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// Minimal valid PNG builder
function buildPNG(width, height, fillRGBA, drawFn) {
  const channels = 4;
  const pixels = Buffer.alloc(width * height * channels);

  // Fill background
  for (let i = 0; i < width * height; i++) {
    pixels[i * channels + 0] = fillRGBA[0];
    pixels[i * channels + 1] = fillRGBA[1];
    pixels[i * channels + 2] = fillRGBA[2];
    pixels[i * channels + 3] = fillRGBA[3];
  }

  if (drawFn) drawFn(pixels, width, height, channels);

  // Build raw image data (filter byte 0x00 per row = None filter)
  const rawSize = height * (1 + width * channels);
  const raw = Buffer.alloc(rawSize);
  for (let y = 0; y < height; y++) {
    const rowOff = y * (1 + width * channels);
    raw[rowOff] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const srcOff = (y * width + x) * channels;
      const dstOff = rowOff + 1 + x * channels;
      pixels.copy(raw, dstOff, srcOff, srcOff + channels);
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });

  function crc32(buf) {
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[i] = c;
      }
      return t;
    })());
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, 'ascii');
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
    return Buffer.concat([len, typeB, data, crcB]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPixel(pixels, width, channels, x, y, rgba) {
  if (x < 0 || y < 0 || x >= width) return;
  const off = (y * width + x) * channels;
  pixels[off] = rgba[0];
  pixels[off + 1] = rgba[1];
  pixels[off + 2] = rgba[2];
  pixels[off + 3] = rgba[3];
}

function fillRect(pixels, width, channels, rx, ry, rw, rh, rgba) {
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      setPixel(pixels, width, channels, x, y, rgba);
    }
  }
}

function fillCircle(pixels, width, height, channels, cx, cy, r, rgba) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) {
        setPixel(pixels, width, channels, x, y, rgba);
      }
    }
  }
}

const PRIMARY = [92, 45, 145, 255];    // #5c2d91
const WHITE   = [255, 255, 255, 255];
const LIGHT   = [237, 233, 254, 255];  // #ede9fe

// icon.png 1024×1024
{
  const size = 1024;
  const png = buildPNG(size, size, PRIMARY, (pixels, w, h, ch) => {
    // White rounded square in center
    const sq = 600; const sqX = (w - sq) / 2; const sqY = (h - sq) / 2;
    fillRect(pixels, w, ch, sqX, sqY, sq, sq, WHITE);
    // Book spine (purple rect on left)
    fillRect(pixels, w, ch, sqX + 80, sqY + 80, 80, sq - 160, PRIMARY);
    // Three lines (pages)
    for (let i = 0; i < 3; i++) {
      fillRect(pixels, w, ch, sqX + 200, sqY + 180 + i * 120, 260, 40, LIGHT);
    }
    // Coin circle
    fillCircle(pixels, w, h, ch, w - 220, h - 220, 90, [245, 158, 11, 255]); // amber
    fillCircle(pixels, w, h, ch, w - 220, h - 220, 60, WHITE);
  });
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), png);
  console.log('✓ icon.png (1024×1024)');
}

// splash.png 1284×2778
{
  const W = 1284, H = 2778;
  const png = buildPNG(W, H, PRIMARY, (pixels, w, h, ch) => {
    // White rounded card in center
    const cw = 700, ch2 = 700;
    const cx = (w - cw) / 2, cy = (h - ch2) / 2 - 80;
    fillRect(pixels, w, ch, cx, cy, cw, ch2, [255, 255, 255, 30]);
    // Book rect
    fillRect(pixels, w, ch, cx + 100, cy + 80, 180, ch2 - 160, [255, 255, 255, 80]);
    fillRect(pixels, w, ch, cx + 200, cy + 140, 360, 60, [255, 255, 255, 60]);
    fillRect(pixels, w, ch, cx + 200, cy + 260, 300, 60, [255, 255, 255, 60]);
    fillRect(pixels, w, ch, cx + 200, cy + 380, 330, 60, [255, 255, 255, 60]);
    // Tagline dots
    fillCircle(pixels, w, h, ch, w / 2, cy + ch2 + 120, 12, [255, 255, 255, 120]);
    fillCircle(pixels, w, h, ch, w / 2 + 40, cy + ch2 + 120, 12, [255, 255, 255, 80]);
    fillCircle(pixels, w, h, ch, w / 2 - 40, cy + ch2 + 120, 12, [255, 255, 255, 80]);
  });
  fs.writeFileSync(path.join(assetsDir, 'splash.png'), png);
  console.log('✓ splash.png (1284×2778)');
}

// adaptive-icon.png 1024×1024
{
  const size = 1024;
  const png = buildPNG(size, size, [255, 255, 255, 0], (pixels, w, h, ch) => {
    // Purple circle background
    fillCircle(pixels, w, h, ch, w / 2, h / 2, 420, PRIMARY);
    // White book
    fillRect(pixels, w, ch, 340, 280, 340, 440, WHITE);
    fillRect(pixels, w, ch, 340, 280, 80, 440, LIGHT);
    fillRect(pixels, w, ch, 450, 360, 200, 35, LIGHT);
    fillRect(pixels, w, ch, 450, 440, 160, 35, LIGHT);
    fillRect(pixels, w, ch, 450, 520, 180, 35, LIGHT);
  });
  fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), png);
  console.log('✓ adaptive-icon.png (1024×1024)');
}

// favicon.png 48×48
{
  const size = 48;
  const png = buildPNG(size, size, PRIMARY, (pixels, w, h, ch) => {
    fillRect(pixels, w, ch, 10, 8, 28, 32, WHITE);
    fillRect(pixels, w, ch, 10, 8, 8, 32, LIGHT);
  });
  fs.writeFileSync(path.join(assetsDir, 'favicon.png'), png);
  console.log('✓ favicon.png (48×48)');
}

console.log('\nAll assets generated successfully in ./assets/');
