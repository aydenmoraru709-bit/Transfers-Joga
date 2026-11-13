"""Bot de Discord de Fantasy Fútbol.

Cada gol, asistencia u otro evento publica una carta del jugador con los puntos.
Ejecuta:  python bot.py   (necesita DISCORD_TOKEN en el entorno o en .env)
"""

import logging
import os
from pathlib import Path

import discord
from discord import app_commands

from fantasy.cards import make_card
from fantasy.db import DB
from fantasy.scoring import (
    EVENTOS,
    MAX_JUGADORES,
    MULTIPLICADOR_CAPITAN,
    POSICIONES,
    puntos_evento,
    tabla_puntos_texto,
)

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
PHOTOS = DATA / "photos"


def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("fantasy")

db = DB(os.environ.get("FANTASY_DB", DATA / "fantasy.db"))
GUILD_ID = os.environ.get("GUILD_ID")  # opcional: sincroniza comandos al instante en ese servidor


class FantasyBot(discord.Client):
    def __init__(self):
        super().__init__(intents=discord.Intents.default())
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        if GUILD_ID:
            guild = discord.Object(id=int(GUILD_ID))
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
        else:
            await self.tree.sync()

    async def on_ready(self):
        log.info("Conectado como %s", self.user)


bot = FantasyBot()
tree = bot.tree

POS_CHOICES = [app_commands.Choice(name=f"{k} - {v}", value=k) for k, v in POSICIONES.items()]
EVENT_CHOICES = [app_commands.Choice(name=v[0].title(), value=k) for k, v in EVENTOS.items()]
admin_only = app_commands.default_permissions(manage_guild=True)


# ---------------- utilidades ----------------
async def player_autocomplete(inter: discord.Interaction, current: str):
    return [
        app_commands.Choice(name=f"{p['name']} ({p['position']}, {p['club'] or 'sin club'}) · {p['price']:g}M", value=p["id"])
        for p in db.search_players(inter.guild_id, current)
    ]


async def my_player_autocomplete(inter: discord.Interaction, current: str):
    cur = current.lower()
    return [
        app_commands.Choice(name=f"{p['name']} ({p['position']})", value=p["id"])
        for p in db.roster(inter.guild_id, inter.user.id)
        if cur in p["name"].lower()
    ][:25]


def card_file(player, **kw):
    return discord.File(make_card(player, **kw), filename=f"carta_{player['id']}.png")


async def get_player_or_fail(inter, player_id):
    p = db.get_player(inter.guild_id, player_id)
    if not p:
        await inter.response.send_message("❌ Jugador no encontrado. Elige uno de la lista.", ephemeral=True)
    return p


async def get_team_or_fail(inter):
    t = db.get_team(inter.guild_id, inter.user.id)
    if not t:
        await inter.response.send_message("❌ Aún no tienes equipo. Usa `/crear_equipo`.", ephemeral=True)
    return t


# ---------------- jugadores (admin) ----------------
@tree.command(name="jugador_crear", description="[Admin] Añade un jugador real al mercado")
@admin_only
@app_commands.guild_only()
@app_commands.describe(
    nombre="Nombre del jugador",
    posicion="Posición",
    club="Club del jugador",
    valoracion="Media de la carta (40-99). 85+ Élite, 75+ Oro, 65+ Plata",
    precio="Precio en millones",
    foto="Foto del jugador (opcional)",
)
@app_commands.choices(posicion=POS_CHOICES)
async def jugador_crear(
    inter: discord.Interaction,
    nombre: str,
    posicion: app_commands.Choice[str],
    club: str = "",
    valoracion: app_commands.Range[int, 40, 99] = 70,
    precio: app_commands.Range[float, 0.5, 200.0] = 5.0,
    foto: discord.Attachment | None = None,
):
    try:
        pid = db.add_player(inter.guild_id, nombre.strip(), posicion.value, club.strip(), valoracion, precio)
    except Exception:
        return await inter.response.send_message(f"❌ Ya existe un jugador llamado **{nombre}**.", ephemeral=True)

    await inter.response.defer()
    if foto:
        await save_photo(pid, foto)
    p = db.get_player(inter.guild_id, pid)
    await inter.followup.send(f"✅ **{p['name']}** añadido al mercado por **{p['price']:g}M**.", file=card_file(p))


async def save_photo(player_id, attachment: discord.Attachment):
    if not (attachment.content_type or "").startswith("image/"):
        return
    PHOTOS.mkdir(parents=True, exist_ok=True)
    path = PHOTOS / f"{player_id}.img"
    await attachment.save(path)
    db.set_player_photo(player_id, path)


@tree.command(name="jugador_foto", description="[Admin] Cambia la foto de un jugador")
@admin_only
@app_commands.guild_only()
@app_commands.autocomplete(jugador=player_autocomplete)
async def jugador_foto(inter: discord.Interaction, jugador: int, foto: discord.Attachment):
    p = await get_player_or_fail(inter, jugador)
    if not p:
        return
    await inter.response.defer()
    await save_photo(p["id"], foto)
    await inter.followup.send("🖼️ Foto actualizada.", file=card_file(db.get_player(inter.guild_id, p["id"])))


@tree.command(name="jugador_borrar", description="[Admin] Elimina un jugador del mercado")
@admin_only
@app_commands.guild_only()
@app_commands.autocomplete(jugador=player_autocomplete)
async def jugador_borrar(inter: discord.Interaction, jugador: int):
    p = await get_player_or_fail(inter, jugador)
    if not p:
        return
    db.delete_player(inter.guild_id, p["id"])
    await inter.response.send_message(f"🗑️ **{p['name']}** eliminado.", ephemeral=True)


@tree.command(name="mercado", description="Lista de jugadores disponibles")
@app_commands.guild_only()
@app_commands.choices(posicion=POS_CHOICES)
async def mercado(inter: discord.Interaction, posicion: app_commands.Choice[str] | None = None):
    players = db.list_players(inter.guild_id, posicion.value if posicion else None)
    if not players:
        return await inter.response.send_message("El mercado está vacío. Un admin puede usar `/jugador_crear`.", ephemeral=True)
    lines = [
        f"`{p['position']}` **{p['name']}** · {p['club'] or '—'} · {p['price']:g}M · {p['points']} pts"
        for p in players[:40]
    ]
    embed = discord.Embed(title="🛒 Mercado", description="\n".join(lines), color=0x2ECC71)
    if len(players) > 40:
        embed.set_footer(text=f"Mostrando 40 de {len(players)}")
    await inter.response.send_message(embed=embed)


@tree.command(name="carta", description="Muestra la carta de un jugador")
@app_commands.guild_only()
@app_commands.autocomplete(jugador=player_autocomplete)
async def carta(inter: discord.Interaction, jugador: int):
    p = await get_player_or_fail(inter, jugador)
    if p:
        await inter.response.send_message(file=card_file(p))


# ---------------- equipos fantasy ----------------
@tree.command(name="crear_equipo", description="Crea tu equipo fantasy")
@app_commands.guild_only()
async def crear_equipo(inter: discord.Interaction, nombre: str):
    if db.get_team(inter.guild_id, inter.user.id):
        return await inter.response.send_message("Ya tienes un equipo.", ephemeral=True)
    db.create_team(inter.guild_id, inter.user.id, nombre.strip()[:40])
    t = db.get_team(inter.guild_id, inter.user.id)
    await inter.response.send_message(
        f"🏟️ **{t['name']}** creado. Presupuesto: **{t['budget']:g}M**. Ficha con `/fichar` (máx. {MAX_JUGADORES})."
    )


@tree.command(name="fichar", description="Ficha un jugador para tu equipo")
@app_commands.guild_only()
@app_commands.autocomplete(jugador=player_autocomplete)
async def fichar(inter: discord.Interaction, jugador: int):
    t = await get_team_or_fail(inter)
    if not t:
        return
    p = await get_player_or_fail(inter, jugador)
    if not p:
        return
    if db.owns(inter.guild_id, inter.user.id, p["id"]):
        return await inter.response.send_message("Ya tienes a ese jugador.", ephemeral=True)
    if len(db.roster(inter.guild_id, inter.user.id)) >= MAX_JUGADORES:
        return await inter.response.send_message(f"Plantilla llena ({MAX_JUGADORES}). Vende a alguien con `/vender`.", ephemeral=True)
    if p["price"] > t["budget"] + 1e-9:
        return await inter.response.send_message(
            f"💸 No te llega: cuesta {p['price']:g}M y tienes {t['budget']:g}M.", ephemeral=True
        )
    db.sign(inter.guild_id, inter.user.id, p)
    t = db.get_team(inter.guild_id, inter.user.id)
    await inter.response.send_message(
        f"✍️ **{t['name']}** ficha a **{p['name']}** por {p['price']:g}M. Te quedan {t['budget']:g}M.",
        file=card_file(p),
    )


@tree.command(name="vender", description="Vende un jugador de tu equipo (recuperas su precio)")
@app_commands.guild_only()
@app_commands.autocomplete(jugador=my_player_autocomplete)
async def vender(inter: discord.Interaction, jugador: int):
    t = await get_team_or_fail(inter)
    if not t:
        return
    p = db.get_player(inter.guild_id, jugador)
    if not p or not db.owns(inter.guild_id, inter.user.id, jugador):
        return await inter.response.send_message("Ese jugador no está en tu equipo.", ephemeral=True)
    db.sell(inter.guild_id, inter.user.id, p)
    t = db.get_team(inter.guild_id, inter.user.id)
    await inter.response.send_message(f"👋 Vendes a **{p['name']}**. Presupuesto: {t['budget']:g}M.")


@tree.command(name="capitan", description=f"Elige capitán (puntúa x{MULTIPLICADOR_CAPITAN})")
@app_commands.guild_only()
@app_commands.autocomplete(jugador=my_player_autocomplete)
async def capitan(inter: discord.Interaction, jugador: int):
    t = await get_team_or_fail(inter)
    if not t:
        return
    p = db.get_player(inter.guild_id, jugador)
    if not p or not db.owns(inter.guild_id, inter.user.id, jugador):
        return await inter.response.send_message("Ese jugador no está en tu equipo.", ephemeral=True)
    db.set_captain(inter.guild_id, inter.user.id, jugador)
    await inter.response.send_message(f"👑 **{p['name']}** es el capitán de **{t['name']}**.")


@tree.command(name="equipo", description="Muestra un equipo fantasy")
@app_commands.guild_only()
async def equipo(inter: discord.Interaction, usuario: discord.Member | None = None):
    user = usuario or inter.user
    t = db.get_team(inter.guild_id, user.id)
    if not t:
        return await inter.response.send_message(f"{user.display_name} no tiene equipo.", ephemeral=True)
    players = db.roster(inter.guild_id, user.id)
    lines = [
        f"{'👑 ' if p['id'] == t['captain_id'] else ''}`{p['position']}` **{p['name']}** · "
        f"{p['goals']}G {p['assists']}A · {p['points']} pts"
        for p in players
    ] or ["*Sin jugadores todavía*"]
    embed = discord.Embed(title=f"🏟️ {t['name']}", description="\n".join(lines), color=0x3498DB)
    embed.set_author(name=user.display_name, icon_url=user.display_avatar.url)
    embed.add_field(name="Puntos", value=str(t["points"]))
    embed.add_field(name="Presupuesto", value=f"{t['budget']:g}M")
    embed.add_field(name="Plantilla", value=f"{len(players)}/{MAX_JUGADORES}")
    await inter.response.send_message(embed=embed)


@tree.command(name="clasificacion", description="Clasificación de la liga fantasy")
@app_commands.guild_only()
async def clasificacion(inter: discord.Interaction):
    teams = db.standings(inter.guild_id)
    if not teams:
        return await inter.response.send_message("Nadie ha creado equipo todavía.", ephemeral=True)
    medals = ["🥇", "🥈", "🥉"]
    lines = [
        f"{medals[i] if i < 3 else f'`{i + 1}.`'} **{t['name']}** (<@{t['user_id']}>) — **{t['points']}** pts"
        for i, t in enumerate(teams[:25])
    ]
    await inter.response.send_message(
        embed=discord.Embed(title="🏆 Clasificación", description="\n".join(lines), color=0xF1C40F),
        allowed_mentions=discord.AllowedMentions.none(),
    )


@tree.command(name="puntos", description="Cómo se puntúa en el fantasy")
async def puntos(inter: discord.Interaction):
    await inter.response.send_message(
        embed=discord.Embed(title="📋 Sistema de puntos", description=tabla_puntos_texto(), color=0x9B59B6)
    )


# ---------------- eventos (admin) ----------------
async def publish_event(inter: discord.Interaction, jugador: int, tipo: str, cantidad: int, partido: str):
    p = await get_player_or_fail(inter, jugador)
    if not p:
        return
    await inter.response.defer()
    pts = puntos_evento(tipo, p["position"])
    ids, awards = db.record_event(inter.guild_id, p, tipo, pts, cantidad, partido.strip())
    p = db.get_player(inter.guild_id, p["id"])  # stats actualizadas
    label, _, color = EVENTOS[tipo]

    embed = discord.Embed(
        title=f"{label}{f' x{cantidad}' if cantidad > 1 else ''} · {p['name']}",
        color=discord.Color.from_rgb(*color),
    )
    if partido:
        embed.description = f"🏟️ {partido}"
    if awards:
        embed.add_field(
            name="Equipos fantasy que puntúan",
            value="\n".join(f"<@{uid}> **{g:+d}**" for uid, g in awards[:20]),
            inline=False,
        )
    else:
        embed.add_field(name="Equipos fantasy", value="Nadie tiene a este jugador 😬", inline=False)
    embed.set_footer(text=f"ID evento: {', '.join(map(str, ids))} · /anular_evento para deshacer")
    embed.set_image(url=f"attachment://carta_{p['id']}.png")

    await inter.followup.send(
        embed=embed,
        file=card_file(p, event_label=label, event_points=pts, event_color=color, count=cantidad, match=partido),
        allowed_mentions=discord.AllowedMentions.none(),
    )


@tree.command(name="evento", description="[Admin] Registra un evento (gol, asistencia, tarjeta...) y publica la carta")
@admin_only
@app_commands.guild_only()
@app_commands.autocomplete(jugador=player_autocomplete)
@app_commands.choices(tipo=EVENT_CHOICES)
@app_commands.describe(cantidad="Cuántas veces (p.ej. 3 para un hat-trick)", partido="Ej: Real Madrid 3-1 Betis")
async def evento(
    inter: discord.Interaction,
    jugador: int,
    tipo: app_commands.Choice[str],
    cantidad: app_commands.Range[int, 1, 10] = 1,
    partido: str = "",
):
    await publish_event(inter, jugador, tipo.value, cantidad, partido)


@tree.command(name="gol", description="[Admin] Registra un gol y publica la carta")
@admin_only
@app_commands.guild_only()
@app_commands.autocomplete(jugador=player_autocomplete)
async def gol(inter: discord.Interaction, jugador: int, cantidad: app_commands.Range[int, 1, 10] = 1, partido: str = ""):
    await publish_event(inter, jugador, "gol", cantidad, partido)


@tree.command(name="asistencia", description="[Admin] Registra una asistencia y publica la carta")
@admin_only
@app_commands.guild_only()
@app_commands.autocomplete(jugador=player_autocomplete)
async def asistencia(inter: discord.Interaction, jugador: int, cantidad: app_commands.Range[int, 1, 10] = 1, partido: str = ""):
    await publish_event(inter, jugador, "asistencia", cantidad, partido)


@tree.command(name="anular_evento", description="[Admin] Deshace un evento y resta sus puntos")
@admin_only
@app_commands.guild_only()
async def anular_evento(inter: discord.Interaction, id_evento: int):
    ev = db.undo_event(inter.guild_id, id_evento)
    if not ev:
        return await inter.response.send_message("No existe ese evento.", ephemeral=True)
    await inter.response.send_message(f"↩️ Evento #{id_evento} ({EVENTOS[ev['type']][0]}) anulado.")


@tree.command(name="ultimos_eventos", description="Últimos eventos registrados")
@app_commands.guild_only()
async def ultimos_eventos(inter: discord.Interaction):
    evs = db.recent_events(inter.guild_id, 15)
    if not evs:
        return await inter.response.send_message("Sin eventos todavía.", ephemeral=True)
    lines = [f"`#{e['id']}` {EVENTOS[e['type']][0]} — **{e['player_name']}** ({e['points']:+d}) {e['match']}" for e in evs]
    await inter.response.send_message(embed=discord.Embed(title="📰 Últimos eventos", description="\n".join(lines)))


@tree.error
async def on_app_command_error(inter: discord.Interaction, error: app_commands.AppCommandError):
    msg = "⛔ Necesitas permiso de *Gestionar servidor*." if isinstance(error, app_commands.MissingPermissions) else "⚠️ Algo salió mal."
    log.exception("Error en comando", exc_info=error)
    if inter.response.is_done():
        await inter.followup.send(msg, ephemeral=True)
    else:
        await inter.response.send_message(msg, ephemeral=True)


if __name__ == "__main__":
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        raise SystemExit("Falta DISCORD_TOKEN. Copia .env.example a .env y pon el token de tu bot.")
    bot.run(token, log_handler=None)
