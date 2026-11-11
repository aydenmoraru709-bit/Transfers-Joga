// Renderiza el vídeo fotograma a fotograma con Chromium (Playwright) y ffmpeg.
// Uso:  node render.mjs            -> out/ciudad-bloques.mp4
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
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction('window.ready === true', null, { timeout: 60000 });
const duration = await page.evaluate('window.DURATION');
fs.mkdirSync(path.join(root, 'out/stills'), { recursive: true });

if (process.argv.includes('--stills')) {
  const times = [1, 4.5, 7.5, 9, 12, 14.8, 17, 19, 20.5, 24.9, 25.8, 27, 28.2, 29.4, 31, 32.5, 34, 36.8];
  for (const t of times) {
    await page.evaluate((x) => window.renderFrame(x), t);
    await page.screenshot({ path: path.join(root, `out/stills/t${String(t).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 80 });
  }
} else {
  const silent = path.join(root, 'out/silent.mp4');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(duration * FPS);
  for (let f = 0; f < total; f++) {
    await page.evaluate((x) => window.renderFrame(x), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 90 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  execFileSync('python3', [path.join(root, 'audio.py'), path.join(root, 'out/audio.wav')]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', silent, '-i', path.join(root, 'out/audio.wav'), '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', path.join(root, 'out/ciudad-bloques.mp4')]);
  fs.rmSync(silent); fs.rmSync(path.join(root, 'out/audio.wav'));
  console.log('OK out/ciudad-bloques.mp4');
}
await browser.close();
server.close();
