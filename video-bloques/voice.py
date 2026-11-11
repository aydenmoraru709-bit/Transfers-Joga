"""Genera la locución con ElevenLabs (una pista por frase) en vo/NN.mp3.
Uso: ELEVENLABS_API_KEY=... python3 voice.py   (solo hace falta si cambias el guion)"""
import json, os, subprocess, sys

VOICE = "y6WtESLj18d0diFRruBs"  # David Martin (castellano)
LINES = [
    "¡Esta ciudad tiene cero habitantes!",
    "¡Y este es su alcalde!",
    "Pero no tiene ni un vecino.",
    "¿La solución? ¡Tú!",
    "Cada nuevo seguidor será un habitante.",
    "Y si comentas, construiré una casa con tu nombre.",
    "Al llegar a cien...",
    "¡desbloqueamos una sorpresa!",
    "Y a los mil, vosotros decidís cómo crece la ciudad.",
    "Primera votación:",
    "¿Plaza...",
    "hospital...",
    "o centro comercial?",
    "¡Comenta A, B o C!",
    "En un día anunciaré el ganador.",
    "Hoy está vacía.",
    "¿Será tuya la primera casa?",
]
key = os.environ.get("ELEVENLABS_API_KEY", "proxy-injected")
here = os.path.dirname(os.path.abspath(__file__))
only = [int(a) for a in sys.argv[1:]]
for i, text in enumerate(LINES):
    if only and i not in only:
        continue
    body = {
        "text": text, "model_id": "eleven_multilingual_v2", "language_code": None,
        "voice_settings": {"stability": 0.35, "similarity_boost": 0.8, "style": 0.45, "speed": 1.12},
        "previous_text": " ".join(LINES[max(0, i - 2):i]) or None,
        "next_text": " ".join(LINES[i + 1:i + 2]) or None,
    }
    body = {k: v for k, v in body.items() if v is not None}
    out = os.path.join(here, "vo", f"{i:02d}.mp3")
    subprocess.run(["curl", "-sS", "--fail-with-body", "-m", "60", "-X", "POST",
                    f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
                    "-H", f"xi-api-key: {key}", "-H", "content-type: application/json",
                    "-d", json.dumps(body), "-o", out], check=True)
    print(i, text)
