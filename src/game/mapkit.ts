import * as THREE from "three";

/* ============ TEXTURAS PROCEDURALES ============ */
function cvs(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function rnd(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, r: () => number, dark = "rgba(0,0,0,0.12)", light = "rgba(255,255,255,0.1)") {
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() > 0.5 ? dark : light;
    const s = 1 + r() * 2.5;
    g.fillRect(r() * w, r() * h, s, s);
  }
}
function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return "#" + c.getHexString();
}

const texCache = new Map<string, THREE.CanvasTexture>();
export function tex(kind: string, c1 = "#888888", c2 = "#444444"): THREE.CanvasTexture {
  const key = `${kind}|${c1}|${c2}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 256;
  const c = cvs(S, S);
  const g = c.getContext("2d")!;
  const r = rnd(kind.length * 977 + c1.length * 31 + c1.charCodeAt(1) * 7);
  g.fillStyle = c1;
  g.fillRect(0, 0, S, S);
  switch (kind) {
    case "asphalt":
      speckle(g, S, S, 1400, r, "rgba(0,0,0,0.25)", "rgba(255,255,255,0.12)");
      g.strokeStyle = "rgba(0,0,0,0.25)";
      g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        let x = r() * S, y = r() * S;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) g.lineTo((x += (r() - 0.5) * 50), (y += (r() - 0.5) * 50));
        g.stroke();
      }
      break;
    case "concrete":
      speckle(g, S, S, 1000, r);
      g.strokeStyle = "rgba(0,0,0,0.22)";
      g.lineWidth = 2;
      g.strokeRect(0, 0, S, S);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`;
        g.fillRect(r() * S, r() * S, 40 + r() * 80, 20 + r() * 50);
      }
      break;
    case "plaster":
      speckle(g, S, S, 900, r, "rgba(0,0,0,0.07)", "rgba(255,255,255,0.12)");
      for (let i = 0; i < 6; i++) {
        const gr = g.createLinearGradient(0, 0, 0, S);
        gr.addColorStop(0, "rgba(0,0,0,0)");
        gr.addColorStop(1, "rgba(0,0,0,0.08)");
        g.fillStyle = gr;
        g.fillRect(i * 44, 0, 30, S);
      }
      break;
    case "brick": {
      g.fillStyle = c2;
      g.fillRect(0, 0, S, S);
      const rows = 8, bw = 64, bh = S / rows;
      for (let y = 0; y < rows; y++)
        for (let x = -1; x < 5; x++) {
          const ox = (y % 2) * (bw / 2);
          g.fillStyle = shade(c1, (r() - 0.5) * 0.12);
          g.fillRect(x * bw + ox + 2, y * bh + 2, bw - 4, bh - 4);
          speckle(g, 0, 0, 0, r);
        }
      speckle(g, S, S, 600, r, "rgba(0,0,0,0.12)", "rgba(255,255,255,0.06)");
      break;
    }
    case "metal":
      for (let x = 0; x < S; x += 16) {
        const gr = g.createLinearGradient(x, 0, x + 16, 0);
        gr.addColorStop(0, "rgba(255,255,255,0.18)");
        gr.addColorStop(0.5, "rgba(0,0,0,0.0)");
        gr.addColorStop(1, "rgba(0,0,0,0.25)");
        g.fillStyle = gr;
        g.fillRect(x, 0, 16, S);
      }
      speckle(g, S, S, 500, r, "rgba(60,20,0,0.18)", "rgba(255,255,255,0.08)");
      break;
    case "tiles":
      g.fillStyle = c2;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) g.fillRect(x * 64, y * 64, 64, 64);
      g.strokeStyle = "rgba(0,0,0,0.2)";
      g.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, S); g.stroke();
        g.beginPath(); g.moveTo(0, i * 64); g.lineTo(S, i * 64); g.stroke();
      }
      speckle(g, S, S, 500, r, "rgba(0,0,0,0.08)", "rgba(255,255,255,0.12)");
      break;
    case "turf":
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? c1 : c2;
        g.fillRect(0, i * 64, S, 64);
      }
      speckle(g, S, S, 2500, r, "rgba(0,40,0,0.25)", "rgba(200,255,150,0.18)");
      break;
    case "stripes":
      g.fillStyle = c2;
      for (let i = 0; i < 8; i += 2) g.fillRect(i * 32, 0, 32, S);
      break;
    case "wood":
      for (let i = 0; i < 16; i++) {
        g.fillStyle = shade(c1, (r() - 0.5) * 0.1);
        g.fillRect(0, i * 16, S, 15);
      }
      speckle(g, S, S, 400, r);
      break;
    case "hazard":
      g.fillStyle = c2;
      for (let i = -4; i < 8; i++) {
        g.beginPath();
        g.moveTo(i * 64, 0); g.lineTo(i * 64 + 32, 0); g.lineTo(i * 64 + 32 + S, S); g.lineTo(i * 64 + S, S);
        g.fill();
      }
      break;
    default:
      speckle(g, S, S, 500, r);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

export function signTex(text: string, o: { bg?: string; fg?: string; w?: number; h?: number; font?: string; border?: string; sub?: string; subColor?: string } = {}) {
  const w = o.w ?? 512, h = o.h ?? 128;
  const c = cvs(w, h);
  const g = c.getContext("2d")!;
  g.fillStyle = o.bg ?? "#fff";
  g.fillRect(0, 0, w, h);
  if (o.border) {
    g.strokeStyle = o.border;
    g.lineWidth = h * 0.07;
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = o.fg ?? "#000";
  const lines = text.split("\n");
  const fs = (h * (o.sub ? 0.55 : 0.7)) / lines.length;
  g.font = `900 ${fs}px ${o.font ?? "Arial Black, Impact, sans-serif"}`;
  lines.forEach((l, i) => g.fillText(l, w / 2, h * (o.sub ? 0.4 : 0.52) + (i - (lines.length - 1) / 2) * fs * 1.05, w * 0.94));
  if (o.sub) {
    g.fillStyle = o.subColor ?? o.fg ?? "#000";
    g.font = `800 ${h * 0.2}px Arial, sans-serif`;
    g.fillText(o.sub, w / 2, h * 0.82, w * 0.92);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function M(kind: string, c1 = "#999999", c2 = "#444444", rough = 0.9): THREE.MeshStandardMaterial {
  const key = `${kind}|${c1}|${c2}|${rough}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: tex(kind, c1, c2), roughness: rough, metalness: kind === "metal" ? 0.4 : 0 });
    matCache.set(key, m);
  }
  return m;
}
export function F(color: string, rough = 0.75, metal = 0): THREE.MeshStandardMaterial {
  const key = `F|${color}|${rough}|${metal}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    matCache.set(key, m);
  }
  return m;
}
export function G(color: string, intensity = 1.2): THREE.MeshStandardMaterial {
  const key = `G|${color}|${intensity}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
    matCache.set(key, m);
  }
  return m;
}
export function glass(color = "#7dd3fc", opacity = 0.35) {
  const key = `glass|${color}|${opacity}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.1, metalness: 0.2, transparent: true, opacity, emissive: color, emissiveIntensity: 0.25 });
    matCache.set(key, m);
  }
  return m;
}

/* ============ CONSTRUCTOR DE MAPAS ============ */
export interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
export interface RampC { x0: number; x1: number; z0: number; z1: number; axis: "x" | "z"; sign: 1 | -1; h: number }
export interface Nav { cell: number; x0: number; z0: number; w: number; d: number; pass: Uint8Array }

export interface MapData {
  group: THREE.Group;
  boxes: Box[];
  ramps: RampC[];
  rayMeshes: THREE.Object3D[];
  updaters: ((t: number, dt: number) => void)[];
  spawns: [number, number][][]; // [team][idx] => [x,z]
  bounds: { x: number; z: number };
  nav: Nav;
  sky: { top: string; mid: string; bottom: string; fog: string; fogNear: number; fogFar: number; sun: string; sunPos: [number, number, number]; sunI: number; hemiSky: string; hemiGround: string; hemiI: number };
}

export type Dir = "+x" | "-x" | "+z" | "-z";
export const flipDir = (d: Dir): Dir => (d === "+z" ? "-z" : d === "-z" ? "+z" : d);

function boxGeo(w: number, h: number, d: number, tile: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  return g;
}

interface BoxOpts { collide?: boolean; ray?: boolean; cast?: boolean; receive?: boolean; tile?: number }

export class MapBuilder {
  group = new THREE.Group();
  boxes: Box[] = [];
  ramps: RampC[] = [];
  rayMeshes: THREE.Object3D[] = [];
  updaters: ((t: number, dt: number) => void)[] = [];
  spawns: [number, number][][] = [[], []];
  bounds = { x: 30, z: 24 };

  /** Caja: (x,z) centro, y base. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], o: BoxOpts = {}) {
    const m = new THREE.Mesh(boxGeo(w, h, d, o.tile ?? 2), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = o.cast ?? true;
    m.receiveShadow = o.receive ?? true;
    this.group.add(m);
    const col = o.collide ?? true;
    if (col) this.boxes.push({ x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h, z0: z - d / 2, z1: z + d / 2 });
    if (col || o.ray) this.rayMeshes.push(m);
    return m;
  }
  /** Cilindro visual con colider de caja opcional. */
  cyl(x: number, y: number, z: number, rt: number, rb: number, h: number, mat: THREE.Material, collide = true, seg = 20) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    if (collide) {
      const r = Math.max(rt, rb) * 0.85;
      this.boxes.push({ x0: x - r, x1: x + r, y0: y, y1: y + h, z0: z - r, z1: z + r });
      this.rayMeshes.push(m);
    }
    return m;
  }
  /** Plano horizontal decorativo (líneas, calcomanías). */
  decal(x: number, y: number, z: number, w: number, d: number, mat: THREE.Material) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }
  /** Letrero vertical. rotY=0 mira a +z. */
  sign(x: number, y: number, z: number, w: number, h: number, t: THREE.Texture, rotY = 0, emissive = true) {
    const mat = new THREE.MeshStandardMaterial({ map: t, emissiveMap: emissive ? t : null, emissive: emissive ? "#ffffff" : "#000000", emissiveIntensity: emissive ? 0.8 : 0, roughness: 0.6, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.group.add(m);
    return m;
  }
  /** Rampa: centro (cx,cz), tamaño sx*sz, sube hasta h en la dirección dir. */
  ramp(cx: number, cz: number, sx: number, sz: number, h: number, dir: Dir, mat: THREE.Material) {
    const axis = dir[1] as "x" | "z";
    const sign = dir[0] === "+" ? 1 : -1;
    const L = axis === "x" ? sx : sz;
    const W = axis === "x" ? sz : sx;
    const shape = new THREE.Shape();
    shape.moveTo(-L / 2, 0);
    shape.lineTo(L / 2, 0);
    shape.lineTo(L / 2, h);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false });
    geo.translate(0, 0, -W / 2);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    if (dir === "-x") geo.scale(-1, 1, 1);
    if (dir === "+z") geo.rotateY(-Math.PI / 2);
    if (dir === "-z") geo.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geo, Array.isArray(mat) ? mat : mat.clone());
    (m.material as THREE.Material).side = THREE.DoubleSide;
    m.position.set(cx, 0, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    this.rayMeshes.push(m);
    this.ramps.push({ x0: cx - sx / 2, x1: cx + sx / 2, z0: cz - sz / 2, z1: cz + sz / 2, axis, sign: sign as 1 | -1, h });
    return m;
  }
  /** Escalera de peldaños de 0.5m. */
  stairs(x: number, z: number, dir: Dir, n: number, w: number, mat: THREE.Material, run = 0.8) {
    const axis = dir[1];
    const sg = dir[0] === "+" ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const off = (i + 0.5) * run * sg;
      const cx = axis === "x" ? x + off : x;
      const cz = axis === "z" ? z + off : z;
      // cada peldaño llega hasta el suelo (sólido)
      this.box(cx, 0, cz, axis === "x" ? run : w, (i + 1) * 0.5, axis === "x" ? w : run, mat, { tile: 2 });
    }
  }
  mz(fn: (s: 1 | -1) => void) {
    fn(1);
    fn(-1);
  }
  add<T extends THREE.Object3D>(o: T) {
    this.group.add(o);
    return o;
  }
  finish(sky: MapData["sky"]): MapData {
    const data: MapData = { group: this.group, boxes: this.boxes, ramps: this.ramps, rayMeshes: this.rayMeshes, updaters: this.updaters, spawns: this.spawns, bounds: this.bounds, sky, nav: undefined as unknown as Nav };
    data.nav = buildNav(data);
    return data;
  }
}

/* ============ FÍSICA ============ */
export const STEP = 0.56;
export const GRAV = 29;

export function rampH(r: RampC, x: number, z: number) {
  if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) return -1;
  let t = r.axis === "x" ? (x - r.x0) / (r.x1 - r.x0) : (z - r.z0) / (r.z1 - r.z0);
  if (r.sign < 0) t = 1 - t;
  return t * r.h;
}

export function blocked(m: MapData, x: number, z: number, feet: number, rad = 0.38, height = 1.7) {
  for (const b of m.boxes) {
    if (x + rad > b.x0 && x - rad < b.x1 && z + rad > b.z0 && z - rad < b.z1 && b.y1 > feet + STEP && b.y0 < feet + height) return true;
  }
  for (const r of m.ramps) {
    if (x + rad < r.x0 || x - rad > r.x1 || z + rad < r.z0 || z - rad > r.z1) continue;
    const cx = Math.min(r.x1, Math.max(r.x0, x)), cz = Math.min(r.z1, Math.max(r.z0, z));
    // punto más alto dentro de la huella
    const hx = r.axis === "x" ? (r.sign > 0 ? Math.min(r.x1, x + rad) : Math.max(r.x0, x - rad)) : cx;
    const hz = r.axis === "z" ? (r.sign > 0 ? Math.min(r.z1, z + rad) : Math.max(r.z0, z - rad)) : cz;
    if (rampH(r, hx, hz) > feet + STEP) return true;
  }
  return false;
}

export function groundAt(m: MapData, x: number, z: number, feet: number, rad = 0.3) {
  let gh = 0;
  for (const b of m.boxes) {
    if (x + rad > b.x0 && x - rad < b.x1 && z + rad > b.z0 && z - rad < b.z1 && b.y1 <= feet + STEP && b.y1 > gh) gh = b.y1;
  }
  for (const r of m.ramps) {
    const h = rampH(r, x, z);
    if (h >= 0 && h <= feet + STEP && h > gh) gh = h;
  }
  return gh;
}

export interface Body { x: number; y: number; z: number; vx: number; vy: number; vz: number; onGround: boolean }

export function stepBody(m: MapData, b: Body, dt: number, height = 1.75) {
  const rad = 0.38;
  const nx = b.x + b.vx * dt;
  if (!blocked(m, nx, b.z, b.y, rad, height)) b.x = nx;
  else b.vx = 0;
  const nz = b.z + b.vz * dt;
  if (!blocked(m, b.x, nz, b.y, rad, height)) b.z = nz;
  else b.vz = 0;
  b.x = Math.max(-m.bounds.x + 0.5, Math.min(m.bounds.x - 0.5, b.x));
  b.z = Math.max(-m.bounds.z + 0.5, Math.min(m.bounds.z - 0.5, b.z));
  const was = b.onGround;
  b.vy -= GRAV * dt;
  let ny = b.y + b.vy * dt;
  const gh = groundAt(m, b.x, b.z, b.y);
  if (b.vy <= 0 && (ny <= gh + 0.001 || (was && b.y - gh < 0.45 && b.y >= gh - 0.001))) {
    b.y = gh;
    b.vy = 0;
    b.onGround = true;
  } else {
    if (b.vy > 0) {
      for (const bx of m.boxes) {
        if (b.x + rad > bx.x0 && b.x - rad < bx.x1 && b.z + rad > bx.z0 && b.z - rad < bx.z1 && bx.y0 >= b.y + height - 0.1 && bx.y0 < ny + height) {
          ny = bx.y0 - height;
          b.vy = 0;
        }
      }
    }
    b.y = ny;
    b.onGround = false;
  }
  if (b.y < -30) { b.y = 5; b.vy = 0; }
}

/* ============ NAVEGACIÓN PARA BOTS ============ */
function buildNav(m: MapData): Nav {
  const cell = 1;
  const x0 = -m.bounds.x, z0 = -m.bounds.z;
  const w = Math.ceil((m.bounds.x * 2) / cell), d = Math.ceil((m.bounds.z * 2) / cell);
  const pass = new Uint8Array(w * d);
  for (let j = 0; j < d; j++)
    for (let i = 0; i < w; i++) pass[j * w + i] = blocked(m, x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell, 0, 0.5, 1.7) ? 0 : 1;
  return { cell, x0, z0, w, d, pass };
}
const cellOf = (n: Nav, x: number, z: number): [number, number] => [Math.max(0, Math.min(n.w - 1, Math.floor((x - n.x0) / n.cell))), Math.max(0, Math.min(n.d - 1, Math.floor((z - n.z0) / n.cell)))];

export function flowField(n: Nav, tx: number, tz: number) {
  const dist = new Int16Array(n.w * n.d).fill(-1);
  let [ci, cj] = cellOf(n, tx, tz);
  if (!n.pass[cj * n.w + ci]) {
    let best = 1e9;
    for (let r = 1; r < 10; r++)
      for (let j = -r; j <= r; j++)
        for (let i = -r; i <= r; i++) {
          const a = ci + i, b = cj + j;
          if (a < 0 || b < 0 || a >= n.w || b >= n.d || !n.pass[b * n.w + a]) continue;
          const dd = i * i + j * j;
          if (dd < best) { best = dd; var_set(a, b); }
        }
  }
  function var_set(a: number, b: number) { ci = a; cj = b; }
  const q: number[] = [cj * n.w + ci];
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    const i = cur % n.w, j = (cur / n.w) | 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= n.w || b >= n.d) continue;
        const idx = b * n.w + a;
        if (dist[idx] >= 0 || !n.pass[idx]) continue;
        if (di && dj && (!n.pass[j * n.w + a] || !n.pass[b * n.w + i])) continue;
        dist[idx] = dist[cur] + 1;
        q.push(idx);
      }
  }
  return dist;
}

export function nextWaypoint(n: Nav, dist: Int16Array, x: number, z: number): [number, number] | null {
  const [i, j] = cellOf(n, x, z);
  let best = dist[j * n.w + i] >= 0 ? dist[j * n.w + i] : 1e9;
  let bi = -1, bj = -1;
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= n.w || b >= n.d) continue;
      const dd = dist[b * n.w + a];
      if (dd < 0) continue;
      if (di && dj && (!n.pass[j * n.w + a] || !n.pass[b * n.w + i])) continue;
      if (dd < best) { best = dd; bi = a; bj = b; }
    }
  if (bi < 0) return null;
  return [n.x0 + (bi + 0.5) * n.cell, n.z0 + (bj + 0.5) * n.cell];
}

/* ============ CIELO Y UTILIDADES ============ */
export function makeSky(top: string, mid: string, bottom: string) {
  const geo = new THREE.SphereGeometry(500, 24, 16);
  const cols: number[] = [];
  const ct = new THREE.Color(top), cm = new THREE.Color(mid), cb = new THREE.Color(bottom);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 500;
    const c = y > 0.25 ? cm.clone().lerp(ct, Math.min(1, (y - 0.25) / 0.6)) : cb.clone().lerp(cm, Math.max(0, (y + 0.15) / 0.4));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10;
  return m;
}

let cloudTex: THREE.CanvasTexture | null = null;
export function makeClouds(n: number, color = "#ffffff", opacity = 0.85) {
  if (!cloudTex) {
    const c = cvs(256, 128);
    const g = c.getContext("2d")!;
    for (let i = 0; i < 14; i++) {
      const x = 50 + Math.random() * 156, y = 50 + Math.random() * 30, r = 18 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,0.9)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 128);
    }
    cloudTex = new THREE.CanvasTexture(c);
  }
  const grp = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity, color, depthWrite: false, fog: false });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), mat);
    const a = Math.random() * Math.PI * 2, r = 100 + Math.random() * 250;
    m.position.set(Math.cos(a) * r, 110 + Math.random() * 60, Math.sin(a) * r);
    m.rotation.x = Math.PI / 2;
    grp.add(m);
  }
  return grp;
}

/** Edificios decorativos alrededor de la arena. */
export function skyline(b: MapBuilder, colors: string[], seed = 5) {
  const r = rnd(seed);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    const rx = 62 + r() * 28, rz = 54 + r() * 24;
    const h = 8 + r() * 26;
    const w = 8 + r() * 10;
    const col = colors[Math.floor(r() * colors.length)];
    const m = b.box(Math.cos(a) * rx, 0, Math.sin(a) * rz, w, h, w, M("plaster", col), { collide: false, tile: 4 });
    m.castShadow = false;
    // ventanas
    b.box(Math.cos(a) * rx, h * 0.3, Math.sin(a) * rz, w + 0.1, h * 0.5, w + 0.1, G("#fde68a", 0.25), { collide: false, cast: false });
  }
}

/** Muro perimetral. */
export function perimeter(b: MapBuilder, mat: THREE.Material, h = 4, capMat?: THREE.Material) {
  const { x, z } = b.bounds;
  b.box(0, 0, -z - 0.5, x * 2 + 2, h, 1, mat, { tile: 4 });
  b.box(0, 0, z + 0.5, x * 2 + 2, h, 1, mat, { tile: 4 });
  b.box(-x - 0.5, 0, 0, 1, h, z * 2, mat, { tile: 4 });
  b.box(x + 0.5, 0, 0, 1, h, z * 2, mat, { tile: 4 });
  if (capMat) {
    b.box(0, h, -z - 0.5, x * 2 + 2.4, 0.4, 1.4, capMat, { collide: false });
    b.box(0, h, z + 0.5, x * 2 + 2.4, 0.4, 1.4, capMat, { collide: false });
    b.box(-x - 0.5, h, 0, 1.4, 0.4, z * 2 + 1, capMat, { collide: false });
    b.box(x + 0.5, h, 0, 1.4, 0.4, z * 2 + 1, capMat, { collide: false });
  }
  // techo invisible para evitar saltar el muro
  b.box(0, h, -z - 0.5, x * 2 + 2, 30, 1, F("#000000"), { cast: false, receive: false }).visible = false;
  b.box(0, h, z + 0.5, x * 2 + 2, 30, 1, F("#000000"), { cast: false, receive: false }).visible = false;
  b.box(-x - 0.5, h, 0, 1, 30, z * 2, F("#000000"), { cast: false, receive: false }).visible = false;
  b.box(x + 0.5, h, 0, 1, 30, z * 2, F("#000000"), { cast: false, receive: false }).visible = false;
}

export function ground(b: MapBuilder, mat: THREE.Material, w = 400, d = 400) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  const uv = m.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 2, (uv.getY(i) * d) / 2);
  b.group.add(m);
  b.rayMeshes.push(m);
  return m;
}

/* ============ PROPS COMUNES ============ */
export function car(b: MapBuilder, x: number, z: number, alongX: boolean, color: string, kind: "sedan" | "van" | "pickup" = "sedan") {
  const g = new THREE.Group();
  const L = kind === "van" ? 4.6 : 4.3, W = 1.9;
  const bodyH = kind === "van" ? 1.7 : 0.8;
  const mk = (w: number, h: number, d: number, mat: THREE.Material, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  mk(L, bodyH, W, F(color, 0.35, 0.3), 0, 0.35 + bodyH / 2, 0);
  if (kind === "sedan") {
    mk(2.2, 0.62, W - 0.12, F(color, 0.35, 0.3), -0.1, 0.35 + bodyH + 0.31, 0);
    mk(2.25, 0.5, W - 0.05, glass("#1e293b", 0.85), -0.1, 0.35 + bodyH + 0.3, 0);
  } else if (kind === "pickup") {
    mk(1.6, 0.62, W - 0.12, F(color, 0.35, 0.3), 0.6, 0.35 + bodyH + 0.31, 0);
    mk(1.65, 0.5, W - 0.05, glass("#1e293b", 0.85), 0.6, 0.35 + bodyH + 0.3, 0);
  } else {
    mk(1.4, 0.7, W - 0.05, glass("#1e293b", 0.85), 1.6, 1.7, 0);
  }
  mk(L + 0.1, 0.18, W + 0.05, F("#111827"), 0, 0.3, 0);
  for (const sx of [-1.4, 1.4])
    for (const sz of [-0.95, 0.95]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14), F("#111111", 0.9));
      w.rotation.x = Math.PI / 2;
      w.position.set(sx, 0.38, sz);
      w.castShadow = true;
      g.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10), F("#d1d5db", 0.3, 0.8));
      hub.rotation.x = Math.PI / 2;
      hub.position.set(sx, 0.38, sz);
      g.add(hub);
    }
  mk(0.06, 0.18, 0.4, G("#fef9c3", 1.5), L / 2, 0.75, 0.6);
  mk(0.06, 0.18, 0.4, G("#fef9c3", 1.5), L / 2, 0.75, -0.6);
  mk(0.06, 0.18, 0.4, G("#ef4444", 1.5), -L / 2, 0.75, 0.6);
  mk(0.06, 0.18, 0.4, G("#ef4444", 1.5), -L / 2, 0.75, -0.6);
  g.position.set(x, 0, z);
  if (!alongX) g.rotation.y = Math.PI / 2;
  b.add(g);
  const hx = alongX ? L / 2 : W / 2, hz = alongX ? W / 2 : L / 2;
  const top = 0.35 + bodyH + (kind === "van" ? 0 : 0.62);
  b.boxes.push({ x0: x - hx, x1: x + hx, y0: 0, y1: top, z0: z - hz, z1: z + hz });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, top, hz * 2), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(x, top / 2, z);
  b.add(hit);
  b.rayMeshes.push(hit);
}

export function lightPole(b: MapBuilder, x: number, z: number, h = 7, color = "#fde68a") {
  b.cyl(x, 0, z, 0.1, 0.16, h, F("#374151", 0.5, 0.5), true, 8);
  b.box(x, h - 0.1, z, 1.6, 0.12, 0.12, F("#374151"), { collide: false });
  b.box(x + 0.7, h - 0.2, z, 0.5, 0.12, 0.3, G(color, 2), { collide: false });
  b.box(x - 0.7, h - 0.2, z, 0.5, 0.12, 0.3, G(color, 2), { collide: false });
}

export function barrel(b: MapBuilder, x: number, z: number, color: string) {
  const m = b.cyl(x, 0, z, 0.42, 0.42, 1.0, F(color, 0.4, 0.6), true, 14);
  for (const y of [0.25, 0.75]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.025, 6, 16), F("#111827", 0.5, 0.7));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, z);
    b.add(ring);
  }
  return m;
}

export function bannerString(b: MapBuilder, x0: number, z0: number, x1: number, z1: number, y: number, n: number) {
  const cols = ["#16a34a", "#f8fafc", "#dc2626", "#f59e0b", "#ec4899", "#38bdf8"];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    const sag = Math.sin(t * Math.PI) * 0.8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.45), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, roughness: 0.9 }));
    m.position.set(x, y - sag - 0.25, z);
    m.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
    b.add(m);
  }
  const len = Math.hypot(x1 - x0, z1 - z0);
  const s = b.box((x0 + x1) / 2, y - 0.4, (z0 + z1) / 2, 0.02, 0.02, len, F("#fef3c7"), { collide: false, cast: false });
  s.rotation.y = Math.atan2(x1 - x0, z1 - z0) - Math.atan2(0, 1);
  s.rotation.y = Math.atan2(x1 - x0, z1 - z0) * 1 - 0;
  s.position.y = y - 0.4;
  s.geometry.dispose();
  s.geometry = new THREE.BoxGeometry(0.03, 0.03, len);
}
