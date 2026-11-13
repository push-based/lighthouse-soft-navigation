// Renders public/og-image.png (1200×630), the preview card for links to the
// docs, from an HTML version of the landing page hero, and the favicon and
// touch icon from the mark. Run it after changing the hero's look or the mark:
//
//   node packages/docs/scripts/og-image.mjs
//
// It needs the repository's puppeteer and fetches the Geist fonts.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launch } from 'puppeteer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mark = await readFile(join(root, 'public/images/mark.svg'), 'utf8');
const symbol = mark.replace(
  /<svg[^>]*>/,
  '<svg width="0" height="0" style="position:absolute">',
);

const metrics = [
  ['FCP', '0.4 s'],
  ['LCP', '0.7 s'],
  ['Performance', '97'],
];

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600&family=Geist+Mono:wght@500;600&display=swap">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; font-family: Geist, system-ui, sans-serif; color: #f8fafc; background: #0d121c; position: relative; }
  .grid { position: absolute; inset: 0; background-image: radial-gradient(#364152 1.2px, transparent 1.6px); background-size: 24px 24px; mask-image: radial-gradient(ellipse 70% 80% at 60% 30%, #000 20%, transparent 80%); }
  .blob { position: absolute; border-radius: 50%; filter: blur(90px); }
  .blob-1 { width: 620px; height: 420px; left: 560px; top: -140px; background: rgb(105 39 218 / 0.55); }
  .blob-2 { width: 420px; height: 320px; left: -120px; top: 330px; background: rgb(177 3 44 / 0.35); }
  .copy { position: absolute; left: 80px; top: 110px; width: 620px; }
  .pill { display: inline-flex; align-items: center; gap: 10px; padding: 6px 14px 6px 12px; border: 1px solid #5720b7; border-radius: 999px; background: rgb(18 25 38 / 0.7); font-family: 'Geist Mono', monospace; font-size: 15px; color: #ddd6fe; }
  .pill i { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 4px rgb(34 197 94 / 0.25); }
  .pill span { padding-left: 10px; border-left: 1px solid #5720b7; color: #9aa4b2; }
  h1 { margin: 26px 0 0; font-size: 72px; line-height: 1.02; font-weight: 600; letter-spacing: -0.035em; }
  h1 b { font-weight: 600; background: linear-gradient(100deg, #c3b5fd, #ff94ad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  p { margin: 24px 0 0; font-size: 24px; line-height: 1.4; color: #9aa4b2; max-width: 560px; }
  .url { position: absolute; left: 80px; bottom: 54px; font-family: 'Geist Mono', monospace; font-size: 20px; color: #cdd5df; }
  .scene { position: absolute; right: 70px; top: 120px; width: 420px; }
  .window { border: 1px solid #364152; border-radius: 18px; background: #121926; box-shadow: 0 30px 60px -20px rgb(0 0 0 / .7); overflow: hidden; }
  .bar { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #202939; background: #0d121c; }
  .bar i { width: 10px; height: 10px; border-radius: 50%; background: #364152; }
  .addr { flex: 1; padding: 4px 12px; border: 1px solid #202939; border-radius: 999px; font-family: 'Geist Mono', monospace; font-size: 14px; color: #697586; }
  .addr b { font-weight: 500; color: #c3b5fd; }
  .badge { white-space: nowrap; padding: 2px 10px; border-radius: 999px; background: #2e125e; color: #ddd6fe; font-family: 'Geist Mono', monospace; font-size: 12px; }
  .page { display: grid; gap: 10px; padding: 18px; }
  .title { width: 40%; height: 14px; border-radius: 6px; background: #364152; }
  .row { display: flex; gap: 12px; align-items: center; padding: 8px; border: 1px solid #202939; border-radius: 10px; }
  .row i { width: 40px; height: 28px; border-radius: 6px; background: rgb(135 91 247 / .35); }
  .row span { flex: 1; display: grid; gap: 6px; }
  .row u { display: block; height: 7px; width: 80%; border-radius: 4px; background: #202939; }
  .row u + u { width: 50%; }
  .metrics { display: flex; justify-content: center; gap: 10px; margin-top: 22px; }
  .metric { padding: 8px 16px; border: 1px solid #364152; border-radius: 999px; background: #121926; font-size: 16px; color: #9aa4b2; }
  .metric b { margin-left: 6px; font-family: 'Geist Mono', monospace; color: #f8fafc; }
  .metric.score { border-color: transparent; background: #16a34a; color: #fff; }
  .metric.score b { color: #fff; }
</style></head>
<body>
${symbol}
<div class="grid"></div>
<div class="blob blob-1"></div>
<div class="blob blob-2"></div>
<div class="copy">
  <div class="pill"><i></i>@push-based/lighthouse-soft-navigation<span>Lighthouse</span></div>
  <h1>Soft navigations, measured <b>as navigations.</b></h1>
  <p>One Lighthouse config turns route changes into navigation steps with FCP, LCP and a Performance score.</p>
</div>
<div class="url">push-based.github.io/lighthouse-soft-navigation</div>
<div class="scene">
  <div class="window">
    <div class="bar"><i></i><i></i><i></i><span class="addr">shop.example<b>/products</b></span><span class="badge">soft navigation</span></div>
    <div class="page"><span class="title"></span>${'<span class="row"><i></i><span><u></u><u></u></span></span>'.repeat(3)}</div>
  </div>
  <div class="metrics">
    ${metrics.map(([label, value], i) => `<span class="metric${i === 2 ? ' score' : ''}">${label}<b>${value}</b></span>`).join('')}
  </div>
</div>
</body></html>`;

const browser = await launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: 'png' });
await writeFile(join(root, 'public/og-image.png'), png);
console.log('wrote public/og-image.png');

// The favicon and the touch icon: the mark on a light tile.
for (const [file, size, pad] of [
  ['favicon.png', 64, 0],
  ['apple-touch-icon.png', 180, 20],
]) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<body style="margin:0;background:${pad ? '#fff' : 'transparent'}">${symbol}<svg viewBox="0 0 1360 1360" style="display:block;margin:${pad}px;width:${size - 2 * pad}px;height:${size - 2 * pad}px;stroke:#0d121c;color:#fff"><use href="#mark"/></svg></body>`,
  );
  await writeFile(
    join(root, 'public', file),
    await page.screenshot({ type: 'png', omitBackground: !pad }),
  );
  console.log(`wrote public/${file}`);
}

await browser.close();
