const sharp = require('sharp');
const path = require('path');
const LOGO = path.join(__dirname, '../client/public/logo.png');

async function main() {
  const { data, info } = await sharp(LOGO).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  function px(x, y) {
    const i = (y * width + x) * channels;
    return { r: data[i], g: data[i+1], b: data[i+2] };
  }

  const midY = Math.floor(height / 2);
  const midX = Math.floor(width / 2);

  // Scan left→right at midpoint to find dark/gold/green transitions
  console.log('=== Horizontal scan at y=midpoint ===');
  for (let x = 90; x < 200; x += 1) {
    const p = px(x, midY);
    const isGold = p.r > 140 && p.r > p.b + 40;
    const isGreen = p.g > p.r + 5 && p.b < 100;
    const label = isGold ? ' GOLD' : isGreen ? ' GREEN' : ' dark';
    if (x < 110 || (x > 100 && x < 180 && (isGold || isGreen))) {
      console.log(`  x=${x}: r=${p.r} g=${p.g} b=${p.b}${label}`);
    }
  }

  // Find exact point where green starts (left side)
  let greenStart = -1;
  for (let x = 99; x < 300; x++) {
    const p = px(x, midY);
    if (p.g > p.r + 5 && p.b < 100 && p.g > 30) {
      greenStart = x;
      break;
    }
  }
  console.log('\nGreen content starts at x:', greenStart, `(${(greenStart/width*100).toFixed(1)}%)`);

  // Scan top→bottom at midpoint for vertical structure
  console.log('\n=== Vertical scan at x=midpoint ===');
  let vGreenStart = -1;
  for (let y = 50; y < 450; y++) {
    const p = px(midX, y);
    const isGold = p.r > 140 && p.r > p.b + 40;
    const isGreen = p.g > p.r + 5 && p.b < 100 && p.g > 30;
    if (y < 110 || isGold || isGreen) {
      if (y < 115 || (isGreen && vGreenStart === -1)) {
        console.log(`  y=${y}: r=${p.r} g=${p.g} b=${p.b}${isGold ? ' GOLD' : isGreen ? ' GREEN' : ''}`);
      }
    }
    if (isGreen && vGreenStart === -1) vGreenStart = y;
  }
  console.log('Vertical green starts at y:', vGreenStart, `(${(vGreenStart/height*100).toFixed(1)}%)`);

  // Scan at x=150 (inside badge, near left edge) to find vertical extent of badge
  console.log('\n=== Vertical scan at x=150 ===');
  let topAt150 = -1;
  for (let y = 0; y < height/2; y++) {
    const p = px(150, y);
    if (p.r > 30 || p.g > 30 || p.b > 30) {
      topAt150 = y;
      console.log(`  First non-dark at y=${y}: r=${p.r} g=${p.g} b=${p.b}`);
      break;
    }
  }

  // Scan at x=150, find where green starts (after gold border)
  let greenAt150 = -1;
  for (let y = topAt150; y < height/2; y++) {
    const p = px(150, y);
    if (p.g > p.r + 5 && p.b < 100 && p.g > 30) {
      greenAt150 = y;
      console.log(`  Green starts at y=${y}: r=${p.r} g=${p.g} b=${p.b}`);
      break;
    }
  }

  console.log('\n=== Summary ===');
  const outerDark = 99;
  const goldWidth = greenStart - outerDark;
  const innerCrop = greenStart;
  const innerWidth = width - innerCrop * 2;
  console.log(`Outer dark border: ${outerDark}px each side`);
  console.log(`Gold border width: ${goldWidth}px`);
  console.log(`Inner content (inside gold) starts at: x=${innerCrop}`);
  console.log(`Inner content dimensions: ${innerWidth} x ${innerWidth} (if symmetric)`);
  console.log(`Inner content as % of full image: ${(innerWidth/width*100).toFixed(1)}%`);
  console.log(`\nFor icon generation:`);
  console.log(`  Use extract: { left: ${innerCrop}, top: ${greenAt150 || innerCrop}, width: ${innerWidth}, height: ${innerWidth} }`);
}

main().catch(console.error);
