"""Banda sonora del vídeo de Rotafy: música + efectos, sincronizados con PromoFilm.

Salida: music.wav (solo música), sfx.wav (solo efectos), mix.wav (todo).
"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48_000
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))


def add(buf, x, at, gain=1.0, pan=0.0):
    """Mezcla x (mono o estéreo) en buf a partir de `at` segundos."""
    i = int(at * SR)
    if i >= N:
        return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], axis=1)
    n = min(len(x), N - i)
    buf[i:i + n] += x[:n] * gain


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.005, r=0.1, curve=None):
    t = tt(d)
    e = np.minimum(1, t / max(a, 1e-4))
    if curve is not None:
        e *= np.exp(-t / curve)
    rel = np.clip((d - t) / max(r, 1e-4), 0, 1)
    return e * rel


def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), "low")
    return signal.lfilter(b, a, x, axis=0)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), "high")
    return signal.lfilter(b, a, x, axis=0)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x, axis=0)


def note(n):
    """Nombre → Hz (A4 = 440)."""
    names = {"C": -9, "C#": -8, "Db": -8, "D": -7, "D#": -6, "Eb": -6, "E": -5, "F": -4, "F#": -3, "Gb": -3, "G": -2, "G#": -1, "Ab": -1, "A": 0, "A#": 1, "Bb": 1, "B": 2}
    name, octv = n[:-1], int(n[-1])
    return 440 * 2 ** ((names[name] + (octv - 4) * 12) / 12)


def reverb(x, secs=2.6, damp=5000, wet=0.3):
    ir_n = int(secs * SR)
    t = np.arange(ir_n) / SR
    ir = rng.standard_normal((ir_n, 2)) * np.exp(-t / (secs / 6.5))[:, None]
    ir = lp(ir, damp)
    ir[: int(0.012 * SR)] = 0  # pre-delay
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x * (1 - wet) + y * wet * 2.2


def delay(x, secs, fb=0.35, mix=0.25, n=5):
    d = int(secs * SR)
    y = np.zeros((len(x) + d * n, 2))
    y[: len(x)] += x
    for k in range(1, n):
        g = mix * fb ** (k - 1)
        sh = x[:, ::-1] if k % 2 else x  # ping-pong
        y[d * k:d * k + len(x)] += sh * g
    return y


# ---------- Instrumentos ----------

def pad(freqs, d, a=0.8, r=1.2):
    t = tt(d)
    x = np.zeros((len(t), 2))
    for f in freqs:
        for k, det in enumerate([-0.11, -0.04, 0.03, 0.09, 0.0]):
            ff = f * 2 ** (det / 12)
            ph = rng.random()
            saw = 2 * ((t * ff + ph) % 1) - 1
            pan = [-0.8, -0.4, 0.4, 0.8, 0][k]
            x[:, 0] += saw * (1 - pan) / 2
            x[:, 1] += saw * (1 + pan) / 2
    x = lp(x, 1600, 2)
    x = lp(x, 2400, 1)
    return x * env(d, a, r)[:, None] / (len(freqs) * 3)


def pluck(f, d=0.9, bright=1.0):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) + 0.35 * bright * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.08) + 0.12 * bright * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.05)
    return x * env(d, 0.003, 0.05, curve=0.22)


def bass(f, d):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    x = np.tanh(1.6 * x) * env(d, 0.01, 0.08)
    return lp(x, 400)


def kick():
    d = 0.5
    t = tt(d)
    f = 45 + 95 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / 0.18)
    x += lp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.3 * x)


def snap():
    d = 0.35
    t = tt(d)
    n = bp(rng.standard_normal(len(t)), 900, 4500)
    e = np.zeros(len(t))
    for off in (0, 0.009, 0.019):
        e += np.where(t >= off, np.exp(-(t - off) / 0.012), 0) * 0.6
    e += np.exp(-t / 0.09) * 0.5
    return n * e * 0.9


def hat(open_=False):
    d = 0.25 if open_ else 0.06
    t = tt(d)
    return hp(rng.standard_normal(len(t)), 7500) * np.exp(-t / (0.07 if open_ else 0.014))


# ---------- Efectos ----------

def click():
    t = tt(0.03)
    x = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.0025) * 0.7 + np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.004) * 0.5
    return x


def tap():
    t = tt(0.06)
    return np.sin(2 * np.pi * 520 * t) * np.exp(-t / 0.012) + 0.3 * hp(rng.standard_normal(len(t)), 3000) * np.exp(-t / 0.002)


def bell(f, d=1.4):
    t = tt(d)
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (0.5 / m ** 0.6)) for m, a in [(1, 1), (2.0, 0.35), (2.76, 0.2), (5.4, 0.08)])
    return x * env(d, 0.002, 0.2)


def ding():
    x = np.zeros(int(1.6 * SR))
    a = bell(note("E6"))
    b = bell(note("B6"))
    x[: len(a)] += a
    o = int(0.11 * SR)
    x[o:o + len(b)] += b[: len(x) - o]
    return x * 0.5


def success():
    x = np.zeros(int(1.4 * SR))
    for k, n in enumerate(["D6", "F#6", "A6"]):
        p = pluck(note(n), 1.0, 0.6)
        o = int(k * 0.07 * SR)
        x[o:o + len(p)] += p[: len(x) - o] * (0.8 - k * 0.1)
    return x * 0.45


def pop(f=700):
    t = tt(0.12)
    fr = f * (1 + 0.6 * np.exp(-t / 0.012))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.03)
    return x


def whoosh(d=1.0, lo=300, hi=5000, up=True):
    t = tt(d)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    steps = 40
    seg = len(t) // steps + 1
    for k in range(steps):
        p = k / (steps - 1)
        fc = lo * (hi / lo) ** (p if up else 1 - p)
        s, e = k * seg, min(len(t), (k + 1) * seg + 2000)
        y = bp(n[max(0, s - 2000):e], fc * 0.7, min(fc * 1.4, SR / 2 - 100))
        y = y[(s - max(0, s - 2000)):]
        out[s:s + len(y)] += y[: len(out) - s] * np.hanning(len(y))[: len(out) - s]
    shape = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    if up:
        shape = (t / d) ** 2 * np.exp(-(np.maximum(0, t / d - 0.85)) * 30)
    return out * shape


def riser(d=1.7):
    t = tt(d)
    f = 180 * (8 ** (t / d))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    return (whoosh(d, 400, 9000, True) + tone * (t / d) ** 2) * 0.8


def boom():
    d = 2.2
    t = tt(d)
    f = 28 + 50 * np.exp(-t / 0.25)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    x += lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.15) * 0.4
    return np.tanh(1.5 * x)


def tick(f=2600):
    t = tt(0.03)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.005) + 0.2 * hp(rng.standard_normal(len(t)), 4000) * np.exp(-t / 0.002)


def key():
    t = tt(0.04)
    return bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t / 0.006)


# ---------- Tiempos (los mismos que PromoFilm.tsx) ----------
DEMO_IN, SPEED, DEMO_FROM = 9.4, 1.15, 0.3


def film_at(dt_ms):
    return DEMO_IN + (dt_ms / 1000 - DEMO_FROM) / SPEED


END_IN = 51.8
FEAT_A = 44.7

# ---------- Música ----------
BAR = (END_IN + 0.1 - DEMO_IN) / 18  # 18 compases exactos entre la app y el cierre
BEAT = BAR / 4
PROG = [  # acorde, bajo
    (["D3", "F#3", "A3", "C#4", "E4"], "D2"),
    (["B2", "D3", "F#3", "A3", "C#4"], "B1"),
    (["G2", "B2", "D3", "F#3", "A3"], "G1"),
    (["A2", "D3", "E3", "G3", "B3"], "A1"),
]
ARP = [0, 2, 4, 3, 1, 3, 4, 2]

# 1) Tensión inicial: dron grave y reloj
t = tt(5.3)
drone = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 55.4 * t) + 0.3 * np.sin(2 * np.pi * 82.4 * t)) * 0.18
drone += lp(rng.standard_normal(len(t)), 300) * 0.05
drone *= np.minimum(1, t / 1.2) * np.clip((5.3 - t) / 0.3, 0, 1) * (1 + 0.8 * np.clip((t - 2.6) / 2.5, 0, 1))
add(music, drone, 0)
for k in range(10):
    add(sfx, tick(2600 if k % 2 == 0 else 2100), 0.25 + k * 0.5, 0.18 * (1 - k / 14), pan=0.3 if k % 2 else -0.3)
# Acorde menor oscuro bajo la pregunta
add(music, reverb(pad([note("D3"), note("F3"), note("A3"), note("C4")], 2.6, 0.6, 0.6), 3, 3000, 0.4), 2.75, 0.55)

# 2) Golpe y logo
add(music, reverb(np.stack([boom()] * 2, 1), 2.5, 2000, 0.25), 5.25, 0.6)
logo_chord = pad([note(n) for n in ["D3", "A3", "E4", "F#4", "C#5"]], 4.4, 0.05, 1.6)
add(music, reverb(logo_chord, 3.5, 6000, 0.5), 5.25, 1.1)
for k, n in enumerate(["D5", "E5", "F#5", "A5", "C#6", "E6"]):  # letras
    add(music, delay(np.stack([pluck(note(n), 1.2, 0.5)] * 2, 1), BEAT * 0.75, 0.4, 0.3), 5.6 + k * 0.055, 0.22, )
add(music, reverb(np.stack([bell(note("A5"), 2.0) * 0.3] * 2, 1), 3, 7000, 0.6), 6.45, 0.5)

# 3) Ritmo de la app (18 compases) y salida
groove = np.zeros((N, 2))
pads = np.zeros((N, 2))
side = np.ones(N)  # «sidechain» del bombo sobre el pad
n_bars = 18
for b in range(n_bars):
    t0 = DEMO_IN + b * BAR
    chord, root = PROG[b % 4]
    intensity = 0 if b < 1 else (1 if b < 3 else 2)
    if b >= 15:  # «Y además»: más brillo
        intensity = 3
    add(pads, pad([note(n) for n in chord[:4]], BAR + 0.4, 0.4 if b else 1.2, 0.5), t0, 0.9)
    for s in range(8):  # arpegio en corcheas
        f = note(chord[ARP[s]]) * 2
        add(groove, pluck(f, 0.7, 0.8 if intensity < 3 else 1.1), t0 + s * BEAT / 2, 0.09 + 0.02 * (s % 2 == 0), pan=-0.35 if s % 2 else 0.35)
    if intensity >= 1:
        for s in (0, 2, 2.5):
            add(groove, bass(note(root), BEAT * (0.9 if s != 2 else 0.45)), t0 + s * BEAT, 0.32)
        for s in range(4):
            if s in (0, 2) or (intensity >= 2 and s == 3 and b % 2):
                k = kick()
                add(groove, k, t0 + s * BEAT, 0.5)
                i0 = int((t0 + s * BEAT) * SR)
                dd = int(0.35 * SR)
                side[i0:i0 + dd] = np.minimum(side[i0:i0 + dd], 1 - 0.55 * np.exp(-np.arange(min(dd, N - i0)) / SR / 0.12))
    if intensity >= 2:
        for s in (1, 3):
            add(groove, snap(), t0 + s * BEAT, 0.22, pan=0.05)
        for s in range(8):
            sw = 0.03 * BEAT if s % 2 else 0
            add(groove, hat(open_=(s == 7 and b % 2 == 1)), t0 + s * BEAT / 2 + sw, 0.07 if s % 2 else 0.1, pan=0.25)
# Pequeño respiro antes de «Y además» y riser hacia el cierre
side_fade = np.ones(N)
pads *= side[:, None]
music += reverb(pads, 3.0, 4500, 0.35) * 0.55
music += reverb(groove, 1.8, 6000, 0.18)
add(sfx, riser(1.7), END_IN - 1.6, 0.45)

# 4) Cierre: golpe, acorde abierto y melodía corta
add(music, reverb(np.stack([boom()] * 2, 1), 2.5, 2000, 0.25), END_IN + 0.1, 0.55)
end_chord = pad([note(n) for n in ["D2", "A2", "E3", "F#3", "A3", "C#4", "E4"]], 8.3, 0.05, 3.5)
add(music, reverb(end_chord, 4, 5000, 0.45), END_IN + 0.1, 1.3)
for k, (n, beat) in enumerate([("F#5", 0), ("A5", 1), ("E5", 2), ("D5", 3), ("C#5", 4.5), ("D5", 6)]):
    add(music, reverb(delay(np.stack([pluck(note(n), 1.6, 0.6)] * 2, 1), BEAT * 0.75, 0.4, 0.3), 3, 7000, 0.45), END_IN + 2.0 + beat * BEAT, 0.28)
add(music, reverb(np.stack([bell(note("D6"), 2.5) * 0.35] * 2, 1), 3, 8000, 0.6), END_IN + 2.0, 0.5)

# Fundido final
fade_t = np.arange(N) / SR
music *= np.clip((DUR - fade_t) / 2.6, 0, 1)[:, None] ** 1.5

# ---------- Efectos sincronizados ----------
for k, at in enumerate([0.7, 0.98, 1.24, 1.48, 1.7, 1.9, 2.1, 2.28, 2.44]):
    add(sfx, pop(620 + 40 * (k % 5)), at + 0.02, 0.32, pan=[-0.5, 0.5, 0.6, -0.6, 0, 0.4, -0.3, 0.7, 0.1][k])
add(sfx, whoosh(1.0, 300, 4000, False), 2.75, 0.35)
add(sfx, riser(1.6), 3.7, 0.5)
add(sfx, whoosh(1.1, 200, 3000, False), 4.3, 0.45)
add(sfx, whoosh(1.0, 250, 3500, False), 8.5, 0.35, pan=0)

CLICKS = [1_100, 4_400, 5_100, 8_000, 24_700, 28_800, 30_000, 32_400, 35_800, 37_000]
for c in CLICKS:
    add(sfx, click(), film_at(c), 0.5, pan=-0.1)
for c in [10_000, 14_500, 20_700, 22_700]:
    add(sfx, tap(), film_at(c), 0.45, pan=0.35)
# Cuadrante rellenándose: cascada de notas
cells = 35
scale = ["D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6", "A6"]
for i in range(cells):
    add(sfx, pluck(note(scale[min(len(scale) - 1, i * len(scale) // cells)]) , 0.4, 0.4), film_at(1_300 + i * 30), 0.06, pan=-0.6 + 1.2 * (i % 7) / 6)
add(sfx, success(), film_at(1_300 + 35 * 30 + 80), 0.5)
add(sfx, ding(), film_at(8_800), 0.55, pan=0.4)  # horario en el móvil
add(sfx, success(), film_at(8_100), 0.4)
add(sfx, success(), film_at(15_700), 0.45, pan=0.3)  # fichaje
for k in range(12):
    add(sfx, key(), film_at(21_500) + k * 0.068 + 0.01 * (k % 3), 0.25, pan=0.35)
add(sfx, whoosh(0.5, 600, 5000, True), film_at(22_700), 0.2, pan=0.4)
add(sfx, ding(), film_at(23_450), 0.5, pan=-0.2)  # aviso al encargado
add(sfx, success(), film_at(24_800), 0.45)
add(sfx, ding(), film_at(25_900), 0.4, pan=0.4)
for k in range(5):
    add(sfx, key(), film_at(30_500) + k * 0.11, 0.3, pan=-0.1)
add(sfx, success(), film_at(32_500), 0.45)
add(sfx, whoosh(0.6, 500, 4000, True), film_at(37_000), 0.25)
add(sfx, success(), film_at(37_150), 0.5)
add(sfx, whoosh(0.9, 250, 3500, False), 43.95, 0.3)
for i in range(8):  # tarjetas de «Y además»
    add(sfx, pop(800 + 60 * i), FEAT_A + 0.7 + i * 0.14, 0.12, pan=-0.6 + 1.2 * (i % 4) / 3)
add(sfx, whoosh(0.9, 200, 3000, False), END_IN - 0.7, 0.4)
add(sfx, success(), END_IN + 0.1 + 1.9, 0.35)

sfx = reverb(sfx, 1.2, 7000, 0.12)

# ---------- Mezcla ----------
def norm_peak(x, peak=0.89):
    return x / max(1e-9, np.abs(x).max()) * peak


music_out = music * 0.55
sfx_out = sfx * 0.9
mix = music_out + sfx_out
mix = np.tanh(mix * 1.1) / np.tanh(1.1)  # limitador suave
g = 0.89 / np.abs(mix).max()
for name, x in [("music.wav", music_out * g), ("sfx.wav", sfx_out * g), ("mix.wav", mix * g)]:
    wavfile.write(name, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
print("ok", round(float(np.abs(mix).max()), 3))
