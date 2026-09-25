// Screenshot the /dev/trees contact sheet in every theme at desktop and
// mobile widths. Needs the client dev server running (npm run dev:client).
//
//   node scripts/tree-screens.mjs [--out docs/tree-screens] [--base http://localhost:5173]
//                                 [--themes emerald,mint] [--sections] [--bg theme]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
};
const flag = name => args.includes(`--${name}`);

const out = opt('out', 'docs/tree-screens');
const base = opt('base', 'http://localhost:5173');
const bg = opt('bg', 'theme');
const themes = opt('themes', 'emerald,mint,plum,noir,red,orange,pink,neon').split(',');
const only = opt('species', '');
const viewports = [
  { name: 'desktop', width: 1440, height: 900, scale: 1 },
  { name: 'mobile', width: 390, height: 844, scale: 1 },
].filter(v => !opt('viewport', '') || v.name === opt('viewport', ''));

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${vp.name}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${vp.name}] ${e.message}`));
  for (const theme of themes) {
    const url = `${base}/dev/trees?theme=${theme}&bg=${bg}${only ? `&species=${only}` : ''}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('.dev-tree-perf', { timeout: 60000 });
    const file = join(out, `sheet-${vp.name}-${theme}.jpg`);
    await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 60 });
    console.log('saved', file);
    if (flag('sections')) {
      for (const el of await page.$$('[data-shot]')) {
        const id = await el.getAttribute('data-shot');
        await el.screenshot({ path: join(out, `sec-${vp.name}-${theme}-${id}.png`) });
      }
    }
  }
  if (!only && vp.name === 'desktop') {
    const perf = await page.evaluate(() => window.__treePerf);
    console.log(JSON.stringify(perf));
  }
  await ctx.close();
}
await browser.close();
if (errors.length) {
  console.log(`console errors/warnings (${errors.length}):`);
  for (const e of [...new Set(errors)].slice(0, 30)) console.log(' ', e);
} else {
  console.log('no console errors or warnings');
}
