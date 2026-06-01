// Find where the gold/frame pixels end diagonally from the badge corner
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

  console.log('=== Diagonal scan from TL corner inward ===');
  // The badge corner is at approximately (99,99). Scan diagonally inward.
  let greenCorner = -1;
  for (let d = 0; d < 300; d++) {
    const x = 99 + d, y = 99 + d;
    const p = px(x, y);
    const isGold = p.r > 100 && p.r > p.b + 30;
    const isDark = p.r < 40 && p.g < 50 && p.b < 40;
    const isGreen = !isGold && p.g > p.r + 5 && p.g > 30;
    if (d < 100 || isGreen) {
      console.log(`  d=${d} (${x},${y}): r=${p.r} g=${p.g} b=${p.b}${isGold?' GOLD':isDark?' dark':isGreen?' GREEN':''}`);
    }
    if (isGreen && greenCorner === -1) {
      greenCorner = d;
      console.log(`  ^^^ GREEN starts here: d=${d}, coord=(${x},${y})`);
    }
    if (greenCorner !== -1 && d > greenCorner + 5) break;
  }

  // Scan horizontally near the top of the badge (y=150) to find gold extent
  console.log('\n=== Horizontal scan at y=150 ===');
  for (let x = 99; x < 280; x++) {
    const p = px(x, 150);
    const isGold = p.r > 100 && p.r > p.b + 30;
    const isGreen = !isGold && p.g > p.r + 5 && p.g > 30;
    if (x < 130 || isGold || isGreen) {
      console.log(`  x=${x}: r=${p.r} g=${p.g} b=${p.b}${isGold?' GOLD':isGreen?' GREEN':''}`);
      if (isGreen) { console.log('  (green found)'); break; }
    }
  }

  // Scan at y=200 (slightly lower)
  console.log('\n=== Horizontal scan at y=200 ===');
  let greenAt200 = -1;
  for (let x = 99; x < 300; x++) {
    const p = px(x, 200);
    const isGold = p.r > 100 && p.r > p.b + 30;
    const isGreen = !isGold && p.g > p.r + 5 && p.g > 30;
    if (isGold || (x < 140 && !isGreen)) {
      console.log(`  x=${x}: r=${p.r} g=${p.g} b=${p.b}${isGold?' GOLD':''}`);
    }
    if (isGreen && greenAt200 === -1) {
      greenAt200 = x;
      console.log(`  x=${x}: r=${p.r} g=${p.g} b=${p.b} GREEN — green starts here`);
      break;
    }
  }

  // What's the safe inner crop that clears all gold at corners?
  console.log('\n=== Recommendation ===');
  console.log(`Safe crop to clear gold at all angles: left=${greenCorner+99} each side`);
  const safeLeft = greenCorner + 99 + 5; // +5 safety margin
  const safeWidth = width - safeLeft * 2;
  console.log(`With 5px safety margin: left=${safeLeft}, width=${safeWidth}, height=${safeWidth}`);
}

main().catch(console.error);
