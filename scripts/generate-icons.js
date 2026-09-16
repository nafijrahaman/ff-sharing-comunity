/**
 * Generates PNG icons for PWA using pure Node.js (zlib + raw PNG chunk builder)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function generatePng(size, filename) {
  const width = size;
  const height = size;

  // Build raw uncompressed RGBA pixel buffer
  // Each row has 1 filter byte (0) followed by width * 4 RGBA bytes
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const center = size / 2;
  const radius = size * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background obsidian black
      let r = 7;
      let g = 9;
      let b = 14;
      let a = 255;

      // Outer glow / circle ring
      if (dist < radius && dist > radius - 12) {
        // Gradient orange to ice
        const t = (x + y) / (width + height);
        r = Math.round(255 * (1 - t) + 56 * t);
        g = Math.round(119 * (1 - t) + 189 * t);
        b = Math.round(0 * (1 - t) + 248 * t);
      } else if (dist <= radius - 12) {
        // Inner fill
        r = 14;
        g = 19;
        b = 29;
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // Bit depth
  ihdrData.writeUInt8(6, 9); // Color type RGBA
  ihdrData.writeUInt8(0, 10); // Compression
  ihdrData.writeUInt8(0, 11); // Filter
  ihdrData.writeUInt8(0, 12); // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const pngBuffer = Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk]);
  fs.writeFileSync(filename, pngBuffer);
  console.log(`Generated: ${filename} (${width}x${height})`);
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// Standard CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

generatePng(192, path.join(assetsDir, 'icon-192.png'));
generatePng(512, path.join(assetsDir, 'icon-512.png'));
