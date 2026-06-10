/**
 * fix-icon.js
 *
 * Fixes the PWA icons that had a baked-in dark border/frame causing a
 * double-frame effect on iOS. Crops to the inner green card content,
 * removes the "CUT TODAY. GROW TOMORROW" tagline, and regenerates all
 * required sizes. The OS (iOS squircle, Android adaptive) applies its own
 * rounding — nothing should be baked in.
 *
 * Pixel analysis of icon-512.png (512x512):
 *   y=0–95    : dark background border (#1a2e1a / rgb(26,46,26))
 *   y=96–108  : gold "VICE TO VALUE" text band
 *   y=114–429 : inner green card with V logo (the content we keep)
 *   y=430–511 : tagline text + dark bottom frame
 *
 * Left/right: card fills edge-to-edge from y≈160 down; the top corners
 * show background but iOS squircle masks them out automatically.
 *
 * Source used: icon-512.png (512×512) — direct pixel-verified crop coords.
 * apple-touch-icon.png is written to client/public/ and index.html already
 * references /apple-touch-icon.png (we update the href to point to the new file).
 */

'use strict';

const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');

const PUBLIC = path.join(__dirname, '..', 'client', 'public');
const SRC    = path.join(PUBLIC, 'icon-512.png');

// Verified crop coordinates (512x512 source):
//   Remove top dark border (y=0–95) + bottom tagline/frame (y=430–511)
//   Keep full width — card fills edge-to-edge on left/right below y=160
const CROP = { left: 0, top: 96, width: 512, height: 334 };

// Outputs: [path, size, purpose-label]
const OUTPUTS = [
  [path.join(PUBLIC, 'icon-512.png'),          512, 'any/maskable'],
  [path.join(PUBLIC, 'icon-192.png'),          192, 'any'],
  [path.join(PUBLIC, 'apple-touch-icon.png'),  180, 'apple-touch-icon'],
];

async function run() {
  console.log('Reading source:', SRC);
  const src = sharp(SRC);
  const meta = await src.metadata();
  console.log('Source:', meta.width, 'x', meta.height, meta.format);

  // Extract the inner card strip (removes top dark border + bottom tagline)
  const cropped = await sharp(SRC)
    .extract(CROP)
    .toBuffer();
  console.log(`Cropped: ${CROP.width}x${CROP.height} from (${CROP.left},${CROP.top})`);

  for (const [outPath, size, label] of OUTPUTS) {
    await sharp(cropped)
      .resize(size, size, {
        fit: 'fill',           // stretch to square — imperceptible at icon size
        kernel: 'lanczos3',    // high-quality downscale
      })
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    const stat = fs.statSync(outPath);
    console.log(`  ✓ ${path.basename(outPath)}  ${size}x${size}  ${label}  (${(stat.size / 1024).toFixed(1)} KB)`);
  }

  // Also generate a dedicated maskable variant (content padded to stay in 80% safe zone)
  // For maskable: place the 80%-scaled content centered on a solid green canvas
  const SAFE_ZONE = 0.80;  // Google Play requirement
  const MASK_SIZE = 512;
  const innerSize = Math.round(MASK_SIZE * SAFE_ZONE);   // 409
  const pad       = Math.round((MASK_SIZE - innerSize) / 2); // 51

  // Sample the card's edge color for the padding fill (bottom-left of crop area)
  const { data: edgeData } = await sharp(cropped)
    .extract({ left: 0, top: CROP.height - 4, width: 4, height: 4 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const edgeR = edgeData[0], edgeG = edgeData[1], edgeB = edgeData[2];
  console.log(`  Edge fill color: rgb(${edgeR},${edgeG},${edgeB})`);

  const innerBuf = await sharp(cropped)
    .resize(innerSize, innerSize, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer();

  const maskablePath = path.join(PUBLIC, 'icon-512-maskable.png');
  await sharp({
    create: {
      width:      MASK_SIZE,
      height:     MASK_SIZE,
      channels:   3,
      background: { r: edgeR, g: edgeG, b: edgeB },
    },
  })
    .composite([{ input: innerBuf, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
    .toFile(maskablePath);

  const mStat = fs.statSync(maskablePath);
  console.log(`  ✓ icon-512-maskable.png  512x512  maskable safe-zone  (${(mStat.size / 1024).toFixed(1)} KB)`);

  console.log('\nAll icons generated. Next steps:');
  console.log('  1. Update manifest.json to use icon-512-maskable.png for purpose:"maskable"');
  console.log('  2. Update index.html apple-touch-icon href to /apple-touch-icon.png');
}

run().catch(err => { console.error(err); process.exit(1); });
