# Ciudad de bloques — vídeo vertical (1080×1920, 37 s)

Vídeo estilo voxel/bloques para TikTok/Reels: «Esta ciudad tiene 0 habitantes».
Todo es procedural (three.js) y se renderiza fotograma a fotograma.

- `out/ciudad-bloques.mp4` — episodio 1 (ciudad vacía, 37 s).
- `out/ciudad-bloques-2.mp4` — episodio 2 (28 habitantes, una casa por comentario, gana la plaza).
- `scene.js` / `scene2.js` — mundo, cámaras, textos y línea de tiempo de cada episodio.
  En `scene2.js`, `NAMES` y `FOLLOWERS` son los datos reales (comentarios y seguidores).
- `voice.py` — locución con ElevenLabs (frases en `vo/` y `vo2/`). Solo hay que volver a ejecutarlo si cambias el guion.
- `audio.py` — mezcla música chiptune + efectos + locución.
- `render.mjs` / `render.sh` — render con Chromium (Playwright) + ffmpeg, repartido en procesos.

```bash
npm install
./render.sh                       # episodio 1 -> out/ciudad-bloques.mp4
EP=2 ./render.sh                  # episodio 2 -> out/ciudad-bloques-2.mp4
EP=2 node render.mjs --stills     # capturas de prueba en out/stills/
```

Requiere `ffmpeg`, Python 3 con `numpy` y Playwright con Chromium.
