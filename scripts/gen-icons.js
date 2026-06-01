/**
 * Regenerates icon-192.png and icon-512.png from logo.png.
 *
 * Source PNG analysis (896×896, fully opaque):
 *   - 99px near-black outer canvas each side
 *   - 21px gold border ring each side (x=99–120, symmetric)
 *   - Badge rounded-corner radius ≈ 109px → at icon size = 80px (512) / 30px (192)
 *   - iOS squircle corner clip ≈ 95px (512) / 35px (192) — larger than badge radius
 *
 * Strategy:
 *   1. Raw-pixel pass: replace outer dark canvas with #1a2e1a; dissolve the gold
 *      border ring (within 130px of image edge) into #1a2e1a — V-letter gold in
 *      the centre is NOT affected because it's outside the border zone.
 *   2. Crop to badge bounding box (left=99, 698×698) so the rounded badge corners
 *      land exactly at canvas corners.
 *   3. Scale to 100% of icon size.  iOS clips its own rounded-square mask at
 *      render time, hiding the badge corner and any residual border pixels.
 */

const sharp = require('sharp');
const path  = require('path');

const LOGO = path.join(__dirname, '../client/public/logo.png');
const OUT  = path.join(__dirname, '../client/public');

const BG = { r: 26, g: 46, b: 26 }; // #1a2e1a

// ── pixel classifiers ─────────────────────────────────────────────────────────

// Near-black outer canvas (r<35, g<45, b<40 with greenish tint at most)
function isOuterDark(r, g, b) {
  return r < 35 && g < 45 && b < 40;
}

// Warm metallic gold: R is highest or tied, all channels elevated, not just green.
// Key discriminator vs. badge-green: R >= G (gold) vs. G > R (green).
function isGoldBorder(r, g, b) {
  return r >= 90 && g >= 60 && r >= g && g >= b;
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

// ── processing ────────────────────────────────────────────────────────────────

async function processLogo() {
  const { data, info } = await sharp(LOGO).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info; // 896, 896, 4

  const out = Buffer.from(data); // mutable copy

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i], g = data[i + 1], b = data[i + 2];

      // "Border zone" = within 130px of any image edge.
      // This covers the 99px dark border + 21px gold ring; the V emblem
      // sits in the centre and is well outside this zone.
      const inBorderZone = x < 130 || y < 130 || x >= width - 130 || y >= height - 130;

      if (isOuterDark(r, g, b)) {
        // Replace near-black outer canvas with solid background green
        out[i]     = BG.r;
        out[i + 1] = BG.g;
        out[i + 2] = BG.b;
      } else if (isGoldBorder(r, g, b) && inBorderZone) {
        // Dissolve border gold 75% toward background so the ring softens
        // into the canvas; the V letter gold is unaffected (outside zone).
        const t = 0.75;
        out[i]     = lerp(r, BG.r, t);
        out[i + 1] = lerp(g, BG.g, t);
        out[i + 2] = lerp(b, BG.b, t);
      }
      // Badge interior: unchanged.
    }
  }

  // Crop to badge bounding box — badge corners now land at canvas corners.
  // iOS clips those corners with its own squircle mask (radius > badge radius).
  return sharp(out, { raw: { width, height, channels } })
    .extract({ left: 99, top: 99, width: 698, height: 698 });
}

// ── icon generation ───────────────────────────────────────────────────────────

async function generateIcon(base, size) {
  await base
    .clone()
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, `icon-${size}.png`));

  console.log(`✓ icon-${size}.png  (badge at 100% fill, iOS clips corners)`);
}

async function main() {
  console.log('Processing logo.png …');
  const base = await processLogo();

  console.log('Generating icons …');
  await generateIcon(base, 192);
  await generateIcon(base, 512);

  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });
