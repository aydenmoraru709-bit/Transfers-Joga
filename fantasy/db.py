"""Base de datos SQLite del fantasy (un archivo, sin servidor)."""

import sqlite3
from pathlib import Path

from .scoring import MULTIPLICADOR_CAPITAN, PRESUPUESTO_INICIAL

SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    position   TEXT    NOT NULL,
    club       TEXT    NOT NULL DEFAULT '',
    rating     INTEGER NOT NULL DEFAULT 70,
    price      REAL    NOT NULL DEFAULT 5.0,
    photo_path TEXT,
    goals      INTEGER NOT NULL DEFAULT 0,
    assists    INTEGER NOT NULL DEFAULT 0,
    points     INTEGER NOT NULL DEFAULT 0,
    UNIQUE (guild_id, name)
);

CREATE TABLE IF NOT EXISTS teams (
    guild_id   INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    budget     REAL    NOT NULL,
    points     INTEGER NOT NULL DEFAULT 0,
    captain_id INTEGER,
    PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS roster (
    guild_id  INTEGER NOT NULL,
    user_id   INTEGER NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    PRIMARY KEY (guild_id, user_id, player_id)
);

CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   INTEGER NOT NULL,
    player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    type       TEXT    NOT NULL,
    points     INTEGER NOT NULL,
    match      TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Puntos que cada evento dio a cada equipo fantasy (para poder anularlo)
CREATE TABLE IF NOT EXISTS event_awards (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guild_id INTEGER NOT NULL,
    user_id  INTEGER NOT NULL,
    points   INTEGER NOT NULL
);
"""


class DB:
    def __init__(self, path: str | Path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    # ---------- jugadores ----------
    def add_player(self, guild_id, name, position, club, rating, price) -> int:
        cur = self.conn.execute(
            "INSERT INTO players (guild_id, name, position, club, rating, price) VALUES (?,?,?,?,?,?)",
            (guild_id, name, position, club, rating, price),
        )
        self.conn.commit()
        return cur.lastrowid

    def set_player_photo(self, player_id, path):
        self.conn.execute("UPDATE players SET photo_path=? WHERE id=?", (str(path), player_id))
        self.conn.commit()

    def delete_player(self, guild_id, player_id):
        self.conn.execute("DELETE FROM players WHERE guild_id=? AND id=?", (guild_id, player_id))
        self.conn.execute(
            "UPDATE teams SET captain_id=NULL WHERE guild_id=? AND captain_id=?", (guild_id, player_id)
        )
        self.conn.commit()

    def get_player(self, guild_id, player_id):
        return self.conn.execute(
            "SELECT * FROM players WHERE guild_id=? AND id=?", (guild_id, player_id)
        ).fetchone()

    def list_players(self, guild_id, position=None):
        if position:
            return self.conn.execute(
                "SELECT * FROM players WHERE guild_id=? AND position=? ORDER BY points DESC, name",
                (guild_id, position),
            ).fetchall()
        return self.conn.execute(
            "SELECT * FROM players WHERE guild_id=? ORDER BY points DESC, name", (guild_id,)
        ).fetchall()

    def search_players(self, guild_id, text, limit=25):
        return self.conn.execute(
            "SELECT * FROM players WHERE guild_id=? AND name LIKE ? ORDER BY name LIMIT ?",
            (guild_id, f"%{text}%", limit),
        ).fetchall()

    # ---------- equipos fantasy ----------
    def create_team(self, guild_id, user_id, name):
        self.conn.execute(
            "INSERT INTO teams (guild_id, user_id, name, budget) VALUES (?,?,?,?)",
            (guild_id, user_id, name, PRESUPUESTO_INICIAL),
        )
        self.conn.commit()

    def get_team(self, guild_id, user_id):
        return self.conn.execute(
            "SELECT * FROM teams WHERE guild_id=? AND user_id=?", (guild_id, user_id)
        ).fetchone()

    def roster(self, guild_id, user_id):
        return self.conn.execute(
            """SELECT p.* FROM roster r JOIN players p ON p.id = r.player_id
               WHERE r.guild_id=? AND r.user_id=?
               ORDER BY CASE p.position WHEN 'POR' THEN 0 WHEN 'DEF' THEN 1 WHEN 'MED' THEN 2 ELSE 3 END, p.name""",
            (guild_id, user_id),
        ).fetchall()

    def owns(self, guild_id, user_id, player_id) -> bool:
        return (
            self.conn.execute(
                "SELECT 1 FROM roster WHERE guild_id=? AND user_id=? AND player_id=?",
                (guild_id, user_id, player_id),
            ).fetchone()
            is not None
        )

    def sign(self, guild_id, user_id, player):
        self.conn.execute(
            "INSERT INTO roster (guild_id, user_id, player_id) VALUES (?,?,?)",
            (guild_id, user_id, player["id"]),
        )
        self.conn.execute(
            "UPDATE teams SET budget = budget - ? WHERE guild_id=? AND user_id=?",
            (player["price"], guild_id, user_id),
        )
        self.conn.commit()

    def sell(self, guild_id, user_id, player):
        self.conn.execute(
            "DELETE FROM roster WHERE guild_id=? AND user_id=? AND player_id=?",
            (guild_id, user_id, player["id"]),
        )
        self.conn.execute(
            """UPDATE teams SET budget = budget + ?,
                   captain_id = CASE WHEN captain_id=? THEN NULL ELSE captain_id END
               WHERE guild_id=? AND user_id=?""",
            (player["price"], player["id"], guild_id, user_id),
        )
        self.conn.commit()

    def set_captain(self, guild_id, user_id, player_id):
        self.conn.execute(
            "UPDATE teams SET captain_id=? WHERE guild_id=? AND user_id=?", (player_id, guild_id, user_id)
        )
        self.conn.commit()

    def standings(self, guild_id):
        return self.conn.execute(
            "SELECT * FROM teams WHERE guild_id=? ORDER BY points DESC, name", (guild_id,)
        ).fetchall()

    # ---------- eventos ----------
    def record_event(self, guild_id, player, tipo, pts, count, match):
        """Registra `count` eventos iguales. Suma puntos al jugador y a cada
        equipo fantasy que lo tenga (x2 si es su capitán).
        Devuelve (ids_eventos, lista de (user_id, puntos_ganados))."""
        pid = player["id"]
        goals = count if tipo == "gol" else 0
        assists = count if tipo == "asistencia" else 0
        owners = self.conn.execute(
            """SELECT t.user_id, t.captain_id FROM roster r
               JOIN teams t ON t.guild_id=r.guild_id AND t.user_id=r.user_id
               WHERE r.guild_id=? AND r.player_id=?""",
            (guild_id, pid),
        ).fetchall()

        ids = []
        totals: dict[int, int] = {}
        for _ in range(count):
            cur = self.conn.execute(
                "INSERT INTO events (guild_id, player_id, type, points, match) VALUES (?,?,?,?,?)",
                (guild_id, pid, tipo, pts, match),
            )
            eid = cur.lastrowid
            ids.append(eid)
            for o in owners:
                gained = pts * (MULTIPLICADOR_CAPITAN if o["captain_id"] == pid else 1)
                self.conn.execute(
                    "INSERT INTO event_awards (event_id, guild_id, user_id, points) VALUES (?,?,?,?)",
                    (eid, guild_id, o["user_id"], gained),
                )
                totals[o["user_id"]] = totals.get(o["user_id"], 0) + gained

        self.conn.execute(
            "UPDATE players SET points=points+?, goals=goals+?, assists=assists+? WHERE id=?",
            (pts * count, goals, assists, pid),
        )
        for uid, gained in totals.items():
            self.conn.execute(
                "UPDATE teams SET points=points+? WHERE guild_id=? AND user_id=?", (gained, guild_id, uid)
            )
        self.conn.commit()
        return ids, sorted(totals.items(), key=lambda x: -x[1])

    def undo_event(self, guild_id, event_id):
        ev = self.conn.execute(
            "SELECT * FROM events WHERE guild_id=? AND id=?", (guild_id, event_id)
        ).fetchone()
        if not ev:
            return None
        self.conn.execute(
            """UPDATE players SET points=points-?,
                   goals=goals-?, assists=assists-? WHERE id=?""",
            (ev["points"], int(ev["type"] == "gol"), int(ev["type"] == "asistencia"), ev["player_id"]),
        )
        for a in self.conn.execute(
            "SELECT * FROM event_awards WHERE event_id=?", (event_id,)
        ).fetchall():
            self.conn.execute(
                "UPDATE teams SET points=points-? WHERE guild_id=? AND user_id=?",
                (a["points"], a["guild_id"], a["user_id"]),
            )
        self.conn.execute("DELETE FROM events WHERE id=?", (event_id,))
        self.conn.commit()
        return ev

    def recent_events(self, guild_id, limit=10):
        return self.conn.execute(
            """SELECT e.*, p.name AS player_name FROM events e JOIN players p ON p.id=e.player_id
               WHERE e.guild_id=? ORDER BY e.id DESC LIMIT ?""",
            (guild_id, limit),
        ).fetchall()
