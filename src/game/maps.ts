import * as THREE from "three";
import { F, G, M, MapBuilder, type MapData, bannerString, barrel, car, glass, ground, lightPole, perimeter, signTex, skyline, flipDir } from "./mapkit";

function spawnsFor(b: MapBuilder, z = 21) {
  const xs = [-6, -2, 2, 6];
  b.spawns[0] = xs.map((x) => [x, -z]);
  b.spawns[1] = xs.map((x) => [x, z]);
  for (const t of [0, 1]) for (const [x, sz] of b.spawns[t]) {
    b.decal(x, 0.04, sz, 2.2, 2.2, G(t === 0 ? "#22c55e" : "#ef4444", 0.6));
  }
}

function turfDecal(b: MapBuilder, x: number, z: number, w: number, d: number) {
  const m = b.decal(x, 0.03, z, w, d, M("turf", "#22a04a", "#1b8a3e", 0.95));
  const uv = m.geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 4, (uv.getY(i) * d) / 4);
}

function crate(b: MapBuilder, x: number, z: number, s = 1.2, y = 0) {
  b.box(x, y, z, s, s, s, M("wood", "#a16207"), { tile: 1.2 });
}

/* ===================== MAPA 1: EL OXXO DE LA ESQUINA ===================== */
export function buildOxxo(): MapData {
  const b = new MapBuilder();
  ground(b, M("asphalt", "#4b4e57", "#222"));
  const white = F("#f8fafc", 0.9);
  // cajones de estacionamiento
  b.mz((s) => {
    for (let i = 0; i < 9; i++) b.decal(-8 + i * 3.6, 0.03, 17 * s, 0.14, 5, white);
    b.decal(12, 0.03, 14.5 * s, 25.2, 0.14, white);
    b.decal(-8, 0.03, 8 * s, 0.4, 3, F("#facc15"));
  });
  b.decal(0, 0.03, 0, 0.2, 48, F("#facc15", 0.9)); // línea central amarilla

  // ----- Tienda OXXO (lado izquierdo) -----
  b.box(-25.5, 0, 0, 9, 5, 24, M("plaster", "#f1f5f9"), { tile: 3 });
  b.box(-20.93, 0, 0, 0.14, 0.5, 24, F("#374151"), { collide: false });
  b.box(-20.93, 3.7, 0, 0.14, 0.9, 24, F("#dc2626", 0.5), { collide: false });
  b.box(-20.93, 4.6, 0, 0.14, 0.4, 24, F("#facc15", 0.5), { collide: false });
  // vitrina iluminada
  b.box(-20.85, 0.7, 0, 0.12, 2.6, 15, glass("#bae6fd", 0.35));
  b.box(-21.6, 0.7, 0, 0.1, 2.6, 15, G("#fffbe0", 0.7), { collide: false, cast: false });
  b.box(-21.3, 0, 0, 0.4, 0.7, 15, F("#334155"), { collide: false });
  // puerta
  b.box(-20.78, 0, 4, 0.1, 2.5, 2.4, glass("#e0f2fe", 0.25), { collide: false });
  // letrero OXXO grande en el techo
  b.box(-21.8, 5, 0, 0.5, 2.5, 9.6, F("#b91c1c"), {});
  b.sign(-21.5, 6.25, 0, 9.2, 2.3, signTex("OXXO", { bg: "#dc2626", fg: "#facc15", w: 1024, h: 256, border: "#facc15" }), Math.PI / 2);
  b.sign(-22.1, 6.25, 0, 9.2, 2.3, signTex("OXXO", { bg: "#dc2626", fg: "#facc15", w: 1024, h: 256, border: "#facc15" }), -Math.PI / 2);
  // letrero en fachada
  b.sign(-20.7, 3.5, -9, 5, 1.2, signTex("24 HORAS", { bg: "#facc15", fg: "#dc2626", w: 512, h: 128 }), Math.PI / 2);
  b.sign(-20.7, 3.5, 9, 5, 1.2, signTex("24 HORAS", { bg: "#facc15", fg: "#dc2626", w: 512, h: 128 }), Math.PI / 2);
  b.sign(-20.68, 2.0, 4, 2.2, 0.9, signTex("SEGUNDA CAJA\nCERRADA", { bg: "#fde047", fg: "#111827", w: 512, h: 220, border: "#dc2626" }), Math.PI / 2);
  // caballete "segunda caja cerrada"
  const cab = signTex("SEGUNDA CAJA\nCERRADA", { bg: "#facc15", fg: "#111827", w: 512, h: 300, border: "#dc2626" });
  b.box(-18.2, 0, 0, 0.25, 1.15, 1.5, F("#fde047", 0.6), {});
  b.sign(-18.05, 0.62, 0, 1.4, 1.0, cab, Math.PI / 2, false);
  b.sign(-18.35, 0.62, 0, 1.4, 1.0, cab, -Math.PI / 2, false);
  // parapetos del techo
  const par = M("concrete", "#e5e7eb");
  b.box(-29.85, 5, 0, 0.3, 0.9, 24, par);
  b.mz((s) => {
    b.box(-25.5, 5, 11.85 * s, 9, 0.9, 0.3, par);
    b.box(-21.15, 5, 10.5 * s, 0.3, 0.9, 3, par);
    b.box(-26, 5, 5 * s, 2.2, 1, 2, M("metal", "#cbd5e1"));
    b.box(-24, 5, 8 * s, 2.2, 1, 2, M("metal", "#94a3b8"));
  });
  b.box(-21.15, 5, 0, 0.3, 0.9, 0.01, par, { collide: false });
  // rampas al techo
  b.mz((s) => b.ramp(-15, 7 * s, 12, 4, 5, "-x", M("concrete", "#9ca3af")));
  b.mz((s) => {
    b.box(-15, 0, 4.9 * s, 12, 0.5, 0.15, F("#facc15"), { collide: false });
  });

  // ----- Puesto de tacos (derecha, centro) -----
  const wood = M("wood", "#b45309");
  b.box(24.5, 0, 0, 1.8, 1.15, 5, wood, {});
  b.box(24.5, 1.15, 0, 2, 0.1, 5.2, F("#e5e7eb", 0.3, 0.6), { collide: false });
  b.mz((s) => {
    b.cyl(23.2, 0, 2.5 * s, 0.05, 0.05, 2.7, F("#9ca3af", 0.4, 0.7), false, 8);
    b.cyl(26.3, 0, 2.5 * s, 0.05, 0.05, 2.7, F("#9ca3af", 0.4, 0.7), false, 8);
    b.cyl(20.5, 0, 4.5 * s, 0.32, 0.32, 0.55, F("#dc2626"), true, 12); // bancos
    b.cyl(20.5, 0, -4.5 * s + 0, 0.32, 0.32, 0.55, F("#dc2626"), false, 12);
    crate(b, 21.5, 7.5 * s);
    crate(b, 21.5, 8.8 * s, 1.0);
  });
  b.box(24.8, 2.7, 0, 3.4, 0.12, 5.6, M("stripes", "#ffffff", "#dc2626"), { collide: false, tile: 1.4 });
  const trompo = new THREE.Group();
  const meat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.0, 12), new THREE.MeshStandardMaterial({ color: "#b45309", roughness: 0.8 }));
  meat.castShadow = true;
  trompo.add(meat);
  const pine = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), F("#facc15"));
  pine.position.y = 0.58;
  trompo.add(pine);
  trompo.position.set(24.2, 1.8, 0.8);
  b.add(trompo);
  b.updaters.push((t) => (trompo.rotation.y = t * 1.4));
  b.box(24.4, 1.28, -1.1, 0.5, 0.15, 1.2, F("#16a34a"), { collide: false });
  b.sign(21.9, 2.35, 0, 4.6, 0.8, signTex("TACOS AL PASTOR\n“EL GÜERO”", { bg: "#16a34a", fg: "#ffffff", w: 640, h: 200, border: "#dc2626" }), -Math.PI / 2);

  // ----- Autos de cobertura -----
  b.mz((s) => {
    car(b, -4, 10 * s, true, "#ef4444");
    car(b, 9, 16 * s, false, "#38bdf8", "van");
    car(b, 15, 6.5 * s, true, "#facc15", "pickup");
    car(b, -12, 17 * s, false, "#f8fafc");
    b.box(3.5, 0, 5.5 * s, 3, 0.95, 0.7, M("concrete", "#b8bcc4"), { tile: 1.5 });
    b.box(-9, 0, 4 * s, 0.7, 0.95, 3, M("concrete", "#b8bcc4"), { tile: 1.5 });
    lightPole(b, -15, 12.5 * s);
    lightPole(b, 19, 18 * s);
    lightPole(b, 11, 20 * s);
  });
  car(b, -2, 0, true, "#22c55e");
  car(b, 9, 0, false, "#a855f7", "sedan");
  b.box(-8, 0, 0, 2.5, 1.3, 1.2, F("#16a34a", 0.5, 0.3), {}); // contenedor
  b.box(16, 0, 0, 1.2, 1.0, 1.2, F("#dc2626"), {});

  perimeter(b, M("plaster", "#e7d9b6"), 4, F("#dc2626"));
  skyline(b, ["#f59e0b", "#a78bfa", "#fb7185", "#fdba74", "#c4b5fd"], 3);
  spawnsFor(b);
  return b.finish({ top: "#4c1d95", mid: "#fb923c", bottom: "#fde68a", fog: "#f7a76a", fogNear: 60, fogFar: 230, sun: "#ffb066", sunPos: [-45, 28, 25], sunI: 2.6, hemiSky: "#ffd2a8", hemiGround: "#6b4a3a", hemiI: 1.0 });
}

/* ===================== MAPA 2: GASOLINERA PEMEX ===================== */
export function buildPemex(): MapData {
  const b = new MapBuilder();
  ground(b, M("concrete", "#a7acb4"));
  const green = F("#15803d", 0.5), red = F("#dc2626", 0.5), white = F("#f8fafc", 0.5);
  b.mz((s) => {
    for (let i = -5; i <= 5; i++) b.decal(i * 4.5, 0.03, 15 * s, 0.14, 4, F("#facc15"));
  });

  // ----- Techo gigante -----
  b.box(0, 6.2, 0, 26, 0.8, 18, white, {});
  b.mz((s) => {
    b.box(0, 6.6, 9.05 * s, 26.2, 0.4, 0.12, green, { collide: false });
    b.box(0, 6.2, 9.05 * s, 26.2, 0.4, 0.12, red, { collide: false });
    b.box(13.05 * s, 6.6, 0, 0.12, 0.4, 18.2, green, { collide: false });
    b.box(13.05 * s, 6.2, 0, 0.12, 0.4, 18.2, red, { collide: false });
    for (const x of [-9, 9]) {
      b.box(x, 0, 6 * s, 0.9, 6.2, 0.9, white, {});
      b.box(x, 0, 6 * s, 1.0, 0.5, 1.0, F("#facc15"), {});
      b.box(x, 1.2, 6 * s, 0.95, 0.5, 0.95, green, { collide: false });
    }
    b.sign(0, 6.6, 9.13 * s, 9, 1.4, signTex("PEMEX", { bg: "#15803d", fg: "#ffffff", w: 1024, h: 160, border: "#dc2626" }), s === 1 ? 0 : Math.PI);
  });
  for (const x of [-9, -3, 3, 9]) for (const z of [-5, 5]) b.box(x, 6.1, z, 3, 0.06, 1.2, G("#fff7d6", 2.2), { collide: false, cast: false });

  // ----- Islas con bombas -----
  const pump = (x: number, z: number, label: string, color: string) => {
    b.box(x, 0.25, z, 0.75, 1.65, 0.95, white, {});
    b.box(x, 1.9, z, 0.95, 0.35, 1.15, F(color, 0.4), {});
    for (const sgn of [1, -1]) {
      b.sign(x + 0.39 * sgn, 1.35, z, 0.8, 0.5, signTex(label, { bg: color, fg: "#fff", w: 320, h: 200 }), sgn === 1 ? Math.PI / 2 : -Math.PI / 2);
      b.box(x + 0.4 * sgn, 0.7, z + 0.3, 0.12, 0.3, 0.18, F("#111827"), { collide: false });
    }
  };
  for (const [ix, a, c] of [[-5.5, 0, 1], [5.5, 1, 0]] as const) {
    b.box(ix, 0, 0, 1.8, 0.25, 11, M("hazard", "#facc15", "#1f2937"), { tile: 1.5 });
    const labs = [["MAGNA", "#16a34a"], ["PREMIUM", "#dc2626"]];
    pump(ix, -3, labs[a][0], labs[a][1]);
    pump(ix, 3, labs[c][0], labs[c][1]);
  }
  b.box(0, 0, 0, 1.6, 1.2, 1.6, M("wood", "#a16207"), { tile: 1.2 });
  b.box(0, 0, -2.2, 1.0, 0.9, 1.0, F("#0ea5e9", 0.5), {});
  b.box(0, 0, 2.2, 1.0, 0.9, 1.0, F("#0ea5e9", 0.5), {});

  // ----- Pasarela elevada izquierda -----
  const metal = M("metal", "#6b7280");
  b.box(-22, 2.6, 0, 4, 0.4, 20, metal, {});
  b.box(-23.9, 3.0, 0, 0.2, 1.0, 20, M("hazard", "#facc15", "#1f2937"), { tile: 1 });
  b.box(-20.1, 3.0, 0, 0.2, 0.9, 20, M("hazard", "#facc15", "#1f2937"), { tile: 1 });
  b.mz((s) => {
    for (const x of [-23.4, -20.6]) b.box(x, 0, 8.5 * s, 0.4, 2.6, 0.4, F("#4b5563", 0.5, 0.6), {});
    b.ramp(-22, 14.5 * s, 4, 9, 3, s === 1 ? "-z" : "+z", M("concrete", "#9ca3af"));
    barrel(b, -22.8, 17 * s, "#2563eb");
    b.box(-22, 3.0, 5 * s, 1.4, 0.9, 1.0, F("#16a34a", 0.5, 0.2), {});
  });
  b.sign(-27.4, 2.4, 0, 6, 1.0, signTex("PASARELA ▲ PEMEX", { bg: "#1f2937", fg: "#facc15", w: 640, h: 120 }), Math.PI / 2);

  // ----- Taller mecánico abierto (derecha) -----
  b.box(28.5, 0, 0, 1, 4.0, 14.6, M("brick", "#c2410c", "#d6d3d1"), { tile: 3 });
  b.mz((s) => {
    b.box(24, 0, 7 * s, 10, 4.0, 0.6, M("plaster", "#f1f5f9"), { tile: 3 });
    b.box(24, 4.0, 7 * s, 10.2, 0.4, 0.9, red, { collide: false });
    car(b, 24.5, 4.4 * s, true, s === 1 ? "#facc15" : "#38bdf8");
    b.cyl(21.2, 0, 2.2 * s, 0.42, 0.42, 0.9, F("#111111", 0.95), true, 12);
    b.cyl(21.2, 0.9, 2.2 * s, 0.42, 0.42, 0.9, F("#1c1c1c", 0.95), true, 12);
    barrel(b, 27.4, 2.2 * s, "#dc2626");
    b.ramp(24, 11.5 * s, 4, 9, 4.5, s === 1 ? "-z" : "+z", M("concrete", "#9ca3af"));
    b.box(27.5, 0, 0.8 * s, 1.2, 1.0, 2.2, M("wood", "#78350f"), {});
    lightPole(b, 27, 18 * s, 9, "#e0f2fe");
  });
  b.box(24, 4.0, 0, 10, 0.5, 14.6, white, {});
  b.box(24, 0.01, 0, 10, 0.02, 12.8, M("tiles", "#64748b", "#475569"), { collide: false, tile: 3 });
  b.box(24, 4.0, 0, 0.1, 0.01, 0.01, white, { collide: false });
  b.sign(18.9, 3.7, 0, 8, 1.0, signTex("TALLER MECÁNICO", { bg: "#dc2626", fg: "#ffffff", w: 800, h: 130, border: "#facc15" }), -Math.PI / 2);
  b.sign(18.95, 2.7, 0, 4, 0.5, signTex("ABIERTO • LLANTAS • FRENOS", { bg: "#facc15", fg: "#111827", w: 800, h: 100 }), -Math.PI / 2);
  b.box(25, 4.5, 0, 2, 1, 2, M("metal", "#cbd5e1"), {});
  b.box(22, 4.5, 3.5, 1.2, 1.4, 1.2, F("#15803d"), {});
  b.box(22, 4.5, -3.5, 1.2, 1.4, 1.2, F("#15803d"), {});

  // ----- Tambos y varios -----
  b.mz((s) => {
    barrel(b, -11, 12 * s, "#2563eb");
    barrel(b, -12, 13.2 * s, "#dc2626");
    barrel(b, -11.2, 14.3 * s, "#6b7280");
    barrel(b, 12, 12 * s, "#16a34a");
    barrel(b, 11, 13 * s, "#facc15");
    b.box(0, 0, 12 * s, 4, 0.95, 0.7, M("concrete", "#b8bcc4"), { tile: 1.5 });
    b.box(-15, 0, 6 * s, 0.7, 0.95, 3, M("concrete", "#b8bcc4"), { tile: 1.5 });
    b.box(15, 0, 6 * s, 0.7, 0.95, 3, M("concrete", "#b8bcc4"), { tile: 1.5 });
    crate(b, 6, 17.5 * s);
    crate(b, -7, 17.5 * s);
    // poste de precios
    b.cyl(-27, 0, 19 * s, 0.25, 0.3, 9, F("#f1f5f9", 0.5, 0.2), true, 10);
    b.box(-27, 7.2, 19 * s, 0.5, 3.2, 3, white, {});
    b.sign(-26.72, 8.0, 19 * s, 2.8, 1.2, signTex("PEMEX", { bg: "#15803d", fg: "#fff", w: 400, h: 170 }), Math.PI / 2);
    b.sign(-26.72, 6.8, 19 * s, 2.8, 1.2, signTex("MAGNA $23.99\nPREMIUM $25.99", { bg: "#111827", fg: "#fde047", w: 500, h: 220 }), Math.PI / 2);
    lightPole(b, -8, 20 * s, 8, "#e0f2fe");
  });

  perimeter(b, M("plaster", "#f1f5f9"), 3.5, F("#15803d"));
  b.box(0, 3.6, -24.5, 60, 0.3, 0.2, red, { collide: false });
  b.box(0, 3.6, 24.5, 60, 0.3, 0.2, red, { collide: false });
  skyline(b, ["#bae6fd", "#fecaca", "#bbf7d0", "#fef08a", "#e9d5ff"], 8);
  spawnsFor(b);
  return b.finish({ top: "#1d6ff2", mid: "#7cc4ff", bottom: "#e6f4ff", fog: "#cfe8fb", fogNear: 70, fogFar: 260, sun: "#fff4d6", sunPos: [30, 60, 20], sunI: 3.0, hemiSky: "#cfe8ff", hemiGround: "#8a8f98", hemiI: 1.15 });
}

/* ===================== MAPA 3: LA CANCHA DEL BARRIO ===================== */
function tinaco(b: MapBuilder, x: number, y: number, z: number) {
  b.box(x, y, z, 1.4, 0.3, 1.4, F("#475569"), {});
  b.cyl(x, y + 0.3, z, 0.82, 0.92, 1.35, F("#0b1220", 0.35), true, 18);
  b.cyl(x, y + 1.65, z, 0.55, 0.82, 0.22, F("#111827", 0.4), false, 18);
  b.cyl(x, y + 1.87, z, 0.14, 0.14, 0.1, F("#1f2937"), false, 8);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.87, 0.03, 6, 20), F("#1f2937"));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y + 0.9, z);
  b.add(ring);
  const lab = b.sign(x, y + 1.0, z + 0.93, 0.9, 0.3, signTex("ROTOPLAS", { bg: "#0b1220", fg: "#38bdf8", w: 256, h: 80 }), 0, false);
  lab.scale.setScalar(0.9);
}
function gasTank(b: MapBuilder, x: number, y: number, z: number, alongZ: boolean, r = 0.6, len = 2.6) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 18), F("#f1f5f9", 0.35, 0.2));
  body.rotation.x = alongZ ? Math.PI / 2 : 0;
  body.rotation.z = alongZ ? 0 : Math.PI / 2;
  body.castShadow = true;
  g.add(body);
  for (const e of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), F("#f1f5f9", 0.35, 0.2));
    cap.position.set(alongZ ? 0 : (e * len) / 2, 0, alongZ ? (e * len) / 2 : 0);
    g.add(cap);
  }
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.01, 0.4, 18), F("#dc2626"));
  band.rotation.copy(body.rotation);
  g.add(band);
  g.position.set(x, y + r + 0.3, z);
  b.add(g);
  b.box(x, y, z, alongZ ? 0.9 : len * 0.8, 0.3, alongZ ? len * 0.8 : 0.9, F("#475569"), {});
  const hw = alongZ ? r : len / 2 + r, hd = alongZ ? len / 2 + r : r;
  b.boxes.push({ x0: x - hw, x1: x + hw, y0: y + 0.3, y1: y + 0.3 + r * 2, z0: z - hd, z1: z + hd });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, r * 2, hd * 2), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(x, y + 0.3 + r, z);
  b.add(hit);
  b.rayMeshes.push(hit);
}

export function buildCancha(): MapData {
  const b = new MapBuilder();
  ground(b, M("concrete", "#8e929b"));
  turfDecal(b, 0, 0, 26, 38);
  const line = F("#ffffff", 0.9);
  b.decal(0, 0.05, 0, 26, 0.18, line);
  for (const z of [-19, 19]) b.decal(0, 0.05, z, 26.2, 0.18, line);
  for (const x of [-13, 13]) b.decal(x, 0.05, 0, 0.18, 38, line);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.8, 40), line);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  b.add(ring);
  b.mz((s) => {
    b.decal(0, 0.05, 14 * s, 12, 0.18, line);
    b.decal(-6, 0.05, 16.5 * s, 0.18, 5, line);
    b.decal(6, 0.05, 16.5 * s, 0.18, 5, line);
    // portería metálica
    const mt = F("#e5e7eb", 0.3, 0.7);
    for (const x of [-2.6, 2.6]) {
      b.box(x, 0, 17.5 * s, 0.14, 2.2, 0.14, mt, {});
      b.box(x, 0, 19 * s, 0.1, 2.0, 0.1, mt, { collide: false });
      b.box(x, 2.1, 18.25 * s, 0.1, 0.1, 1.5, mt, { collide: false });
    }
    b.box(0, 2.1, 17.5 * s, 5.4, 0.14, 0.14, mt, {});
    b.box(0, 2.0, 19 * s, 5.2, 0.1, 0.1, mt, { collide: false });
    const net = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    b.box(0, 0, 19 * s, 5.2, 2.1, 0.02, net, { collide: false, cast: false });
    b.box(-2.6, 0, 18.25 * s, 0.02, 2.1, 1.5, net, { collide: false, cast: false });
    b.box(2.6, 0, 18.25 * s, 0.02, 2.1, 1.5, net, { collide: false, cast: false });
    b.box(0, 2.1, 18.25 * s, 5.2, 0.02, 1.5, net, { collide: false, cast: false });
  });

  // ----- Casas -----
  const cols = ["#f472b6", "#38bdf8", "#facc15", "#fb923c", "#a3e635", "#c084fc"];
  const house = (sx: 1 | -1, zc: number, d: number, h: number, col: string, brick: boolean, accent: string) => {
    const x = sx * 25;
    b.box(x, 0, zc, 10, h, d, brick ? M("brick", col, "#d6d3d1") : M("plaster", col), { tile: 3 });
    b.box(sx * 19.92, h - 0.6, zc, 0.16, 0.5, d, F(accent, 0.6), { collide: false });
    b.box(sx * 19.92, 0, zc, 0.16, 0.4, d, F("#475569"), { collide: false });
    for (const k of [-1, 1]) {
      b.box(sx * 19.9, 1.0, zc + k * d * 0.3, 0.1, 1.7, 2.4, F("#111827"), { collide: false, cast: false });
      b.box(sx * 19.84, 1.1, zc + k * d * 0.3, 0.12, 1.5, 2.2, glass("#7dd3fc", 0.55), { collide: false, cast: false });
    }
    b.box(sx * 19.9, 0, zc, 0.12, 2.3, 1.5, M("wood", "#78350f"), { collide: false });
    const par = M("concrete", "#d6d3d1");
    b.box(sx * 29.85, h, zc, 0.3, 0.9, d, par);
    b.box(x, h, zc - d / 2 + 0.15, 10, 0.9, 0.3, par);
    b.box(x, h, zc + d / 2 - 0.15, 10, 0.9, 0.3, par);
    tinaco(b, sx * 27.3, h, zc + d * 0.22);
    gasTank(b, sx * 25.5, h, zc - d * 0.22, true);
    b.box(sx * 23.5, h, zc, 0.4, 1.1, 3, M("brick", "#b45309", "#d6d3d1"), { tile: 1.5 });
  };
  b.mz((s) => {
    for (const sx of [-1, 1] as const) {
      const ci = (sx === 1 ? 0 : 3) + (s === 1 ? 0 : 1);
      house(sx, 15.5 * s, 16, 4.5, cols[ci % 6], (ci + 1) % 3 === 0, cols[(ci + 2) % 6]);
      b.stairs(sx * 19, 8 * s, s === 1 ? "+z" : "-z", 9, 2, M("concrete", "#a8a29e"));
      b.sign(sx * 19.8, 2.2, 22 * s, 1.5, 0.5, signTex(sx === 1 ? "TIENDITA" : "LA ESQUINA", { bg: "#dc2626", fg: "#fde047", w: 320, h: 100 }), sx === 1 ? -Math.PI / 2 : Math.PI / 2);
    }
  });
  for (const sx of [-1, 1] as const) {
    house(sx, 0, 14, 4.0, cols[(sx === 1 ? 2 : 5) % 6], sx === 1, cols[(sx === 1 ? 4 : 1) % 6]);
    b.stairs(sx * 19, -6.8, "+z", 8, 2, M("concrete", "#a8a29e"));
    b.stairs(sx * 19, 6.8, "-z", 8, 2, M("concrete", "#a8a29e"));
  }

  // ----- Cobertura en cancha y calle -----
  b.mz((s) => {
    b.ramp(7.5, 6 * s, 4, 4, 1.3, "+x", M("concrete", "#9ca3af"));
    b.ramp(-7.5, 6 * s, 4, 4, 1.3, "-x", M("concrete", "#9ca3af"));
    b.box(9.8, 0, 6 * s, 0.6, 1.3, 4, M("concrete", "#b8bcc4"), { tile: 1.5 });
    b.box(-9.8, 0, 6 * s, 0.6, 1.3, 4, M("concrete", "#b8bcc4"), { tile: 1.5 });
    gasTank(b, 16, 0, 3.5 * s, true, 0.9, 3.4);
    gasTank(b, -16, 0, 3.5 * s, true, 0.9, 3.4);
    b.box(0, 0, 10 * s, 5, 0.95, 0.8, M("wood", "#a16207"), { tile: 1.2 });
    b.box(-4, 0, 13 * s, 1.2, 1.2, 1.2, M("wood", "#a16207"), { tile: 1.2 });
    b.box(4, 0, 13 * s, 1.2, 1.2, 1.2, M("wood", "#a16207"), { tile: 1.2 });
    lightPole(b, 14, 12 * s, 8);
    lightPole(b, -14, 12 * s, 8);
    b.cyl(-17, 0, 10.5 * s, 0.5, 0.5, 1.0, F("#16a34a", 0.5), true, 12);
  });
  b.box(0, 0, 0, 3.2, 1.4, 3.2, M("plaster", "#fde68a"), {});
  b.sign(0, 0.8, 1.62, 2.6, 0.9, signTex("¡VAMOS\nMÉXICO!", { bg: "#16a34a", fg: "#ffffff", w: 400, h: 200, border: "#dc2626" }), 0, false);
  b.sign(0, 0.8, -1.62, 2.6, 0.9, signTex("¡VAMOS\nMÉXICO!", { bg: "#16a34a", fg: "#ffffff", w: 400, h: 200, border: "#dc2626" }), Math.PI, false);

  bannerString(b, -20, -5, 20, -5, 6.2, 18);
  bannerString(b, -20, 5, 20, 5, 6.2, 18);
  bannerString(b, -20, -14, 20, -14, 6.4, 18);
  bannerString(b, -20, 14, 20, 14, 6.4, 18);

  perimeter(b, M("plaster", "#fdba74"), 4, F("#7c3aed"));
  skyline(b, ["#fda4af", "#fcd34d", "#86efac", "#7dd3fc", "#d8b4fe"], 12);
  spawnsFor(b, 22);
  void flipDir;
  return b.finish({ top: "#2f86ff", mid: "#8fd0ff", bottom: "#fff1d6", fog: "#d6ecff", fogNear: 70, fogFar: 260, sun: "#fff1cf", sunPos: [-30, 55, -25], sunI: 3.0, hemiSky: "#d6ecff", hemiGround: "#98938a", hemiI: 1.15 });
}

export function buildMap(id: number): MapData {
  return id === 0 ? buildOxxo() : id === 1 ? buildPemex() : buildCancha();
}
