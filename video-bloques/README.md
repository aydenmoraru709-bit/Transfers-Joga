# Ciudad de bloques — vídeo vertical (1080×1920, 37 s)

Vídeo estilo voxel/bloques para TikTok/Reels: «Esta ciudad tiene 0 habitantes».
Todo es procedural (three.js) y se renderiza fotograma a fotograma.

- `out/ciudad-bloques.mp4` — vídeo final.
- `scene.js` — mundo, cámaras, textos y línea de tiempo.
- `voice.py` — locución con ElevenLabs (frases en `vo/`). Solo hay que volver a ejecutarlo si cambias el guion.
- `audio.py` — mezcla música chiptune + efectos + locución.
- `render.mjs` — render con Chromium (Playwright) + ffmpeg.

```bash
npm install
./render.sh                # genera out/ciudad-bloques.mp4
node render.mjs --stills   # capturas de prueba en out/stills/
```

Requiere `ffmpeg`, Python 3 con `numpy` y Playwright con Chromium.
