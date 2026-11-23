import * as THREE from "three";
import { TEAM_COLORS, WEAPONS, type WeaponId } from "./shared";
import { buildWeaponModel } from "./weapons";

const SKINS = ["#f3c9a0", "#d9a273", "#b97c4f", "#8d5a36", "#e8b88a"];
const geoBox = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const mcache = new Map<string, THREE.MeshStandardMaterial>();
const mt = (c: string, r = 0.7) => {
  const k = c + r;
  let m = mcache.get(k);
  if (!m) mcache.set(k, (m = new THREE.MeshStandardMaterial({ color: c, roughness: r })));
  return m;
};

function raySphere(o: THREE.Vector3, d: THREE.Vector3, cx: number, cy: number, cz: number, r: number) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}
function rayCyl(o: THREE.Vector3, d: THREE.Vector3, cx: number, cz: number, r: number, y0: number, y1: number) {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) return null;
  const b = ox * d.x + oz * d.z;
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t < 0) return null;
  const y = o.y + d.y * t;
  return y >= y0 && y <= y1 ? t : null;
}

export class Avatar {
  id: string;
  name: string;
  team: 0 | 1;
  root = new THREE.Group();
  rig = new THREE.Group();
  head: THREE.Mesh;
  armL = new THREE.Group();
  armR = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  hand = new THREE.Group();
  tag: THREE.Sprite;
  tagCanvas: HTMLCanvasElement;
  tagTex: THREE.CanvasTexture;
  weaponId: WeaponId | null = null;
  weaponMesh: THREE.Group | null = null;
  hp = 100;
  alive = true;
  deadT = 0;
  phase = Math.random() * 6;
  anim = 0;
  tx = 0; ty = 0; tz = 0; yaw = 0; tyaw = 0; pitch = 0;
  lastDrawn = "";
  lastMoveT = 0;

  constructor(id: string, name: string, team: 0 | 1, friendly: boolean) {
    this.id = id;
    this.name = name;
    this.team = team;
    const tc = TEAM_COLORS[team];
    const skin = SKINS[(name.charCodeAt(0) + name.length) % SKINS.length];
    const S = 0.9;
    this.rig.scale.setScalar(S);
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number) => {
      const me = new THREE.Mesh(g, m);
      me.position.set(x, y, z);
      me.castShadow = true;
      me.receiveShadow = true;
      parent.add(me);
      return me;
    };
    // torso
    mk(geoBox(0.72, 0.75, 0.4), mt(tc, 0.6), this.rig, 0, 1.18, 0);
    mk(geoBox(0.74, 0.12, 0.42), mt("#ffffff", 0.6), this.rig, 0, 1.0, 0);
    mk(geoBox(0.2, 0.2, 0.02), mt("#ffffff", 0.5), this.rig, 0, 1.28, -0.21);
    // cabeza
    this.head = mk(geoBox(0.46, 0.46, 0.46), mt(skin, 0.6), this.rig, 0, 1.78, 0);
    mk(geoBox(0.5, 0.12, 0.5), mt(tc, 0.5), this.head, 0, 0.2, 0);
    mk(geoBox(0.1, 0.1, 0.02), mt("#111111"), this.head, -0.11, 0.02, -0.235);
    mk(geoBox(0.1, 0.1, 0.02), mt("#111111"), this.head, 0.11, 0.02, -0.235);
    mk(geoBox(0.18, 0.04, 0.02), mt("#7c2d12"), this.head, 0, -0.12, -0.235);
    mk(geoBox(0.5, 0.2, 0.5), mt("#3b2314", 0.9), this.head, 0, 0.27, 0.02);
    // piernas
    for (const [leg, x] of [[this.legL, -0.18], [this.legR, 0.18]] as const) {
      leg.position.set(x, 0.8, 0);
      mk(geoBox(0.32, 0.8, 0.34), mt("#1f2a44", 0.8), leg, 0, -0.4, 0);
      mk(geoBox(0.34, 0.14, 0.4), mt("#f8fafc", 0.6), leg, 0, -0.74, -0.03);
      this.rig.add(leg);
    }
    // brazos
    for (const [arm, x] of [[this.armL, -0.5], [this.armR, 0.5]] as const) {
      arm.position.set(x, 1.5, 0);
      mk(geoBox(0.28, 0.4, 0.3), mt(tc, 0.6), arm, 0, -0.18, 0);
      mk(geoBox(0.26, 0.4, 0.28), mt(skin, 0.6), arm, 0, -0.55, 0);
      this.rig.add(arm);
    }
    this.hand.position.set(0, -0.78, 0);
    this.armR.add(this.hand);
    this.root.add(this.rig);
    // etiqueta
    this.tagCanvas = document.createElement("canvas");
    this.tagCanvas.width = 256;
    this.tagCanvas.height = 72;
    this.tagTex = new THREE.CanvasTexture(this.tagCanvas);
    this.tagTex.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tagTex, transparent: true, depthTest: !friendly, depthWrite: false }));
    this.tag.scale.set(1.7, 0.48, 1);
    this.tag.position.y = 2.55;
    this.tag.renderOrder = 10;
    this.root.add(this.tag);
    this.drawTag();
  }

  drawTag() {
    const key = `${this.name}|${Math.ceil(this.hp)}`;
    if (key === this.lastDrawn) return;
    this.lastDrawn = key;
    const g = this.tagCanvas.getContext("2d")!;
    g.clearRect(0, 0, 256, 72);
    g.font = "900 30px Arial Black, Arial, sans-serif";
    g.textAlign = "center";
    g.lineWidth = 6;
    g.strokeStyle = "rgba(0,0,0,0.85)";
    g.strokeText(this.name, 128, 26);
    g.fillStyle = TEAM_COLORS[this.team];
    g.fillText(this.name, 128, 26);
    g.fillStyle = "rgba(0,0,0,0.7)";
    g.fillRect(28, 42, 200, 18);
    const f = Math.max(0, this.hp) / 100;
    g.fillStyle = f > 0.5 ? "#22c55e" : f > 0.25 ? "#eab308" : "#ef4444";
    g.fillRect(31, 45, 194 * f, 12);
    this.tagTex.needsUpdate = true;
  }

  setWeapon(id: WeaponId) {
    if (this.weaponId === id) return;
    this.weaponId = id;
    if (this.weaponMesh) this.hand.remove(this.weaponMesh);
    const m = buildWeaponModel(id, TEAM_COLORS[this.team]);
    m.group.scale.setScalar(0.9);
    this.hand.add(m.group);
    m.group.position.set(0, -0.02, -0.05);
    m.group.rotation.set(-Math.PI / 2, 0, 0);
    // el arma apunta hacia delante cuando el brazo está levantado
    this.weaponMesh = m.group;
    this.weaponMesh.rotation.x = -Math.PI / 2 + 0;
  }

  setState(hp: number, alive: boolean) {
    if (hp !== this.hp) {
      this.hp = hp;
    }
    if (alive !== this.alive) {
      this.alive = alive;
      this.deadT = 0;
      if (alive) {
        this.rig.rotation.x = 0;
        this.rig.position.y = 0;
      }
    }
    this.root.visible = this.alive || this.deadT < 2;
    this.drawTag();
  }

  setTarget(x: number, y: number, z: number, yaw: number, pitch: number, anim: number, snap = false) {
    this.tx = x; this.ty = y; this.tz = z; this.tyaw = yaw; this.pitch = pitch; this.anim = anim;
    if (snap) {
      this.root.position.set(x, y, z);
      this.yaw = yaw;
    }
  }

  update(dt: number) {
    const p = this.root.position;
    const k = 1 - Math.exp(-dt * 16);
    const px = p.x, pz = p.z;
    p.x += (this.tx - p.x) * k;
    p.y += (this.ty - p.y) * k;
    p.z += (this.tz - p.z) * k;
    let dy = this.tyaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * k;
    this.rig.rotation.y = this.yaw;
    const speed = Math.hypot(p.x - px, p.z - pz) / Math.max(dt, 0.001);
    this.tag.visible = this.alive;
    if (!this.alive) {
      this.deadT += dt;
      this.rig.rotation.x = Math.max(-Math.PI / 2, this.rig.rotation.x - dt * 6);
      this.rig.position.y = Math.max(-0.5, this.rig.position.y - dt);
      this.root.visible = this.deadT < 2.5;
      return;
    }
    const run = this.anim === 2 ? 0 : Math.min(1, speed / 6);
    this.phase += dt * (6 + speed * 1.1) * (this.anim === 1 || run > 0.1 ? 1 : 0.2);
    const sw = Math.sin(this.phase) * 0.9 * run;
    const armed = true;
    let lean = 0, drop = 0;
    this.rig.position.y = Math.abs(Math.sin(this.phase)) * 0.06 * run;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    const aim = -this.pitch; // pitch + = mirar arriba
    const armX = armed ? 1.45 + aim * 0.6 : 0;
    this.armR.rotation.set(armX, 0, 0);
    this.armL.rotation.set(armed ? 1.3 + aim * 0.6 : 0, 0, armed ? -0.45 : 0);
    if (this.anim === 2) {
      lean = 0.9;
      drop = 0.45;
      this.legL.rotation.x = 1.3;
      this.legR.rotation.x = 1.1;
      this.rig.position.y = -0.35;
    } else if (this.anim === 3) {
      this.legL.rotation.x = 0.6;
      this.legR.rotation.x = -0.5;
      this.armL.rotation.z = -0.9;
    } else if (run < 0.1) {
      this.rig.position.y = Math.sin(performance.now() * 0.003 + this.phase) * 0.012;
    }
    this.rig.rotation.x = lean;
    void drop;
    this.head.rotation.x = -this.pitch * 0.6;
    if (this.weaponId && WEAPONS[this.weaponId].melee) this.armR.rotation.x = 0.9 + aim * 0.3;
  }

  /** Intersección de rayo con el hitbox. Devuelve distancia y si fue en la cabeza. */
  hitTest(o: THREE.Vector3, d: THREE.Vector3, maxDist: number): { dist: number; head: boolean } | null {
    if (!this.alive) return null;
    const p = this.root.position;
    const sl = this.anim === 2;
    const hy = p.y + (sl ? 0.95 : 1.6), top = p.y + (sl ? 1.0 : 1.38);
    const th = raySphere(o, d, p.x, hy, p.z, 0.3);
    const tb = rayCyl(o, d, p.x, p.z, 0.44, p.y, top);
    let best: { dist: number; head: boolean } | null = null;
    if (th !== null && th < maxDist) best = { dist: th, head: true };
    if (tb !== null && tb < maxDist && (!best || tb < best.dist)) best = { dist: tb, head: false };
    return best;
  }

  eyePos(): THREE.Vector3 {
    const p = this.root.position;
    return new THREE.Vector3(p.x, p.y + (this.anim === 2 ? 1.0 : 1.55), p.z);
  }

  dispose() {
    this.root.removeFromParent();
    this.tagTex.dispose();
    (this.tag.material as THREE.SpriteMaterial).dispose();
  }
}
