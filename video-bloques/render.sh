#!/bin/bash
# Renderiza el vídeo en N procesos paralelos, une los tramos y añade el audio.
set -e
cd "$(dirname "$0")"
N=${1:-$(nproc)}
mkdir -p out && rm -f out/part_*.mp4 out/list.txt
for i in $(seq 0 $((N - 1))); do node render.mjs --part=$i/$N & done
wait
for f in out/part_*.mp4; do echo "file '$(basename "$f")'" >> out/list.txt; done
[ "$(wc -l < out/list.txt)" = "$N" ] || { echo "faltan tramos"; exit 1; }
python3 audio.py out/audio.wav
ffmpeg -y -v error -f concat -i out/list.txt -i out/audio.wav -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart out/ciudad-bloques.mp4
rm -f out/part_*.mp4 out/list.txt out/audio.wav
echo "OK out/ciudad-bloques.mp4"
