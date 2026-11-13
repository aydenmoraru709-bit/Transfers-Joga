"""Genera las cartas de jugador (PNG) con Pillow."""

from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
BOLD = FONT_DIR / "DejaVuSans-Bold.ttf"
REGULAR = FONT_DIR / "DejaVuSans.ttf"

W, H = 600, 860
RADIUS = 42

# Rareza según valoración: (color arriba, color abajo, color texto, color borde, nombre)
TIERS = [
    (85, ((40, 18, 70), (120, 40, 160), (255, 230, 140), (255, 215, 90), "ÉLITE")),
    (75, ((150, 110, 20), (245, 205, 90), (45, 30, 5), (255, 240, 180), "ORO")),
    (65, ((95, 100, 110), (205, 210, 215), (30, 32, 36), (240, 240, 245), "PLATA")),
    (0, ((90, 50, 25), (190, 120, 70), (40, 20, 5), (225, 170, 120), "BRONCE")),
]


def _font(size, bold=True):
    try:
        return ImageFont.truetype(str(BOLD if bold else REGULAR), size)
    except OSError:
        return ImageFont.load_default(size)


def _tier(rating):
    for minimum, t in TIERS:
        if rating >= minimum:
            return t
    return TIERS[-1][1]


def _gradient(size, top, bottom):
    w, h = size
    base = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        base.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return base.resize((w, h))


def _fit_text(draw, text, max_width, start, minimum=18):
    size = start
    while size > minimum:
        f = _font(size)
        if draw.textlength(text, font=f) <= max_width:
            return f
        size -= 2
    return _font(minimum)


def _center(draw, y, text, font, fill, width=W, x0=0, **kw):
    tw = draw.textlength(text, font=font)
    draw.text((x0 + (width - tw) / 2, y), text, font=font, fill=fill, **kw)


def _silhouette(size, color):
    """Silueta genérica cuando el jugador no tiene foto."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = color + (170,)
    d.ellipse((size * 0.32, size * 0.10, size * 0.68, size * 0.48), fill=c)
    d.rounded_rectangle((size * 0.16, size * 0.52, size * 0.84, size * 1.1), radius=int(size * 0.2), fill=c)
    return img


def _photo(path, size, color):
    if path and Path(path).exists():
        try:
            src = Image.open(path).convert("RGBA")
            # recorte cuadrado centrado arriba (caras suelen estar arriba)
            s = min(src.size)
            left = (src.width - s) // 2
            src = src.crop((left, 0, left + s, s)).resize((size, size), Image.LANCZOS)
            mask = Image.new("L", (size, size), 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=size // 6, fill=255)
            out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            out.paste(src, (0, 0), mask)
            return out
        except Exception:
            pass
    return _silhouette(size, color)


def make_card(
    player,
    event_label: str | None = None,
    event_points: int | None = None,
    event_color=(46, 204, 113),
    count: int = 1,
    match: str = "",
) -> BytesIO:
    """Devuelve un PNG en memoria con la carta del jugador.

    Si se pasa `event_label` se dibuja el banner del evento (GOL, ASISTENCIA...)
    con los puntos ganados; si no, es la carta normal con sus estadísticas.
    """
    top, bottom, ink, edge, tier_name = _tier(player["rating"])

    # --- fondo con forma de carta ---
    card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bg = _gradient((W, H), top, bottom).convert("RGBA")

    # brillo diagonal
    shine = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(shine)
    for i in range(-H, W, 46):
        sd.line([(i, 0), (i + H, H)], fill=22, width=14)
    bg = Image.composite(Image.new("RGBA", (W, H), (255, 255, 255, 255)), bg, shine)

    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, W - 1, H - 1), radius=RADIUS, fill=255)
    card.paste(bg, (0, 0), mask)

    d = ImageDraw.Draw(card)
    d.rounded_rectangle((14, 14, W - 15, H - 15), radius=RADIUS - 10, outline=edge, width=4)

    # --- valoración y posición ---
    d.text((48, 40), str(player["rating"]), font=_font(96), fill=ink)
    d.text((54, 146), player["position"], font=_font(40), fill=ink)
    d.line((52, 200, 132, 200), fill=ink, width=3)
    d.text((52, 210), tier_name, font=_font(20), fill=ink)

    # --- foto ---
    psize = 330
    ph = _photo(player["photo_path"], psize, ink)
    shadow = Image.new("RGBA", (psize + 40, psize + 40), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((20, 26, psize + 20, psize + 26), radius=psize // 6, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    px, py = W - psize - 50, 50
    if player["photo_path"] and Path(player["photo_path"]).exists():
        card.alpha_composite(shadow, (px - 20, py - 20))
    card.alpha_composite(ph, (px, py))

    # --- nombre y club ---
    name = player["name"].upper()
    nf = _fit_text(d, name, W - 80, 54)
    _center(d, 410, name, nf, ink)
    club = (player["club"] or "").upper()
    if club:
        _center(d, 474, club, _fit_text(d, club, W - 120, 26), ink)
    d.line((70, 516, W - 70, 516), fill=ink, width=2)

    if event_label is not None:
        # --- banner del evento ---
        by = 540
        banner = Image.new("RGBA", (W - 60, 150), (0, 0, 0, 0))
        bd = ImageDraw.Draw(banner)
        bd.rounded_rectangle((0, 0, W - 61, 149), radius=26, fill=event_color + (255,))
        bd.rounded_rectangle((0, 0, W - 61, 70), radius=26, fill=tuple(min(255, c + 30) for c in event_color) + (255,))
        bd.rectangle((0, 44, W - 61, 72), fill=event_color + (255,))
        card.alpha_composite(banner, (30, by))
        label = event_label + (f"  x{count}" if count > 1 else "")
        _center(d, by + 14, label, _fit_text(d, label, W - 100, 48), (255, 255, 255))
        total = (event_points or 0) * count
        pts = f"{total:+d} PTS"
        _center(d, by + 74, pts, _font(56), (255, 255, 255))
        stats_y = 712
    else:
        stats_y = 560

    # --- estadísticas ---
    stats = [("GOLES", player["goals"]), ("ASIST.", player["assists"]), ("PUNTOS", player["points"])]
    if event_label is None:
        stats.append(("PRECIO", f"{player['price']:g}M"))
    col_w = (W - 80) / len(stats)
    for i, (lab, val) in enumerate(stats):
        x0 = 40 + i * col_w
        _center(d, stats_y, str(val), _font(44), ink, width=col_w, x0=x0)
        _center(d, stats_y + 54, lab, _font(20), ink, width=col_w, x0=x0)

    if match:
        m = match.upper()
        _center(d, H - 52, m, _fit_text(d, m, W - 120, 22, 14), ink)
    elif event_label is None:
        _center(d, H - 140, "FANTASY", _font(28), ink)

    out = BytesIO()
    card.save(out, "PNG")
    out.seek(0)
    return out
