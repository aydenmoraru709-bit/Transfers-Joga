"""Genera la locución con ElevenLabs (una pista por frase) en vo/NN.mp3.
Uso: EP=2 ELEVENLABS_API_KEY=... python3 voice.py   (solo hace falta si cambias el guion)"""
import json, os, subprocess, sys

VOICE = "y6WtESLj18d0diFRruBs"  # David Martin (castellano)
EPISODES = {
    "1": ("vo", [
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
    ]),
    "2": ("vo2", [
        "¡Ayer, cero habitantes. Hoy ya somos veintiocho!",
        "¡Y vuestras casas ya están construidas!",
        "Dieciocho casas, cada una con vuestro nombre. ¿Está la tuya?",
        "En la votación, ganó la A...",
        "¡la plaza!",
        "¿Aún no tienes casa? Comenta, y te la construyo.",
        "¡Y a los cien, sorpresa!",
    ]),
    # 04 = versión "sorpresa desbloqueada" (>= 100 seguidores); 06 = versión "aún no llegamos"
    "3": ("vo3", [
        "¡La ciudad no para de crecer!",
        "¡Sesenta y dos casas nuevas en un solo día!",
        "Cada una con vuestro nombre. Pausa el vídeo y busca la tuya.",
        "Segunda votación: ¿A, hospital, o B, centro comercial?",
        "¡Hemos llegado a cien habitantes! Mañana abrimos la sorpresa.",
        "¿Aún no tienes casa? Comenta, y te la construyo.",
        "¡Y a los cien, sorpresa!",
        "Nuevo vídeo cada día a las cinco y veinte. Sígueme antes de las cinco, o no saldrás.",
    ]),
}
EP = os.environ.get("EP", "1")
VO_DIR, LINES = EPISODES[EP]
key = os.environ.get("ELEVENLABS_API_KEY", "proxy-injected")
here = os.path.dirname(os.path.abspath(__file__))
only = [int(a) for a in sys.argv[1:]]
os.makedirs(os.path.join(here, VO_DIR), exist_ok=True)
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
    out = os.path.join(here, VO_DIR, f"{i:02d}.mp3")
    subprocess.run(["curl", "-sS", "--fail-with-body", "-m", "60", "-X", "POST",
                    f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128",
                    "-H", f"xi-api-key: {key}", "-H", "content-type: application/json",
                    "-d", json.dumps(body), "-o", out], check=True)
    print(i, text)
