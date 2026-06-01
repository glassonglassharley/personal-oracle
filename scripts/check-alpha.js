const sharp = require('sharp');
const path = require('path');
const LOGO = path.join(__dirname, '../client/public/logo.png');

async function main() {
  const { data, info } = await sharp(LOGO).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  console.log('Channels:', channels);

  function px(x, y) {
    const i = (y * width + x) * channels;
    return channels === 4
      ? { r: data[i], g: data[i+1], b: data[i+2], a: data[i+3] }
      : { r: data[i], g: data[i+1], b: data[i+2] };
  }

  console.log('\n=== Alpha values at key points ===');
  console.log('TL absolute corner (0,0):', px(0, 0));
  console.log('TL outer dark (50,50):', px(50, 50));
  console.log('TL badge corner (120,120):', px(120, 120));
  console.log('TL diagonal where green starts (253,253):', px(253, 253));
  console.log('Center (448,448):', px(448, 448));
  console.log('Top badge edge (448,120):', px(448, 120));
  console.log('Left badge edge (120,448):', px(120, 448));

  // Scan alpha along the top edge of the badge at y=99 (where badge starts)
  console.log('\n=== Alpha along y=99 (top of badge bounding box) ===');
  for (let x = 90; x <= 220; x += 5) {
    const p = px(x, 99);
    console.log(`  x=${x}: r=${p.r} g=${p.g} b=${p.b} a=${p.a}`);
  }

  // Scan alpha diagonally from corner
  console.log('\n=== Alpha diagonally from TL badge corner ===');
  for (let d = 0; d <= 200; d += 10) {
    const x = 99 + d, y = 99 + d;
    const p = px(x, y);
    const isTransparent = p.a < 10;
    const isSemiTrans = p.a >= 10 && p.a < 250;
    console.log(`  d=${d} (${x},${y}): a=${p.a}${isTransparent?' TRANSPARENT':isSemiTrans?' SEMI':''}  r=${p.r} g=${p.g} b=${p.b}`);
  }
}

main().catch(console.error);
