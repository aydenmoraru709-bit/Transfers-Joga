"""Mezcla la banda sonora: música chiptune + efectos + locución (vo/NN.mp3)."""
import os, subprocess, sys
import numpy as np

SR, DUR = 44100, 37.0
here = os.path.dirname(os.path.abspath(__file__))
n = int(SR * DUR)
t = np.arange(n) / SR
rng = np.random.default_rng(3)

def note(freq, start, length, kind="sq", vol=1.0, decay=6.0):
    i0 = int(start * SR); m = min(int(length * SR), n - i0)
    if m <= 0: return np.zeros(0), i0
    x = np.arange(m) / SR
    ph = (x * freq) % 1.0
    w = np.where(ph < 0.5, 1.0, -1.0) if kind == "sq" else (4 * np.abs(ph - 0.5) - 1 if kind == "tri" else np.sin(2 * np.pi * freq * x))
    env = np.exp(-decay * x) * np.minimum(1, x / 0.005) * np.minimum(1, (m / SR - x) / 0.01)
    return w * env * vol, i0

def add(buf, sig_i0):
    sig, i0 = sig_i0
    buf[i0:i0 + len(sig)] += sig

# --- music: 130 bpm, C - G - Am - F
music = np.zeros(n)
beat = 60 / 130
chords = [[261.63, 329.63, 392.0], [196.0, 246.94, 293.66], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63]]
k = 0
while k * beat / 2 < DUR:
    ch = chords[(k // 16) % 4]
    st = k * beat / 2
    add(music, note(ch[[0, 1, 2, 1][k % 4]] * 2, st, beat / 2, "sq", 0.16, 9))
    if k % 4 == 0: add(music, note(ch[0] / 2, st, beat * 1.9, "tri", 0.5, 2.5))
    if k % 2 == 1:
        i0 = int(st * SR); m = int(0.04 * SR)
        if i0 + m < n: music[i0:i0 + m] += rng.uniform(-1, 1, m) * np.linspace(0.12, 0, m)
    if k % 8 == 0: add(music, note(60, st, 0.12, "sin", 0.7, 25))
    k += 1
music *= 0.22

# --- sfx
sfx = np.zeros(n)
def pop(st, f=520, vol=0.25): add(sfx, note(f, st, 0.07, "sin", vol, 40))
def ding(st, vol=0.3):
    add(sfx, note(988, st, 0.5, "sq", vol * 0.5, 8)); add(sfx, note(1319, st + 0.08, 0.6, "sq", vol * 0.5, 7))
for i in range(64): pop(10.2 + i / 64 * 3.4, 420 + (i % 16) * 12, 0.2)      # paredes
for i in range(0, 112, 2): pop(14.05 + i / 112 * 1.3, 640 + i * 2, 0.16)     # tejado
for i in range(14): pop(17.7 + i / 14 * 1.4, 500, 0.22)                      # vecinos
for i in range(60): pop(21.2 + (i / 60) ** 0.8 * 3.3, 440 + rng.integers(0, 5) * 60, 0.14)
for st in (26.0, 27.2, 28.4):
    for i in range(8): pop(st + i * 0.07, 380 + i * 40, 0.2)
for st in (10.3, 15.6, 19.7, 24.7, 29.6, 34.7): ding(st)
add(sfx, note(110, 19.6, 0.4, "sin", 0.8, 9))                                 # regalo cae
for st in (0, 3.2, 5.6, 8.0, 10.0, 14.0, 17.5, 19.3, 21.0, 25.0, 31.5, 33.1):  # whoosh de corte
    i0 = int(st * SR); m = int(0.18 * SR)
    if i0 + m < n: sfx[i0:i0 + m] += rng.uniform(-1, 1, m) * np.sin(np.linspace(0, np.pi, m)) ** 2 * 0.07

# --- voice
STARTS = [0, 3.2, 5.6, 8.0, 10.0, 14.0, 17.5, 19.3, 21.0, 25.0, 26.0, 27.2, 28.4, 29.6, 31.5, 33.1, 34.7]
voice = np.zeros(n)
for i, st in enumerate(STARTS):
    f = os.path.join(here, "vo", f"{i:02d}.mp3")
    if not os.path.exists(f): continue
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-af", "silenceremove=start_periods=1:start_threshold=-45dB",
                          "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    v = np.frombuffer(raw, dtype=np.float32)
    i0 = int((st + 0.12) * SR); v = v[: n - i0]
    voice[i0:i0 + len(v)] += v
voice *= 0.95 / max(1e-6, np.abs(voice).max())

# duck music under the voice
env = np.convolve(np.abs(voice), np.ones(SR // 8) / (SR // 8), mode="same")
duck = 1 - 0.55 * np.clip(env / 0.05, 0, 1)
mix = voice + music * duck + sfx * 0.6
mix *= np.minimum(1, (DUR - t) / 0.4)
mix = np.tanh(mix * 1.1) * 0.89
pcm = (np.stack([mix, mix], 1) * 32767).astype("<i2").tobytes()
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-", sys.argv[1]], input=pcm, check=True)
