"""Sistema de puntuación del fantasy.

Edita este archivo para cambiar cuántos puntos da cada acción.
Los valores pueden ser un número fijo o un dict por posición (POR, DEF, MED, DEL).
"""

POSICIONES = {
    "POR": "Portero",
    "DEF": "Defensa",
    "MED": "Centrocampista",
    "DEL": "Delantero",
}

# clave -> (nombre visible, puntos, color del banner en la carta)
EVENTOS = {
    "gol": ("GOL", {"POR": 10, "DEF": 6, "MED": 5, "DEL": 4}, (46, 204, 113)),
    "asistencia": ("ASISTENCIA", 3, (52, 152, 219)),
    "porteria_cero": ("PORTERÍA A CERO", {"POR": 4, "DEF": 4, "MED": 1, "DEL": 0}, (26, 188, 156)),
    "penalti_parado": ("PENALTI PARADO", 5, (155, 89, 182)),
    "mvp": ("MVP DEL PARTIDO", 3, (241, 196, 15)),
    "partido": ("PARTIDO JUGADO", 2, (149, 165, 166)),
    "amarilla": ("TARJETA AMARILLA", -1, (243, 156, 18)),
    "roja": ("TARJETA ROJA", -3, (231, 76, 60)),
    "autogol": ("AUTOGOL", -2, (192, 57, 43)),
    "penalti_fallado": ("PENALTI FALLADO", -2, (127, 140, 141)),
}

# Multiplicador de puntos para el capitán de cada equipo fantasy
MULTIPLICADOR_CAPITAN = 2

# Reglas de equipo
PRESUPUESTO_INICIAL = 100.0  # millones
MAX_JUGADORES = 11


def puntos_evento(tipo: str, posicion: str) -> int:
    _, valor, _ = EVENTOS[tipo]
    if isinstance(valor, dict):
        return valor.get(posicion, 0)
    return valor


def tabla_puntos_texto() -> str:
    lineas = []
    for _, (nombre, valor, _) in EVENTOS.items():
        if isinstance(valor, dict):
            detalle = " · ".join(f"{p} {v:+d}" for p, v in valor.items())
        else:
            detalle = f"{valor:+d}"
        lineas.append(f"**{nombre}**: {detalle}")
    lineas.append(f"\n👑 El capitán puntúa x{MULTIPLICADOR_CAPITAN}")
    return "\n".join(lineas)
