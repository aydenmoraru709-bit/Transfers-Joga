// Renderiza el vídeo fotograma a fotograma con Chromium (Playwright) y ffmpeg.
// Uso:  ./render.sh                -> out/ciudad-bloques.mp4 (reparte en procesos y mezcla el audio)
//       node render.mjs --stills   -> out/stills/*.jpg (una captura por escena)
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const root = path.dirname(new URL(import.meta.url).pathname);
const FPS = 30;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => { console.error('PAGE ERROR', e); process.exit(1); });
page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
const EP = process.env.EP ?? '1';
await page.goto(`http://localhost:${port}/index.html?ep=${EP}${process.env.N ? `&n=${process.env.N}` : ''}${process.env.PLUS ? '&plus=1' : ''}`);
await page.waitForFunction('window.ready === true', null, { timeout: 60000 });
const duration = await page.evaluate('window.DURATION');
fs.mkdirSync(path.join(root, 'out/stills'), { recursive: true });

if (process.argv.includes('--stills')) {
  const times = [1, 4.5, 7.5, 9, 12, 14.8, 17, 19, 20.5, 24.9, 25.8, 27, 28.2, 29.4, 31, 32.5, 34, 36.8];
  for (const t of (await page.evaluate('window.STILLS')) ?? times) {
    await page.evaluate((x) => window.renderFrame(x), t);
    await page.screenshot({ path: path.join(root, `out/stills/t${String(t).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 80 });
  }
} else {
  // --part=i/n renderiza solo un tramo (para repartir el trabajo entre varios procesos)
  const [pi, pn] = (process.argv.find((a) => a.startsWith('--part=')) ?? '--part=0/1').slice(7).split('/').map(Number);
  const total = Math.round(duration * FPS);
  const f0 = Math.floor((total * pi) / pn), f1 = Math.floor((total * (pi + 1)) / pn);
  const part = path.join(root, `out/part_${String(pi).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p', part + '.tmp.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = f0; f < f1; f++) {
    await page.evaluate((x) => window.renderFrame(x), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 60 === 0) console.log(`part ${pi}: frame ${f - f0}/${f1 - f0}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  fs.renameSync(part + '.tmp.mp4', part);
}
await browser.close();
server.close();
