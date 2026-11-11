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

export const DURATION = 37.0;
const W = 1080, H = 1920;
const END_CITY = 33.1; // la ciudad vuelve a estar vacía

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
function smallHouse(x0, z0, a) {
  const h = rnd() < 0.3 ? 3 : 2, wall = pick(WALLS), roof = pick(ROOFS);
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

// ordinary lots: trees + houses (houses appear later)
const houseSpots = [];
for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
  if (isSpecial(a, b)) continue;
  const ox = lotO(a), oz = lotO(b);
  const front = a === 3 && b === 4; // deja libre la vista de la cámara del alcalde
  if (!front) tree(ox + 4, oz + 4);
  if (!front && rnd() < 0.5) { const s = pick([[4, 0], [0, 4], [8, 4], [4, 8]]); tree(ox + s[0], oz + s[1]); }
  for (const [dx, dz] of [[1, 1], [5, 1], [1, 5], [5, 5]]) {
    if (front && dz === 1) continue;
    const dist = Math.hypot(ox + dx + 1.5 - HC.x, oz + dz + 1.5 - HC.z);
    houseSpots.push({ x: ox + dx, z: oz + dz, key: dist + rnd() * 14 });
  }
}
houseSpots.sort((p, q) => p.key - q.key);
const EARLY = 14;
houseSpots.forEach((s, k) => {
  const a = k < EARLY ? 17.7 + (k / EARLY) * 1.4 : 21.2 + Math.pow((k - EARLY) / (houseSpots.length - EARLY), 0.8) * 3.3;
  smallHouse(s.x, s.z, a);
});

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

// hero house (solid) + ghost house (glass)
const hx = lotO(2) + 2, hz = lotO(3) + 2;
function heroHouse(glass) {
  const perim = [];
  for (let i = 0; i < 5; i++) perim.push([i, 4]);
  for (let k = 3; k >= 0; k--) perim.push([4, k]);
  for (let i = 3; i >= 0; i--) perim.push([i, 0]);
  for (let k = 1; k <= 3; k++) perim.push([0, k]);
  let n = 0;
  for (let y = 0; y < 4; y++) for (const [i, k] of perim) {
    let col = '#e8b98a';
    if ((i === 0 || i === 4) && (k === 0 || k === 4)) col = '#b98557';
    if (i === 2 && k === 4 && y < 2) col = '#2f6b5a';
    if (y === 2 && ((k === 4 && (i === 1 || i === 3)) || (k === 2 && (i === 0 || i === 4)))) col = '#bfe9ff';
    if (glass) B(hx + i, y, hz + k, '#cfefff', END_CITY, 1e9, { glass: true, jit: 0.02 });
    else B(hx + i, y, hz + k, col, 10.2 + (n++ / 64) * 3.4, END_CITY, { jit: 0.03 });
  }
  n = 0;
  for (let s = 0; s < 4; s++) for (let k = -1; k <= 5; k++) for (let i = -1 + s; i <= 5 - s; i++) {
    if (glass) { if (k === -1 || k === 5 || i === -1 + s || i === 5 - s) B(hx + i, 4 + s, hz + k, '#cfefff', END_CITY, 1e9, { glass: true, jit: 0.02 }); }
    else B(hx + i, 4 + s, hz + k, '#c62828', 14.05 + (n++ / 112) * 1.3, END_CITY, { jit: 0.05 });
  }
}
heroHouse(false); heroHouse(true);
tree(lotO(2), lotO(3) + 8);

// surprise gift
for (let y = 0; y < 3; y++) for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++)
  B(GC.x - 0.5 + i, y, GC.z - 0.5 + k, i === 0 || k === 0 ? '#ffcf33' : '#7b3fd1', 19.35 + y * 0.05, END_CITY, { drop: 14, jit: 0.03 });
for (const i of [-1, 0, 1]) B(GC.x - 0.5 + i, 3, GC.z - 0.5, '#ffcf33', 19.55, END_CITY, { drop: 14 });

// vote options
const T_PLAZA = 26.0, T_HOSP = 27.2, T_MALL = 28.4;
{
  let ox = lotO(4), oz = lotO(4); // plaza
  const at = (y) => T_PLAZA + y * 0.12 + rnd() * 0.15;
  for (let i = 1; i <= 7; i++) for (let k = 1; k <= 7; k++) B(ox + i, 0, oz + k, (i + k) % 2 ? '#d8d2c0' : '#c4bda8', at(0), END_CITY, { jit: 0.02 });
  for (let i = 3; i <= 5; i++) for (let k = 3; k <= 5; k++) B(ox + i, 1, oz + k, i === 4 && k === 4 ? '#8f959c' : '#4fb3ff', at(1), END_CITY);
  for (let i = 2; i <= 6; i++) for (let k = 2; k <= 6; k++) if (i === 2 || i === 6 || k === 2 || k === 6) B(ox + i, 1, oz + k, '#9aa0a6', at(1), END_CITY);
  B(ox + 4, 2, oz + 4, '#8f959c', at(2), END_CITY); B(ox + 4, 3, oz + 4, '#8f959c', at(3), END_CITY); B(ox + 4, 4, oz + 4, '#4fb3ff', at(4), END_CITY);
  for (const [i, k] of [[1, 1], [7, 1], [1, 7], [7, 7]]) {
    B(ox + i, 1, oz + k, '#6b4a2b', at(1), END_CITY); B(ox + i, 2, oz + k, '#6b4a2b', at(2), END_CITY);
    B(ox + i, 3, oz + k, '#3aa544', at(3), END_CITY); B(ox + i, 4, oz + k, '#3aa544', at(4), END_CITY);
  }
  oz = lotO(3); // hospital, front faces +x
  for (let y = 0; y <= 6; y++) for (let i = 2; i <= 6; i++) for (let k = 1; k <= 7; k++) {
    if (y < 6 && i > 2 && i < 6 && k > 1 && k < 7) continue;
    let col = '#f4f4f4';
    if (i === 6 && k === 4 && y <= 1) col = '#7fe0f5';
    else if (y % 2 === 1 && y < 6 && ((i === 6 && k % 2 === 0) || ((k === 1 || k === 7) && i % 2 === 0))) col = '#3f7fd6';
    B(ox + i, y, oz + k, col, T_HOSP + y * 0.1 + rnd() * 0.1, END_CITY, { jit: 0.02 });
  }
  for (let y = 7; y <= 9; y++) for (let k = 3; k <= 5; k++)
    B(ox + 6, y, oz + k, y === 8 || k === 4 ? '#e02b2b' : '#f4f4f4', T_HOSP + y * 0.1, END_CITY, { jit: 0.02 });
  oz = lotO(2); // mall, front faces +x
  for (let y = 0; y <= 2; y++) for (let i = 1; i <= 6; i++) for (let k = 1; k <= 7; k++) {
    if (i > 1 && i < 6 && k > 1 && k < 7) continue;
    const front = i === 6 && y < 2 && k !== 1 && k !== 4 && k !== 7;
    B(ox + i, y, oz + k, front ? '#7fe0f5' : '#f27a8a', T_MALL + y * 0.12 + rnd() * 0.1, END_CITY, { jit: 0.03 });
  }
  for (let i = 1; i <= 7; i++) for (let k = 1; k <= 7; k++) B(ox + i, 3, oz + k, '#6a3fb5', T_MALL + 0.4 + rnd() * 0.1, END_CITY, { jit: 0.03 });
  for (let y = 4; y <= 5; y++) for (let k = 2; k <= 6; k++) B(ox + 6, y, oz + k, '#ffd23f', T_MALL + 0.55 + y * 0.03, END_CITY, { jit: 0.02 });
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

// name sign
const sign = new THREE.Group();
{
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const g = cv.getContext('2d');
  g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#fff8e6'; g.fillRect(8, 8, 240, 80);
  g.fillStyle = '#16161a'; g.font = '700 34px Pix'; g.textAlign = 'center'; g.textBaseline = 'middle';
  sign.userData.draw = () => { g.fillStyle = '#fff8e6'; g.fillRect(8, 8, 240, 80); g.fillStyle = '#16161a'; g.fillText('@tu_alias', 128, 50); st.needsUpdate = true; };
  const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.12), [0, 0, 0, 0, 1, 0].map((f) => new THREE.MeshLambertMaterial(f ? { map: st } : { color: '#3a2a1a' })));
  board.position.y = 1.5; board.castShadow = true; sign.add(board);
  part(0.16, 1.1, 0.16, '#6b4a2b', -0.8, 0.55, 0, sign); part(0.16, 1.1, 0.16, '#6b4a2b', 0.8, 0.55, 0, sign);
  sign.position.set(hx + 5.2, 0, hz + 6.6); sign.rotation.y = -0.25; scene.add(sign);
}

// ---------- timeline ----------
const orbit = (r, h, a) => [C.x + Math.sin(a) * r, h, C.z + Math.cos(a) * r];
const HP = (dx, y, dz) => [HC.x + dx, y, HC.z + dz];
const VX = lotO(4) + 4.5;
const MZ = MAYOR_HALL.z, CLOSE = 55;
const cams = [
  { t0: 0, t1: 3.2, p0: orbit(74, 62, 0.95), p1: orbit(50, 36, 0.55), q0: [C.x, 2, C.z], q1: [C.x, 3, C.z] },
  { t0: 3.2, t1: 5.6, p0: [C.x + 1.4, 3.1, MZ + 6.8], p1: [C.x + 0.6, 3.0, MZ + 5.8], q0: [C.x, 2.55, MZ], q1: [C.x, 2.55, MZ] },
  { t0: 5.6, t1: 8.0, p0: [C.x, 3.4, MZ + 8], p1: [C.x - 6, 30, MZ + 40], q0: [C.x, 2.2, MZ], q1: [C.x, 2, C.z] },
  { t0: 8.0, t1: 10.0, p0: HP(6, 10, 25), p1: HP(4, 9, 22), q0: HP(0, 1.5, 0), q1: HP(0, 1.5, 0), fov: CLOSE },
  { t0: 10.0, t1: 14.0, p0: HP(9, 10, 25), p1: HP(-4, 9, 24), q0: HP(0, 2.5, 0), q1: HP(0, 3.5, 0), fov: CLOSE },
  { t0: 14.0, t1: 17.5, p0: HP(-7, 10, 24), p1: HP(6, 7, 20), q0: HP(0, 4, 0), q1: HP(1, 3.5, 1), fov: CLOSE },
  { t0: 17.5, t1: 19.3, p0: HP(-8, 24, 36), p1: HP(0, 30, 42), q0: HP(0, 0, 0), q1: HP(0, 0, 0) },
  { t0: 19.3, t1: 21.0, p0: [GC.x + 6, 7.5, GC.z + 16], p1: [GC.x + 4, 6.5, GC.z + 13.5], q0: [GC.x, 3.6, GC.z], q1: [GC.x, 3.6, GC.z], fov: CLOSE },
  { t0: 21.0, t1: 25.0, p0: orbit(62, 50, -0.55), p1: orbit(54, 40, 0.3), q0: [C.x, 0, C.z], q1: [C.x, 0, C.z] },
  { t0: 25.0, t1: 26.0, p0: [VX + 34, 37, GC.z + 28], p1: [VX + 33, 36, GC.z + 27], q0: [VX, 2, C.z], q1: [VX, 2, C.z], fov: CLOSE },
  { t0: 26.0, t1: 27.2, p0: [VX + 23, 15, GC.z + 7], p1: [VX + 20, 13.5, GC.z + 4], q0: [VX, 2, GC.z], q1: [VX, 2, GC.z], fov: CLOSE },
  { t0: 27.2, t1: 28.4, p0: [VX + 26, 17, C.z + 8], p1: [VX + 23, 15.5, C.z + 5], q0: [VX, 5, C.z], q1: [VX, 5, C.z], fov: CLOSE },
  { t0: 28.4, t1: 29.6, p0: [VX + 23, 15, C.z - 11 + 7], p1: [VX + 20, 13.5, C.z - 11 + 4], q0: [VX, 3, C.z - 11], q1: [VX, 3, C.z - 11], fov: CLOSE },
  { t0: 29.6, t1: 31.5, p0: [VX + 33, 36, GC.z + 27], p1: [VX + 30, 33, GC.z + 24], q0: [VX, 2, C.z], q1: [VX, 2, C.z], fov: CLOSE },
  { t0: 31.5, t1: 33.1, p0: [C.x - 1.4, 3.1, MZ + 6.4], p1: [C.x - 0.7, 3.0, MZ + 5.6], q0: [C.x, 2.55, MZ], q1: [C.x, 2.55, MZ] },
  { t0: 33.1, t1: 34.7, p0: orbit(46, 32, 0.45), p1: orbit(52, 38, 0.7), q0: [C.x, 2, C.z], q1: [C.x, 2, C.z] },
  { t0: 34.7, t1: 99, p0: HP(8, 9, 24), p1: HP(-2, 13, 29), q0: HP(0, 3, 0), q1: HP(0, 3, 0), dur: 2.3, fov: CLOSE },
];
const Y = '#ffd23f';
const caps = [
  { t0: 0, small: 'ESTA CIUDAD TIENE', big: '0 HABITANTES' },
  { t0: 3.2, small: '', big: '¡ESTE ES SU ALCALDE!' },
  { t0: 5.6, small: 'PERO NO TIENE', big: 'NI UN VECINO' },
  { t0: 8.0, small: '¿LA SOLUCIÓN?', big: 'TÚ' },
  { t0: 10.0, small: '1 SEGUIDOR =', big: '1 HABITANTE', sub: 'CADA NUEVO SEGUIDOR = UN VECINO' },
  { t0: 14.0, small: '1 COMENTARIO =', big: '1 CASA CON TU NOMBRE', sub: 'COMENTA Y CONSTRUIRÉ TU CASA' },
  { t0: 17.5, small: 'A LOS 100', big: 'UNA SORPRESA', sub: 'AL LLEGAR A CIEN...' },
  { t0: 19.3, small: 'A LOS 100', big: 'UNA SORPRESA', sub: '¡DESBLOQUEAMOS UNA SORPRESA!', keep: true },
  { t0: 21.0, small: 'A LOS 1.000', big: 'VOSOTROS DECIDÍS', sub: 'CÓMO CRECE LA CIUDAD' },
  { t0: 25.0, small: 'PRIMERA', big: 'VOTACIÓN' },
  { t0: 26.0, small: 'A', big: 'PLAZA', color: '#35e0d0', sub: '¿UNA PLAZA...' },
  { t0: 27.2, small: 'B', big: 'HOSPITAL', color: '#ff5566', sub: '...UN HOSPITAL...' },
  { t0: 28.4, small: 'C', big: 'CENTRO COMERCIAL', color: '#ff9f2e', sub: '...O UN CENTRO COMERCIAL?' },
  { t0: 29.6, small: 'COMENTA', big: 'A, B O C' },
  { t0: 31.5, small: 'EN 1 DÍA', big: 'EL GANADOR', sub: 'ANUNCIARÉ EL RESULTADO' },
  { t0: 33.1, small: 'HOY ESTÁ', big: 'VACÍA' },
  { t0: 34.7, small: '¿SERÁ TUYA', big: 'LA PRIMERA CASA?' },
];
function counter(t) {
  if (t < 10.3 || t >= END_CITY) return 0;
  if (t < 17.5) return 1;
  if (t < 19.3) return Math.round(lerp(1, 100, smooth((t - 17.5) / 1.7)));
  if (t < 21.0) return 100;
  return Math.round(lerp(100, 1000, clamp01((t - 21.0) / 3.7) ** 1.3));
}

// ---------- per-frame ----------
const $ = (id) => document.getElementById(id);
const el = { small: $('small'), big: $('big'), sub: $('sub'), hud: $('hud'), hudLabel: $('hudLabel'), hudVal: $('hudVal'), q: $('q'), A: $('tagA'), B: $('tagB'), C: $('tagC') };
const dummy = new THREE.Object3D(), v3 = new THREE.Vector3();
function updateBlocks(list, mesh, t) {
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    let s = 1, dy = 0;
    if (t < b.a || t >= b.d) s = 0;
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
  node.style.display = show && v3.z < 1 ? 'block' : 'none';
  node.style.left = ((v3.x + 1) / 2) * W + 'px'; node.style.top = ((1 - v3.y) / 2) * H + 'px';
}
let lastBig = null;
function renderFrame(t) {
  updateBlocks(solid, solidMesh, t); updateBlocks(glass, glassMesh, t);
  glassMesh.material.opacity = 0.4 + 0.08 * Math.sin(t * 5);

  // camera
  const c = cams.findLast((k) => t >= k.t0) ?? cams[0];
  const u = clamp01((t - c.t0) / (c.dur ?? c.t1 - c.t0));
  const e = c.dur ? smooth(u) : u;
  camera.fov = c.fov ?? 40; camera.updateProjectionMatrix();
  camera.position.set(lerp(c.p0[0], c.p1[0], e), lerp(c.p0[1], c.p1[1], e), lerp(c.p0[2], c.p1[2], e));
  camera.lookAt(lerp(c.q0[0], c.q1[0], e), lerp(c.q0[1], c.q1[1], e), lerp(c.q0[2], c.q1[2], e));
  camera.updateMatrixWorld();

  // mayor
  const atLot = t >= 8 && t < 17.5;
  if (atLot) { mayor.position.set(lotO(2) - 0.4, 0, lotO(3) + 9.6); mayor.rotation.y = 0.9; }
  else { mayor.position.copy(MAYOR_HALL); mayor.rotation.y = 0; }
  mayor.position.y = Math.abs(Math.sin(t * 5)) * 0.06;
  const waving = (t >= 3.2 && t < 5.6) || (t >= 31.5 && t < 33.1) || (t >= 8 && t < 10);
  armPivot.rotation.z = waving ? 2.55 + Math.sin(t * 11) * 0.35 : 0;

  // sign
  const sp = clamp01((t - 15.6) / 0.3);
  sign.visible = t >= 15.6 && t < END_CITY; sign.scale.setScalar(Math.max(0.01, easeOutBack(sp)));

  // captions
  const cap = caps.findLast((k) => t >= k.t0);
  const lt = t - cap.t0;
  el.small.textContent = cap.small; el.sub.textContent = cap.sub ?? '';
  if (lastBig !== cap.big) {
    lastBig = cap.big; el.big.textContent = cap.big; el.big.style.fontSize = '112px';
    const w = el.big.scrollWidth; el.big.dataset.fit = Math.min(1, 960 / w);
    el.big.style.fontSize = 112 * el.big.dataset.fit + 'px';
  }
  el.big.style.color = cap.color ?? Y; el.small.style.color = cap.color ? '#fff' : '#fff';
  const pop = cap.keep ? 1 : 1 + 0.4 * Math.pow(1 - clamp01(lt / 0.2), 2);
  el.big.style.transform = `scale(${pop})`;
  el.big.style.opacity = el.small.style.opacity = cap.keep ? 1 : clamp01(lt / 0.07);
  el.sub.style.opacity = clamp01((lt - 0.25) / 0.15);

  // hud
  const hudOn = t < 25 || t >= END_CITY;
  el.hud.style.display = hudOn ? 'block' : 'none';
  const example = t >= 10.3 && t < 25;
  el.hudLabel.textContent = example ? 'HABITANTES (EJEMPLO)' : 'HABITANTES';
  el.hud.style.borderColor = el.hudLabel.style.color = example ? '#ffd23f' : '#3fe0a0';
  el.hudVal.textContent = counter(t).toLocaleString('es-ES');

  // projected overlays
  const qOn = t >= 19.75 && t < 21;
  place(el.q, GC.x, 6.4 + Math.sin(t * 6) * 0.25, GC.z, qOn);
  const tags = t >= 29.6 && t < 31.5;
  place(el.A, VX, 7, GC.z, tags); place(el.B, VX, 13.5, C.z, tags); place(el.C, VX, 9.5, C.z - 11, tags);

  renderer.render(scene, camera);
}

await document.fonts.load('700 46px Pix');
sign.userData.draw();
window.renderFrame = renderFrame;
window.DURATION = DURATION;
window.ready = true;
