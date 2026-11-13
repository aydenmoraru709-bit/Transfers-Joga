import * as THREE from 'three';

// ---------- helpers ----------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(11);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, u) => a + (b - a) * u;
const easeOutBack = (p) => { const c = 1.70158; const q = p - 1; return 1 + (c + 1) * q * q * q + c * q * q; };
const smooth = (u) => u * u * (3 - 2 * u);

export const DURATION = 24.8;
const W = 1080, H = 1920;
const END_CITY = 1e9;

// ---------- world layout ----------
const P = 11, N = 7, SIZE = N * P + 2;
const lotO = (a) => a * P + 2;
const HALL = [3, 3], HERO = [2, 3], GIFT = [2, 4], PLAZA = [4, 4], HOSP = [4, 3], MALL = [4, 2];
const special = [HALL, HERO, GIFT, PLAZA, HOSP, MALL];
const isSpecial = (a, b) => special.some((s) => s[0] === a && s[1] === b);
const center = (lot) => new THREE.Vector3(lotO(lot[0]) + 4.5, 0, lotO(lot[1]) + 4.5);
const C = center(HALL), HC = center(HERO), GC = center(GIFT);

const blocks = [];
function B(x, y, z, color, a = -1, d = 1e9, opt = {}) {
  const c = new THREE.Color(color);
  const j = opt.jit ?? 0.06;
  c.multiplyScalar(1 - j + rnd() * 2 * j);
  blocks.push({ x, y, z, c, a, d, glass: !!opt.glass, drop: opt.drop ?? 4 });
}

// ground
for (let i = 0; i < SIZE; i++) for (let k = 0; k < SIZE; k++) {
  const li = (i % P) - 2, lk = (k % P) - 2;
  const a = Math.floor(i / P), b = Math.floor(k / P);
  let col;
  if (li < 0 || lk < 0) col = '#3a3c44';
  else if (li === 0 || li === 8 || lk === 0 || lk === 8) col = '#cfd8a8';
  else if (isSpecial(a, b) && !(a === 3 && b === 3)) col = '#9a6b3f';
  else col = '#5cbf3c';
  B(i, -1, k, col, -1, 1e9, { jit: li < 0 || lk < 0 ? 0.05 : 0.09 });
}

function tree(x, z) {
  for (let y = 0; y < 4; y++) B(x, y, z, '#6b4a2b');
  for (let y = 4; y <= 5; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (y === 5 && dx && dz) continue;
    if (dx || dz) B(x + dx, y, z + dz, '#2f8f3a', -1, 1e9, { jit: 0.12 });
    else B(x, y, z, '#2f8f3a');
  }
  B(x, 6, z, '#2f8f3a');
}

const WALLS = ['#f3e6c4', '#f6b8c8', '#c9b6f2', '#a9d8f5', '#b6ecc4', '#f7e08a', '#f2f2f2'];
const ROOFS = ['#c62828', '#2f5fb8', '#1f8f86', '#6a3fb5', '#7a4a2a', '#2e7d32', '#e0762a'];
function smallHouse(x0, z0, a, wall0, roof0) {
  const h = rnd() < 0.3 ? 3 : 2, wall = wall0 ?? pick(WALLS), roof = roof0 ?? pick(ROOFS);
  for (let y = 0; y < h; y++) for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) {
    if (dx === 1 && dz === 1) continue;
    let col = wall;
    if (dx === 1 && dz === 2 && y === 0) col = '#5a3a22';
    else if (y === 1 && dz === 1) col = '#bfe9ff';
    B(x0 + dx, y, z0 + dz, col, a + y * 0.07, END_CITY, { jit: 0.03 });
  }
  for (let dx = 0; dx < 3; dx++) for (let dz = 0; dz < 3; dz++) B(x0 + dx, h, z0 + dz, roof, a + h * 0.07, END_CITY, { jit: 0.04 });
  B(x0 + 1, h + 1, z0 + 1, roof, a + (h + 1) * 0.07, END_CITY);
}

// ---------- episodio 3: datos reales ----------
const OLD_NAMES = ['Jesús', 'David0125mk', 'pepito$', '.', 'Manmeet', 'Sercol11', 'jose_tlx', 'Calesitoc', 'Lucas', 'ZERO',
  'MartinpavaFutbolero', 'Limmix3009', 'yoreorr', 'eligg', 'O', 'Javier.IC', 'Yousaf', 'santipepe'];
// comentaristas nuevos (los que ya tenían casa no repiten). [nombre, pared?, tejado?] para los pedidos de color
const NEW_NAMES = ['ivan', ['Alexia', '#2a3f8f', '#18245c'], 'dariotello76', 'Johansen', 'MOHA EL DIABLO', 'Øriøl', 'Pablito 03', 'Galder',
  'Iana', 'yisusprice', 'los 4 mosquecoches', 'manuel', 'pablo Requena', 'noah.mojena', 'ibra panettone', 'Kevin Picon Araujo',
  'Panchus013', 'Danii.13', 'momazos cebolla', 'abel.dz', 'Yago_Mm', 'pau_013', 'jijijijiji942', '€:bakugo',
  'XxRodri_xX', 'rubenn', 'Fatou lindaaaa', 'Jayden', ['alonsito', '#f7d94a', '#c62828'], 'ianbeltranortiZ8', 'Marktiktoker', 'REMOLACHAVR',
  'angelJSC', 'panperopan', "alex (ricky's versión)", 'Danii 3', 'ES', 'Køptus', 'Thorfin', 'EberSPG',
  'patata', 'Mayra_gazpacho', 'Raulete_LESGO', 'astromidas', 'boyiqiu4', 'Gonzalo', 'Abandonado...', 'O_o',
  'Amaris_OF', 'Yaroo!', 'Alejandroo', 'IZAN RF', 'Ema_xx', 'moreno', 'jaaimee._mrtnn', 'pablo hyuga',
  'Aitor', 'Lucas_014', 'izzann_2', 'davix9039', 'Ramón al Jamon', 'Alejandro'].map((n) => (Array.isArray(n) ? n : [n]));
const PREV = 28, FOLLOWERS = Number(new URLSearchParams(location.search).get('n') ?? 100), GOAL = 100;
const SURPRISE = FOLLOWERS >= GOAL;
const NLOTS = Math.ceil(NEW_NAMES.length / 4);
const T_MAYOR = 3.4, T_LOTS = 6.2, SHOT = 0.9, T_VOTE = T_LOTS + NLOTS * SHOT, T_END = T_VOTE + 4.6;
const T_CTA = SURPRISE ? T_END + 4.2 : T_END, T_LAST = T_CTA + 3.6;
const T_RULE = SURPRISE ? T_LAST : T_LAST + 2.2, TOTAL = T_RULE + 5.6; // T_RULE: aviso del horario diario

// casa grande (una por parcela). glass = casa "fantasma" de cristal
function bigHouse(ox, oz, wall, roof, a, glass) {
  const hx = ox + 2, hz = oz + 2, G = { glass: true, jit: 0.02 };
  const perim = [];
  for (let i = 0; i < 5; i++) perim.push([i, 4]);
  for (let k = 3; k >= 0; k--) perim.push([4, k]);
  for (let i = 3; i >= 0; i--) perim.push([i, 0]);
  for (let k = 1; k <= 3; k++) perim.push([0, k]);
  for (let y = 0; y < 4; y++) for (const [i, k] of perim) {
    let col = wall;
    if ((i === 0 || i === 4) && (k === 0 || k === 4)) col = '#8a6a4a';
    if (i === 2 && k === 4 && y < 2) col = '#5a3a22';
    if (y === 2 && ((k === 4 && (i === 1 || i === 3)) || (k === 2 && (i === 0 || i === 4)))) col = '#bfe9ff';
    if (glass) B(hx + i, y, hz + k, '#cfefff', -1, 1e9, G);
    else B(hx + i, y, hz + k, col, a + y * 0.05, 1e9, { jit: 0.03, drop: 9 });
  }
  for (let s = 0; s < 4; s++) for (let k = -1; k <= 5; k++) for (let i = -1 + s; i <= 5 - s; i++) {
    if (glass) { if (k === -1 || k === 5 || i === -1 + s || i === 5 - s) B(hx + i, 4 + s, hz + k, '#cfefff', -1, 1e9, G); }
    else B(hx + i, 4 + s, hz + k, roof, a + 0.2 + s * 0.05, 1e9, { jit: 0.05, drop: 9 });
  }
}

// parcelas (mismo orden y mismos colores que en el episodio 2):
// filas 1, 3 y 5 = las 18 casas grandes de ayer; el resto eran parques y ahora son barrios nuevos
const lots = [];
for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) if (!isSpecial(a, b))
  lots.push({ a, b, d: Math.hypot(a - 3, b - 3) + rnd() * 0.3 });
lots.sort((p, q) => p.d - q.d);
const homes = [], parks = [];
for (const l of lots) {
  const ox = lotO(l.a), oz = lotO(l.b);
  if (l.b % 2 === 1 && homes.length < OLD_NAMES.length) {
    bigHouse(ox, oz, pick(WALLS), pick(ROOFS), -1, false);
    homes.push({ name: OLD_NAMES[homes.length], c: new THREE.Vector3(ox + 4.5, 0, oz + 4.5), oz });
  } else if (l.b % 2 === 1) {
    tree(ox + 4, oz + 4);
  } else {
    l.bushes = [];
    for (let k = 0; k < 7; k++) {
      const i = 1 + Math.floor(rnd() * 7), j = 1 + Math.floor(rnd() * 7);
      l.bushes.push([ox + i, oz + j, rnd() < 0.25 ? pick(['#e84a5f', '#ffd23f', '#f6f6f6']) : '#2f8f3a']);
    }
    parks.push(l);
  }
}
// barrios nuevos: 4 casas por parcela (la parcela al sur del ayuntamiento se queda libre para la cámara del alcalde)
const blocksNew = [], newHomes = [];
for (const l of parks) {
  const ox = lotO(l.a), oz = lotO(l.b);
  if (!(l.a === 3 && l.b === 4) && newHomes.length < NEW_NAMES.length) {
    const blk = { c: new THREE.Vector3(ox + 4.5, 0, oz + 4.5), homes: [] };
    for (const [dx, dz] of [[1, 1], [5, 1], [1, 5], [5, 5]]) {
      if (newHomes.length >= NEW_NAMES.length) break;
      const [name, wall, roof] = NEW_NAMES[newHomes.length];
      const a = 0.1 + newHomes.length * 0.045;
      smallHouse(ox + dx, oz + dz, a, wall, roof);
      const h = { name, a, x: ox + dx + 1.5, z: oz + dz + 1.6, blk: blocksNew.length };
      blk.homes.push(h); newHomes.push(h);
    }
    blocksNew.push(blk);
  } else for (const [x, z, col] of l.bushes) B(x, 0, z, col, -1, 1e9, { jit: 0.1 });
}

// town hall
{
  const ox = lotO(3), oz = lotO(3);
  for (let i = 1; i <= 7; i++) for (let k = 1; k <= 7; k++) B(ox + i, 0, oz + k, '#cdbb8f');
  for (let y = 1; y <= 4; y++) {
    for (let i = 2; i <= 6; i++) for (let k = 2; k <= 5; k++) {
      if (i > 2 && i < 6 && k > 2 && k < 5) continue;
      const door = i === 4 && k === 5 && y <= 2;
      B(ox + i, y, oz + k, door ? '#6b3f22' : '#eadcb2', -1, 1e9, { jit: 0.03 });
    }
    for (const i of [1, 3, 5, 7]) B(ox + i, y, oz + 7, '#f6f3e8', -1, 1e9, { jit: 0.02 });
  }
  for (let i = 0; i <= 8; i++) for (let k = 1; k <= 8; k++) B(ox + i, 5, oz + k, '#c9a86a');
  for (let i = 1; i <= 7; i++) for (let k = 2; k <= 7; k++) B(ox + i, 6, oz + k, '#d8b97c');
  for (let y = 7; y <= 9; y++) for (let i = 3; i <= 5; i++) for (let k = 3; k <= 5; k++)
    B(ox + i, y, oz + k, i === 4 && k === 5 && y === 8 ? '#ffffff' : '#eadcb2', -1, 1e9, { jit: 0.02 });
  for (let i = 3; i <= 5; i++) for (let k = 3; k <= 5; k++) B(ox + i, 10, oz + k, '#3f6fbf');
  B(ox + 4, 11, oz + 4, '#3f6fbf'); B(ox + 4, 12, oz + 4, '#8a8a8a'); B(ox + 4, 13, oz + 4, '#ffcf33');
}

bigHouse(lotO(HERO[0]), lotO(HERO[1]), '', '', 0, true);
tree(lotO(2), lotO(3) + 8);

// plaza (opción ganadora)
{
  const ox = lotO(4), oz = lotO(4);
  const at = () => -1; // la plaza ya está construida
  for (let i = 1; i <= 7; i++) for (let k = 1; k <= 7; k++) B(ox + i, 0, oz + k, (i + k) % 2 ? '#d8d2c0' : '#c4bda8', at(0), 1e9, { jit: 0.02 });
  for (let i = 3; i <= 5; i++) for (let k = 3; k <= 5; k++) B(ox + i, 1, oz + k, i === 4 && k === 4 ? '#8f959c' : '#4fb3ff', at(1), 1e9);
  for (let i = 2; i <= 6; i++) for (let k = 2; k <= 6; k++) if (i === 2 || i === 6 || k === 2 || k === 6) B(ox + i, 1, oz + k, '#9aa0a6', at(1), 1e9);
  B(ox + 4, 2, oz + 4, '#8f959c', at(2), 1e9); B(ox + 4, 3, oz + 4, '#8f959c', at(3), 1e9); B(ox + 4, 4, oz + 4, '#4fb3ff', at(4), 1e9);
  for (const [i, k] of [[1, 1], [7, 1], [1, 7], [7, 7]]) {
    B(ox + i, 1, oz + k, '#6b4a2b', at(1), 1e9); B(ox + i, 2, oz + k, '#6b4a2b', at(2), 1e9);
    B(ox + i, 3, oz + k, '#3aa544', at(3), 1e9); B(ox + i, 4, oz + k, '#3aa544', at(4), 1e9);
  }
}

// regalo sorpresa (solo si se llegó a la meta)
if (SURPRISE) {
  for (let y = 0; y < 3; y++) for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++)
    B(GC.x - 0.5 + i, y, GC.z - 0.5 + k, i === 0 || k === 0 ? '#ffcf33' : '#7b3fd1', T_END + 0.15 + y * 0.05, 1e9, { drop: 14, jit: 0.03 });
  for (const i of [-1, 0, 1]) B(GC.x - 0.5 + i, 3, GC.z - 0.5, '#ffcf33', T_END + 0.35, 1e9, { drop: 14 });
}

// ---------- three setup ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const SKY = new THREE.Color('#8fcbff');
const scene = new THREE.Scene();
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 90, 300);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.5, 600);

scene.add(new THREE.HemisphereLight('#ffffff', '#7a8a6a', 1.5));
const sun = new THREE.DirectionalLight('#fff4dd', 2.2);
sun.position.set(C.x + 45, 80, C.z + 30); sun.target.position.copy(C);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 220 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

// pixel texture shared by all blocks
function pixelTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 16;
  const g = cv.getContext('2d'); const r = mulberry32(5);
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
    let v = 205 + Math.floor(r() * 4) * 16;
    if (x === 0 || y === 0 || x === 15 || y === 15) v *= 0.86;
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const tex = pixelTexture();
const box = new THREE.BoxGeometry(1, 1, 1);
const solid = blocks.filter((b) => !b.glass), glass = blocks.filter((b) => b.glass);
const solidMesh = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ map: tex }), solid.length);
solidMesh.castShadow = solidMesh.receiveShadow = true; solidMesh.frustumCulled = false;
const glassMesh = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.42, depthWrite: false }), glass.length);
glassMesh.frustumCulled = false;
solid.forEach((b, i) => solidMesh.setColorAt(i, b.c));
glass.forEach((b, i) => glassMesh.setColorAt(i, b.c));
scene.add(solidMesh, glassMesh);

// far ground, hills, clouds
const far = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: '#58b83a' }));
far.rotation.x = -Math.PI / 2; far.position.set(C.x, -0.05, C.z); far.receiveShadow = true; scene.add(far);
for (let k = 0; k < 14; k++) {
  const ang = (k / 14) * Math.PI * 2 + rnd() * 0.3, r = 135 + rnd() * 50, steps = 3 + Math.floor(rnd() * 4);
  for (let s = 0; s < steps; s++) {
    const w = (steps - s) * 16;
    const m = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: s >= 4 ? '#eef3f5' : s >= 2 ? '#8a9a94' : '#4f9a48', map: tex }));
    m.scale.set(w, 8, w); m.position.set(C.x + Math.sin(ang) * r, 4 + s * 8, C.z + Math.cos(ang) * r); scene.add(m);
  }
}
for (let k = 0; k < 22; k++) {
  const ang = rnd() * Math.PI * 2, r = 70 + rnd() * 150;
  const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }));
  m.scale.set(12 + rnd() * 16, 3, 8 + rnd() * 8); m.position.set(C.x + Math.sin(ang) * r, 62 + rnd() * 18, C.z + Math.cos(ang) * r); scene.add(m);
}

// mayor
function part(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
const mayor = new THREE.Group();
let armPivot;
{
  const NAVY = '#1f2a55', SKIN = '#e8b88a';
  part(0.24, 0.75, 0.24, '#151a33', -0.13, 0.375, 0, mayor); part(0.24, 0.75, 0.24, '#151a33', 0.13, 0.375, 0, mayor);
  part(0.5, 0.75, 0.26, NAVY, 0, 1.125, 0, mayor);
  part(0.1, 0.34, 0.02, '#d92b3a', 0, 1.3, 0.14, mayor);
  part(0.06, 0.06, 0.02, '#ffcf33', 0.14, 1.2, 0.14, mayor); part(0.06, 0.06, 0.02, '#ffcf33', 0.14, 1.0, 0.14, mayor);
  const la = part(0.22, 0.7, 0.22, NAVY, -0.37, 1.13, 0, mayor); part(0.22, 0.16, 0.22, SKIN, 0, -0.43, 0, la);
  armPivot = new THREE.Group(); armPivot.position.set(0.37, 1.42, 0); mayor.add(armPivot);
  const ra = part(0.22, 0.7, 0.22, NAVY, 0, -0.3, 0, armPivot); part(0.22, 0.16, 0.22, SKIN, 0, -0.43, 0, ra);
  const cv = document.createElement('canvas'); cv.width = cv.height = 8; const g = cv.getContext('2d');
  g.fillStyle = SKIN; g.fillRect(0, 0, 8, 8);
  g.fillStyle = '#fff'; g.fillRect(1, 3, 2, 1); g.fillRect(5, 3, 2, 1);
  g.fillStyle = '#20242c'; g.fillRect(2, 3, 1, 1); g.fillRect(5, 3, 1, 1);
  g.fillStyle = '#d99a72'; g.fillRect(3, 4, 2, 1);
  g.fillStyle = '#5a3a1e'; g.fillRect(1, 5, 6, 1); g.fillRect(1, 6, 1, 1); g.fillRect(6, 6, 1, 1);
  const ft = new THREE.CanvasTexture(cv); ft.magFilter = THREE.NearestFilter; ft.colorSpace = THREE.SRGBColorSpace;
  const skin = new THREE.MeshLambertMaterial({ color: SKIN });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), [skin, skin, skin, skin, new THREE.MeshLambertMaterial({ map: ft }), skin]);
  head.position.y = 1.75; head.castShadow = true; mayor.add(head);
  part(0.7, 0.06, 0.7, '#16161a', 0, 2.03, 0, mayor); part(0.46, 0.12, 0.46, '#d92b3a', 0, 2.12, 0, mayor); part(0.44, 0.4, 0.44, '#16161a', 0, 2.36, 0, mayor);
  mayor.scale.setScalar(1.5); scene.add(mayor);
}
const MAYOR_HALL = new THREE.Vector3(C.x, 0, lotO(3) + 8.6);

await document.fonts.load('700 46px Pix');
// carteles con nombre
function makeSign(text, scale = 1, tilt = -0.3) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const g = cv.getContext('2d');
  g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, 512, 160); g.fillStyle = '#fff8e6'; g.fillRect(12, 12, 488, 136);
  g.fillStyle = '#16161a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 84; g.font = `700 ${size}px Pix`;
  const w = g.measureText(text).width; if (w > 450) { size *= 450 / w; g.font = `700 ${size}px Pix`; }
  g.fillText(text, 256, 84);
  const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace; st.anisotropy = 8;
  const grp = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.44, 0.14), [0, 0, 0, 0, 1, 0].map((f) => new THREE.MeshLambertMaterial(f ? { map: st } : { color: '#3a2a1a' })));
  board.position.y = 1.9; board.rotation.x = tilt; board.castShadow = true; grp.add(board);
  part(0.2, 1.3, 0.2, '#6b4a2b', -1.6, 0.65, 0, grp); part(0.2, 1.3, 0.2, '#6b4a2b', 1.6, 0.65, 0, grp);
  grp.userData.s = scale; grp.scale.setScalar(scale);
  scene.add(grp); return grp;
}
homes.forEach((h) => makeSign(h.name).position.set(h.c.x, 0, h.oz + 8.3));
const signs = newHomes.map((h) => { const g = makeSign(h.name, 0.62, -0.85); g.position.set(h.x, 3.9, h.z); return g; });

// rejilla 2x2 con los nombres de cada manzana
const stage = document.getElementById('stage');
const cells = [0, 1, 2, 3].map((i) => {
  const d = document.createElement('div');
  d.style.cssText = `position:absolute;left:${i % 2 ? 545 : 15}px;top:${i < 2 ? 185 : 300}px;width:520px;text-align:center;white-space:nowrap;` +
    'color:#ffd23f;-webkit-text-stroke:10px #111;paint-order:stroke fill;text-shadow:0 6px 0 #111;letter-spacing:-2px;';
  stage.appendChild(d); return d;
});

// ---------- timeline ----------
const orbit = (r, h, a) => [C.x + Math.sin(a) * r, h, C.z + Math.cos(a) * r];
const HP = (dx, y, dz) => [HC.x + dx, y, HC.z + dz];
const VX = lotO(4) + 4.5, MZ = MAYOR_HALL.z, CLOSE = 55, VZ = C.z - 5.5;
const cams = [
  { t0: 0, t1: T_MAYOR, p0: orbit(70, 58, 0.95), p1: orbit(54, 42, 0.55), q0: [C.x, 2, C.z], q1: [C.x, 3, C.z] },
  { t0: T_MAYOR, t1: T_LOTS, p0: [C.x + 1.4, 3.1, MZ + 6.8], p1: [C.x + 0.6, 3.0, MZ + 5.8], q0: [C.x, 2.55, MZ], q1: [C.x, 2.55, MZ] },
  ...blocksNew.map((b, k) => {
    const s = k % 2 ? -1 : 1;
    return { t0: T_LOTS + k * SHOT, t1: T_LOTS + (k + 1) * SHOT, fov: CLOSE,
      p0: [b.c.x + 2.5 * s, 19, b.c.z + 13.5], p1: [b.c.x + 1.2 * s, 17, b.c.z + 12], q0: [b.c.x, 1, b.c.z + 1.2], q1: [b.c.x, 1, b.c.z + 1.2] };
  }),
  { t0: T_VOTE, t1: T_END, p0: [VX + 27, 29, VZ + 8], p1: [VX + 23, 25, VZ + 5], q0: [VX, 1, VZ], q1: [VX, 1, VZ], fov: CLOSE },
  ...(SURPRISE ? [{ t0: T_END, t1: T_CTA, p0: [GC.x + 6, 15, GC.z + 16], p1: [GC.x + 3.5, 12.5, GC.z + 13], q0: [GC.x, 3.2, GC.z], q1: [GC.x, 3.2, GC.z], fov: CLOSE }] : []),
  { t0: T_CTA, t1: 99, p0: HP(7, 9, 20), p1: HP(-1, 12, 21), q0: HP(0, 3, 0), q1: HP(0, 3, 0), dur: T_RULE - T_CTA, fov: CLOSE },
  { t0: T_RULE, t1: TOTAL, p0: [C.x - 1.4, 3.1, MZ + 6.6], p1: [C.x - 0.4, 3.0, MZ + 5.6], q0: [C.x, 2.55, MZ], q1: [C.x, 2.55, MZ] },
];
const Y = '#ffd23f', NN = NEW_NAMES.length;
const caps = [
  { t0: 0, small: 'AYER', big: `${PREV} HABITANTES` },
  { t0: 1.5, small: 'HOY', big: `¡${FOLLOWERS} HABITANTES!` },
  { t0: T_MAYOR, small: 'EN UN SOLO DÍA', big: `¡${NN} CASAS NUEVAS!` },
  ...blocksNew.map((b, k) => ({ t0: T_LOTS + k * SHOT, small: `CASAS ${k * 4 + 1}-${k * 4 + b.homes.length} DE ${NN}`, big: '', grid: b.homes, sub: 'PAUSA Y BUSCA LA TUYA', subKeep: k > 0 })),
  { t0: T_VOTE, small: 'SEGUNDA VOTACIÓN', big: '¿A O B?', sub: 'A: HOSPITAL  ·  B: CENTRO COMERCIAL' },
  ...(SURPRISE ? [{ t0: T_END, small: `¡${FOLLOWERS} HABITANTES!`, big: 'SORPRESA', sub: 'DESBLOQUEADA · MAÑANA LA ABRIMOS' }] : []),
  { t0: T_CTA, small: '¿AÚN NO TIENES CASA?', big: 'COMENTA', sub: 'Y TE LA CONSTRUYO' },
  ...(SURPRISE ? [] : [{ t0: T_LAST, small: `A LOS ${GOAL}`, big: 'SORPRESA', sub: 'COMENTA Y TE CONSTRUYO TU CASA' }]),
  { t0: T_RULE, small: 'NUEVO VÍDEO CADA DÍA', big: 'A LAS 17:20', sub: 'SÍGUEME ANTES DE LAS 17:00 O NO SALES' },
];

// ---------- per-frame ----------
const $ = (id) => document.getElementById(id);
const el = { small: $('small'), big: $('big'), sub: $('sub'), hud: $('hud'), hudLabel: $('hudLabel'), hudVal: $('hudVal'), q: $('q'), A: $('tagA'), B: $('tagB'), C: $('tagC') };
el.C.style.display = 'none';
const dummy = new THREE.Object3D(), v3 = new THREE.Vector3();
function updateBlocks(list, mesh, t) {
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    let s = 1, dy = 0;
    if (t < b.a) s = 0;
    else if (b.a >= 0 && !b.glass) { const p = clamp01((t - b.a) / 0.3); s = Math.max(0.01, easeOutBack(p)); dy = (1 - p) * (1 - p) * b.drop; }
    const st = s === 0 ? 0 : s === 1 && dy === 0 ? 2 : 1;
    if (st !== 1 && b.st === st) continue;
    b.st = st;
    dummy.position.set(b.x + 0.5, b.y + 0.5 + dy, b.z + 0.5); dummy.scale.setScalar(s); dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}
function place(node, x, y, z, show) {
  v3.set(x, y, z).project(camera);
  node.style.display = show ? 'block' : 'none';
  node.style.left = ((v3.x + 1) / 2) * W + 'px'; node.style.top = ((1 - v3.y) / 2) * H + 'px';
}
let lastCap = null;
function renderFrame(t) {
  updateBlocks(solid, solidMesh, t); updateBlocks(glass, glassMesh, t);
  glassMesh.material.opacity = 0.4 + 0.08 * Math.sin(t * 5);

  const c = cams.findLast((k) => t >= k.t0) ?? cams[0];
  const u = clamp01((t - c.t0) / (c.dur ?? c.t1 - c.t0));
  camera.fov = c.fov ?? 40; camera.updateProjectionMatrix();
  camera.position.set(lerp(c.p0[0], c.p1[0], u), lerp(c.p0[1], c.p1[1], u), lerp(c.p0[2], c.p1[2], u));
  camera.lookAt(lerp(c.q0[0], c.q1[0], u), lerp(c.q0[1], c.q1[1], u), lerp(c.q0[2], c.q1[2], u));
  camera.updateMatrixWorld();

  mayor.position.copy(MAYOR_HALL); mayor.position.y = Math.abs(Math.sin(t * 5)) * 0.06;
  armPivot.rotation.z = 2.55 + Math.sin(t * 11) * 0.35;

  signs.forEach((g, k) => {
    const h = newHomes[k], born = clamp01((t - h.a - 0.4) / 0.25), lt = t - (T_LOTS + h.blk * SHOT);
    const bump = lt >= 0 && lt < SHOT ? 1 + 0.3 * Math.pow(1 - clamp01(lt / 0.25), 2) : 1;
    g.visible = born > 0; g.scale.setScalar(Math.max(0.01, easeOutBack(born)) * bump * g.userData.s);
  });

  const cap = caps.findLast((k) => t >= k.t0);
  const lt = t - cap.t0;
  if (lastCap !== cap) {
    lastCap = cap;
    el.small.textContent = cap.small; el.sub.textContent = cap.sub ?? '';
    el.sub.style.fontSize = '44px'; el.sub.style.fontSize = 44 * Math.min(1, 1000 / el.sub.scrollWidth) + 'px';
    el.big.textContent = cap.big; el.big.style.fontSize = '112px';
    if (cap.big) el.big.style.fontSize = 112 * Math.min(1, 960 / el.big.scrollWidth) + 'px';
    cells.forEach((d, i) => {
      const h = cap.grid?.[i];
      d.textContent = h ? h.name : ''; d.style.fontSize = '62px';
      if (h) d.style.fontSize = 62 * Math.min(1, 490 / d.scrollWidth) + 'px';
    });
  }
  el.big.style.color = cap.color ?? Y;
  el.big.style.transform = `scale(${1 + 0.4 * Math.pow(1 - clamp01(lt / 0.2), 2)})`;
  el.big.style.opacity = el.small.style.opacity = clamp01(lt / 0.07);
  el.sub.style.opacity = cap.subKeep ? 1 : clamp01((lt - 0.25) / 0.15);
  cells.forEach((d, i) => {
    const l = lt - i * 0.06;
    d.style.opacity = clamp01(l / 0.06);
    d.style.transform = `scale(${1 + 0.35 * Math.pow(1 - clamp01(l / 0.18), 2)})`;
  });

  el.hud.style.display = 'block';
  el.hudLabel.textContent = 'HABITANTES';
  const n = Math.round(lerp(PREV, FOLLOWERS, smooth(clamp01((t - 0.1) / 2.9))));
  el.hudVal.textContent = !SURPRISE && t >= T_LAST && t < T_RULE ? `${FOLLOWERS} / ${GOAL}` : n;

  const vote = t >= T_VOTE && t < T_END;
  place(el.A, VX, 4, C.z, vote); place(el.B, VX, 4, C.z - 11, vote);
  place(el.q, GC.x, 6.6 + Math.sin(t * 6) * 0.25, GC.z, SURPRISE && t >= T_END + 0.6 && t < T_CTA);

  renderer.render(scene, camera);
}

window.renderFrame = renderFrame;
window.DURATION = TOTAL;
window.STILLS = [0.5, 2.8, 4.5, T_LOTS + 0.5, T_LOTS + SHOT * 1.6, T_LOTS + SHOT * 4.6, T_LOTS + SHOT * 7.6, T_LOTS + SHOT * 15.6, T_VOTE + 2, T_END + 2, T_CTA + 1.5, TOTAL - 1];
window.ready = true;
