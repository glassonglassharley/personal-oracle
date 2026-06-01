const sharp = require('sharp');
const path = require('path');

const LOGO = path.join(__dirname, '../client/public/logo.png');

async function main() {
  const img = sharp(LOGO);
  const meta = await img.metadata();
  console.log('Dimensions:', meta.width, 'x', meta.height);
  console.log('Channels:', meta.channels);

  // Sample corner pixels and edge pixels to understand the dark outer border
  const raw = await sharp(LOGO)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = raw;
  const { width, height, channels } = info;

  function px(x, y) {
    const i = (y * width + x) * channels;
    return { r: data[i], g: data[i+1], b: data[i+2] };
  }

  console.log('\nCorner pixels (should be dark outer bg):');
  console.log('  TL:', px(0, 0));
  console.log('  TR:', px(width-1, 0));
  console.log('  BL:', px(0, height-1));
  console.log('  BR:', px(width-1, height-1));

  console.log('\nCenter pixel:');
  console.log('  Center:', px(Math.floor(width/2), Math.floor(height/2)));

  // Scan from left edge to find where dark area ends (non-dark pixel)
  const threshold = 50; // anything above this in any channel is "not dark"
  let leftBorder = 0;
  for (let x = 0; x < width/2; x++) {
    const p = px(x, Math.floor(height/2));
    if (p.r > threshold || p.g > threshold || p.b > threshold) {
      leftBorder = x;
      break;
    }
  }

  // Scan from top
  let topBorder = 0;
  for (let y = 0; y < height/2; y++) {
    const p = px(Math.floor(width/2), y);
    if (p.r > threshold || p.g > threshold || p.b > threshold) {
      topBorder = y;
      break;
    }
  }

  console.log('\nDark border scan (threshold', threshold, '):');
  console.log('  Left border ends at x:', leftBorder, `(${(leftBorder/width*100).toFixed(1)}%)`);
  console.log('  Top border ends at y:', topBorder, `(${(topBorder/height*100).toFixed(1)}%)`);
  console.log('  → Inner content starts at:', leftBorder, topBorder);
  console.log('  → Inner content width:', width - leftBorder*2);
  console.log('  → Inner content height:', height - topBorder*2);

  // What color is just after the dark border? (should be gold border)
  if (leftBorder > 0) {
    console.log('\nPixel just inside dark border (should be gold):');
    console.log('  At left border:', px(leftBorder, Math.floor(height/2)));
    console.log('  At top border:', px(Math.floor(width/2), topBorder));
  }

  // Now find where the gold border ends (inner green badge content)
  let goldLeft = leftBorder;
  for (let x = leftBorder; x < width/2; x++) {
    const p = px(x, Math.floor(height/2));
    // Gold is high R, medium G, low B
    if (!(p.r > 150 && p.g > 100 && p.b < 100)) {
      goldLeft = x;
      break;
    }
  }

  let goldTop = topBorder;
  for (let y = topBorder; y < height/2; y++) {
    const p = px(Math.floor(width/2), y);
    if (!(p.r > 150 && p.g > 100 && p.b < 100)) {
      goldTop = y;
      break;
    }
  }

  console.log('\nGold border scan:');
  console.log('  Gold ends at x:', goldLeft, `(${(goldLeft/width*100).toFixed(1)}%)`);
  console.log('  Gold ends at y:', goldTop, `(${(goldTop/height*100).toFixed(1)}%)`);
  console.log('  → Badge content starts at:', goldLeft, goldTop);
  console.log('  → Badge content width:', width - goldLeft*2);
  console.log('  → Badge content height:', height - goldTop*2);

  // Sample pixel in what should be the badge green area
  console.log('\nPixel in badge green area:');
  console.log('  At content edge:', px(goldLeft + 5, Math.floor(height/2)));
}

main().catch(console.error);
