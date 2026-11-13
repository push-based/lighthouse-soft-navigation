// Renders public/og-image.png (1200×630), the preview card for links to the
// docs, from an HTML version of the landing page hero. Run it after changing
// the hero's look:
//
//   node packages/docs/scripts/og-image.mjs
//
// It needs the repository's puppeteer and fetches the Geist fonts.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launch } from 'puppeteer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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
  .scene { position: absolute; right: 70px; top: 130px; width: 420px; }
  .card { border: 1px solid #364152; border-radius: 18px; background: #121926; box-shadow: 0 30px 60px -20px rgb(0 0 0 / .7); overflow: hidden; }
  .bar { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #202939; background: #0d121c; font-size: 14px; color: #9aa4b2; }
  .bar i { width: 10px; height: 10px; border-radius: 50%; background: #364152; }
  .bar i + span { margin-left: 4px; }
  .switch { display: grid; grid-template-columns: 1fr 1fr; margin: 16px 16px 0; padding: 3px; border: 1px solid #202939; border-radius: 10px; font-family: 'Geist Mono', monospace; font-size: 13px; text-align: center; color: #697586; }
  .switch span { padding: 6px; border: 1px solid transparent; border-radius: 7px; }
  .switch .on { border-color: #5720b7; background: #2e125e; color: #ddd6fe; }
  .steps { display: grid; gap: 12px; padding: 16px; }
  .step { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; padding: 14px; border: 1px solid #202939; border-radius: 12px; }
  .step.soft { border-color: #5720b7; }
  .num { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #2e125e; color: #ddd6fe; font-family: 'Geist Mono', monospace; font-size: 14px; font-weight: 600; }
  .name { display: block; font-size: 17px; font-weight: 600; }
  .note { display: block; margin-top: 4px; font-size: 14px; color: #9aa4b2; }
  .note b { font-family: 'Geist Mono', monospace; font-weight: 500; color: #f8fafc; }
  .gauge { display: grid; place-items: center; width: 52px; height: 52px; border: 4px solid #4ade80; border-radius: 50%; font-family: 'Geist Mono', monospace; font-size: 16px; font-weight: 600; color: #4ade80; }
  .gauge.average { border-color: #fbbf24; color: #fbbf24; }
</style></head>
<body>
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
  <div class="card">
    <div class="bar"><i></i><i></i><i></i><span>Lighthouse user flow</span></div>
    <div class="switch"><span>Stock Lighthouse</span><span class="on">With the config</span></div>
    <div class="steps">
      <div class="step"><span class="num">1</span><span><span class="name">Page load</span><span class="note">Measured as a navigation</span></span><span class="gauge average">88</span></div>
      <div class="step soft"><span class="num">2</span><span><span class="name">Soft navigation</span><span class="note">FCP <b>0.4 s</b> · LCP <b>0.7 s</b></span></span><span class="gauge">97</span></div>
    </div>
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

await browser.close();
