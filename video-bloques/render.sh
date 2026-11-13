#!/bin/bash
# Renderiza un episodio en N procesos paralelos, une los tramos y añade el audio.
# Uso: EP=2 ./render.sh [procesos]   (EP=1 por defecto)
#      EP=3 N=<seguidores> ./render.sh
set -e
cd "$(dirname "$0")"
export EP=${EP:-1}
PROCS=${1:-$(nproc)}   # ojo: N es el número de seguidores (episodio 3), no los procesos
OUT=out/ciudad-bloques$([ "$EP" = 1 ] || echo "-$EP").mp4
mkdir -p out && rm -f out/part_*.mp4 out/list.txt
for i in $(seq 0 $((PROCS - 1))); do node render.mjs --part=$i/$PROCS & done
wait
for f in out/part_*.mp4; do echo "file '$(basename "$f")'" >> out/list.txt; done
[ "$(wc -l < out/list.txt)" = "$PROCS" ] || { echo "faltan tramos"; exit 1; }
python3 audio.py out/audio.wav "$EP" ${N:-}
ffmpeg -y -v error -f concat -i out/list.txt -i out/audio.wav -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"
rm -f out/part_*.mp4 out/list.txt out/audio.wav
echo "OK $OUT"
