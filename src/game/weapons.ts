import * as THREE from "three";
import type { WeaponId } from "./shared";

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, metal = 0.5, rough = 0.45, emissive?: string) {
  const k = `${color}|${metal}|${rough}|${emissive}`;
  let m = mats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness: metal * 0.6, roughness: rough, emissive: emissive ?? "#000000", emissiveIntensity: emissive ? 1.2 : 0 });
    mats.set(k, m);
  }
  return m;
}

export interface WeaponModel {
  group: THREE.Group;
  muzzle: THREE.Object3D;
  mag?: THREE.Object3D;
  parts: THREE.Mesh[];
}

export function buildWeaponModel(id: WeaponId, accent = "#22c55e"): WeaponModel {
  const g = new THREE.Group();
  const parts: THREE.Mesh[] = [];
  const dark = mat("#2a2f38", 0.7, 0.4), mid = mat("#4b5563", 0.6, 0.45), light = mat("#9ca3af", 0.9, 0.25);
  const wood = mat("#8b5a2b", 0.05, 0.8), acc = mat(accent, 0.3, 0.4, accent);
  const bx = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = true;
    g.add(mesh);
    parts.push(mesh);
    return mesh;
  };
  const cy = (r: number, len: number, m: THREE.Material, x: number, y: number, z: number, axis: "z" | "y" = "z") => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m);
    if (axis === "z") mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    parts.push(mesh);
    return mesh;
  };
  const muzzle = new THREE.Object3D();
  let mag: THREE.Object3D | undefined;

  switch (id) {
    case "rifle":
      bx(0.07, 0.1, 0.4, dark, 0, 0, -0.1);
      bx(0.06, 0.07, 0.24, mid, 0, -0.005, -0.4);
      cy(0.014, 0.3, light, 0, 0.012, -0.66);
      cy(0.022, 0.06, dark, 0, 0.012, -0.8);
      bx(0.05, 0.1, 0.24, dark, 0, -0.015, 0.26);
      bx(0.052, 0.012, 0.12, acc, 0, 0.05, -0.08);
      bx(0.03, 0.04, 0.14, mid, 0, 0.075, -0.12);
      bx(0.012, 0.03, 0.012, light, 0, 0.1, -0.2);
      mag = bx(0.042, 0.17, 0.075, mid, 0, -0.13, -0.12, 0.15);
      bx(0.04, 0.1, 0.05, dark, 0, -0.09, 0.08, -0.3);
      bx(0.01, 0.03, 0.2, acc, 0.036, 0, -0.1);
      muzzle.position.set(0, 0.012, -0.84);
      break;
    case "sniper":
      bx(0.06, 0.09, 0.5, dark, 0, 0, -0.05);
      cy(0.012, 0.75, light, 0, 0.012, -0.68);
      cy(0.02, 0.1, dark, 0, 0.012, -1.08);
      bx(0.055, 0.12, 0.3, wood, 0, -0.02, 0.38);
      cy(0.032, 0.26, dark, 0, 0.09, -0.1);
      cy(0.04, 0.05, mid, 0, 0.09, -0.24);
      cy(0.04, 0.05, mid, 0, 0.09, 0.04);
      bx(0.03, 0.04, 0.03, mid, 0, 0.06, -0.1);
      mag = bx(0.04, 0.09, 0.1, mid, 0, -0.08, -0.04);
      bx(0.012, 0.012, 0.1, acc, 0.033, 0.0, -0.05);
      bx(0.04, 0.09, 0.05, wood, 0, -0.08, 0.14, -0.3);
      muzzle.position.set(0, 0.012, -1.14);
      break;
    case "shotgun":
      bx(0.07, 0.09, 0.28, dark, 0, 0, -0.04);
      cy(0.022, 0.62, light, 0, 0.02, -0.46);
      cy(0.018, 0.5, mid, 0, -0.022, -0.4);
      bx(0.075, 0.06, 0.2, wood, 0, -0.03, -0.36);
      bx(0.06, 0.1, 0.3, wood, 0, -0.025, 0.24, 0.06);
      bx(0.012, 0.012, 0.28, acc, 0.04, 0.02, -0.04);
      bx(0.04, 0.09, 0.05, dark, 0, -0.085, 0.06, -0.3);
      cy(0.012, 0.02, acc, 0, 0.055, -0.74);
      muzzle.position.set(0, 0.02, -0.78);
      break;
    case "revolver":
      bx(0.05, 0.07, 0.16, dark, 0, 0, -0.02);
      cy(0.04, 0.09, mid, 0, 0.0, -0.1, "z");
      cy(0.012, 0.22, light, 0, 0.025, -0.25);
      bx(0.02, 0.025, 0.02, acc, 0, 0.055, -0.34);
      bx(0.05, 0.12, 0.06, wood, 0, -0.09, 0.07, -0.35);
      bx(0.012, 0.03, 0.05, acc, 0.028, 0.03, -0.02);
      mag = g.children[1];
      muzzle.position.set(0, 0.025, -0.37);
      break;
    case "uzi":
      bx(0.06, 0.1, 0.26, dark, 0, 0, -0.05);
      cy(0.012, 0.14, light, 0, 0.02, -0.25);
      bx(0.045, 0.05, 0.12, mid, 0, -0.01, -0.2);
      mag = bx(0.036, 0.2, 0.05, mid, 0, -0.15, 0.0);
      bx(0.04, 0.09, 0.05, dark, 0, -0.08, 0.08, -0.25);
      bx(0.012, 0.012, 0.24, acc, 0.034, 0.02, -0.05);
      bx(0.012, 0.05, 0.2, light, 0, 0.0, 0.2);
      bx(0.04, 0.012, 0.012, light, 0, -0.03, 0.3);
      muzzle.position.set(0, 0.02, -0.34);
      break;
    case "katana": {
      cy(0.014, 0.3, mat("#7f1d1d", 0.1, 0.7), 0, 0, 0.05);
      bx(0.034, 0.034, 0.04, mat("#111827"), 0, 0, 0.05);
      bx(0.012, 0.045, 0.82, mat("#e5e7eb", 1, 0.12), 0, 0, -0.52);
      bx(0.004, 0.012, 0.82, acc, 0, 0.02, -0.52);
      cy(0.045, 0.012, mat("#facc15", 0.9, 0.3), 0, 0, -0.11, "z");
      muzzle.position.set(0, 0, -0.9);
      break;
    }
    case "machete":
      cy(0.016, 0.22, mat("#111827", 0.1, 0.7), 0, 0, 0.03);
      bx(0.014, 0.09, 0.5, mat("#cbd5e1", 0.9, 0.25), 0, 0.02, -0.36);
      bx(0.014, 0.03, 0.5, mat("#64748b", 0.9, 0.3), 0, -0.035, -0.36);
      bx(0.006, 0.012, 0.5, acc, 0.01, 0.0, -0.36);
      bx(0.02, 0.05, 0.02, mat("#facc15"), 0, 0, -0.1);
      muzzle.position.set(0, 0, -0.62);
      break;
  }
  g.add(muzzle);
  return { group: g, muzzle, mag, parts };
}
