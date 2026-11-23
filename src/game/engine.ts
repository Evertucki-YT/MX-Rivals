import * as THREE from "three";
import { Avatar } from "./character";
import { BotManager, type BotSim, type BotTarget, type BotWorld } from "./bots";
import { initAudio, sfx } from "./audio";
import { buildMap } from "./maps";
import { makeClouds, makeSky, stepBody, type Body, type MapData } from "./mapkit";
import type { Net } from "./net";
import { TEAM_COLORS, WEAPONS, type NetEvent, type NetPlayer, type Snapshot, type WeaponId } from "./shared";
import { buildWeaponModel, type WeaponModel } from "./weapons";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface HudState {
  hp: number;
  alive: boolean;
  ammo: number;
  mag: number;
  cur: number;
  slots: WeaponId[];
  reloading: boolean;
  reloadP: number;
  scoped: boolean;
  dashP: number;
  slideP: number;
  speed: number;
  spectate: string | null;
}
export interface GameCallbacks {
  onHud(h: HudState): void;
  onHitmarker(kind: "hit" | "head" | "kill"): void;
  onHurt(): void;
  onLock(l: boolean): void;
}

const EYE = 1.62;
const EYE_SLIDE = 0.95;
const BASE_SPEED = 9.2;
const V3 = THREE.Vector3;

const VM_BASE: Record<WeaponId, { p: [number, number, number]; r: [number, number, number]; aim: [number, number, number] }> = {
  rifle: { p: [0.2, -0.2, -0.42], r: [0, 0, 0], aim: [0, -0.125, -0.3] },
  sniper: { p: [0.2, -0.2, -0.4], r: [0, 0, 0], aim: [0, -0.1, -0.3] },
  shotgun: { p: [0.2, -0.2, -0.42], r: [0, 0, 0], aim: [0, -0.115, -0.32] },
  revolver: { p: [0.17, -0.18, -0.4], r: [0, 0, 0], aim: [0, -0.1, -0.3] },
  uzi: { p: [0.19, -0.18, -0.4], r: [0, 0, 0], aim: [0, -0.11, -0.3] },
  katana: { p: [0.26, -0.24, -0.5], r: [0.75, 0.25, -0.35], aim: [0.26, -0.24, -0.5] },
  machete: { p: [0.26, -0.22, -0.5], r: [0.65, 0.2, -0.3], aim: [0.26, -0.22, -0.5] },
};

interface VM {
  root: THREE.Group;
  model: WeaponModel;
  flash: THREE.Sprite;
  magBase: number;
}
interface Tracer { mesh: THREE.Mesh; from: THREE.Vector3; dir: THREE.Vector3; len: number; t: number }
interface Particle { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }
interface DmgNum { s: THREE.Sprite; life: number; vy: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Game {
  net: Net;
  cb: GameCallbacks;
  el: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  vmScene = new THREE.Scene();
  vmCam: THREE.PerspectiveCamera;
  raycaster = new THREE.Raycaster();
  map: MapData | null = null;
  mapId = -1;
  envObjs: THREE.Object3D[] = [];
  clock = new THREE.Clock();
  raf = 0;
  disposed = false;
  time = 0;

  keys = new Set<string>();
  mouseDown = false;
  rmb = false;
  firePressed = 0;
  rmbPressed = false;
  slidePressed = false;
  jumpHeld = false;
  locked = false;
  mdx = 0;
  mdy = 0;

  body: Body = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: true };
  yaw = 0;
  pitch = 0;
  recoilPitch = 0;
  roll = 0;
  eyeH = EYE;
  sliding = false;
  slideT = 0;
  slideCd = 0;
  dashT = 0;
  dashCd = 0;
  dashDir = new V3();
  bobT = 0;
  fov = 78;
  anim = 0;
  hSpeed = 0;

  team: 0 | 1 = 0;
  myId = "";
  isHost = false;
  slots: WeaponId[] = ["rifle", "revolver", "katana"];
  last = 0;
  cur = 0;
  ammo: Record<string, number> = {};
  cooldown = 0;
  reloading = false;
  reloadT = 0;
  swapT = 0;
  meleeT = 0;
  meleeDur = 0.3;
  meleePending = false;
  autoReload = false;
  scoped = false;
  aimT = 0;
  vmKick = 0;
  vmKickRot = 0;
  swayX = 0;
  swayY = 0;
  vms = new Map<WeaponId, VM>();

  avatars = new Map<string, Avatar>();
  bots = new BotManager();
  lastKey = "";
  forceSnap = false;
  hp = 100;
  lastHp = 100;
  alive = true;
  specId: string | null = null;
  hudT = 0;
  snapPlayers: NetPlayer[] = [];

  tracers: Tracer[] = [];
  tracerPool: THREE.Mesh[] = [];
  particles: Particle[] = [];
  holes: THREE.Mesh[] = [];
  holeIdx = 0;
  dmgNums: DmgNum[] = [];
  numTex = new Map<string, THREE.CanvasTexture>();
  partMats: Record<string, THREE.MeshBasicMaterial>;
  partGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  unsub: () => void;
  cleanup: (() => void)[] = [];

  constructor(el: HTMLElement, net: Net, cb: GameCallbacks) {
    this.el = el;
    this.net = net;
    this.cb = cb;
    this.myId = net.id;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.05, 700);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);
    this.vmCam = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = envTex;
      this.scene.environmentIntensity = 0.4;
      this.vmScene.environment = envTex;
      this.vmScene.environmentIntensity = 0.9;
      pmrem.dispose();
    } catch {
      /* sin entorno */
    }
    this.vmScene.add(new THREE.HemisphereLight("#ffffff", "#8899aa", 1.6));
    const vd = new THREE.DirectionalLight("#ffffff", 2.2);
    vd.position.set(1, 2, 1);
    this.vmScene.add(vd);
    this.partMats = {
      spark: new THREE.MeshBasicMaterial({ color: "#ffd54a" }),
      dust: new THREE.MeshBasicMaterial({ color: "#d9cdb0" }),
      blood: new THREE.MeshBasicMaterial({ color: "#ff2d3d" }),
    };
    const tm = new THREE.MeshBasicMaterial({ color: "#ffe9a8", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), tm.clone());
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      this.tracerPool.push(m);
    }
    const holeMat = new THREE.MeshBasicMaterial({ color: "#111111", transparent: true, opacity: 0.7 });
    for (let i = 0; i < 40; i++) {
      const h = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), holeMat);
      h.visible = false;
      this.scene.add(h);
      this.holes.push(h);
    }
    this.resize();
    this.bind();
    net.stateProvider = () => ({
      id: this.myId,
      x: this.body.x,
      y: this.body.y,
      z: this.body.z,
      yaw: this.yaw,
      pitch: this.pitch,
      anim: this.anim,
      weapon: this.slots[this.cur],
    });
    net.botsProvider = () =>
      this.isHost
        ? [...this.bots.bots.values()].map((b) => ({ id: b.id, x: b.body.x, y: b.body.y, z: b.body.z, yaw: b.yaw, pitch: b.pitch, anim: b.anim, weapon: b.weapon }))
        : undefined;
    this.unsub = net.addEvents((e) => this.onEvents(e));
    this.setupBotWorld();
    this.clock.start();
    this.loop();
  }

  /* ---------- eventos de entrada ---------- */
  bind() {
    const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void) => {
      window.addEventListener(t, f as EventListener);
      this.cleanup.push(() => window.removeEventListener(t, f as EventListener));
    };
    on("resize", () => this.resize());
    on("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === "Space") { this.jumpHeld = true; if (this.locked) e.preventDefault(); }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyC") this.slidePressed = true;
      if (e.code === "Digit1") this.switchTo(0);
      if (e.code === "Digit2") this.switchTo(1);
      if (e.code === "Digit3") this.switchTo(2);
      if (e.code === "KeyR") this.startReload();
      if (e.code === "KeyQ") this.switchTo(this.last);
    });
    on("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Space") this.jumpHeld = false;
    });
    on("blur", () => { this.keys.clear(); this.mouseDown = false; this.rmb = false; });
    on("mousedown", (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouseDown = true; this.firePressed = 0.15; }
      if (e.button === 2) { this.rmb = true; this.rmbPressed = true; }
    });
    on("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rmb = false;
    });
    on("mousemove", (e) => {
      if (!this.locked) return;
      const s = 0.0022 * (this.camera.fov / 78) * (this.scoped ? 0.9 : 1);
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
      this.mdx += e.movementX;
      this.mdy += e.movementY;
    });
    on("wheel", (e) => {
      if (!this.locked) return;
      this.switchTo((this.cur + (e.deltaY > 0 ? 1 : 2)) % 3);
    });
    const ctx = (e: Event) => e.preventDefault();
    this.renderer.domElement.addEventListener("contextmenu", ctx);
    document.addEventListener("contextmenu", ctx);
    const plc = () => {
      this.locked = document.pointerLockElement === this.renderer.domElement;
      if (!this.locked) { this.mouseDown = false; this.rmb = false; }
      this.cb.onLock(this.locked);
    };
    document.addEventListener("pointerlockchange", plc);
    this.cleanup.push(() => {
      document.removeEventListener("pointerlockchange", plc);
      document.removeEventListener("contextmenu", ctx);
    });
  }

  requestLock() {
    initAudio();
    try {
      const p = this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => undefined);
    } catch {
      /* ignore */
    }
  }

  resize() {
    const w = this.el.clientWidth || window.innerWidth, h = this.el.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vmCam.aspect = w / h;
    this.vmCam.updateProjectionMatrix();
  }

  /* ---------- mapa ---------- */
  loadMap(id: number) {
    if (this.map) {
      this.scene.remove(this.map.group);
      this.envObjs.forEach((o) => this.scene.remove(o));
      this.envObjs = [];
    }
    this.map = buildMap(id);
    this.mapId = id;
    const s = this.map.sky;
    this.scene.add(this.map.group);
    const sky = makeSky(s.top, s.mid, s.bottom);
    const clouds = makeClouds(14, id === 0 ? "#ffd6b0" : "#ffffff", 0.85);
    const hemi = new THREE.HemisphereLight(s.hemiSky, s.hemiGround, s.hemiI);
    const sun = new THREE.DirectionalLight(s.sun, s.sunI);
    sun.position.set(...s.sunPos);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 220;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    sun.position.set(...s.sunPos).normalize().multiplyScalar(90);
    const disc = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 12), new THREE.MeshBasicMaterial({ color: s.sun, fog: false }));
    disc.position.copy(sun.position).normalize().multiplyScalar(430);
    this.envObjs.push(sky, clouds, hemi, sun, sun.target, disc);
    this.envObjs.forEach((o) => this.scene.add(o));
    this.scene.fog = new THREE.Fog(s.fog, s.fogNear, s.fogFar);
    this.scene.background = new THREE.Color(s.mid);
  }

  /* ---------- armas ---------- */
  getVM(id: WeaponId): VM {
    let vm = this.vms.get(id);
    if (vm) return vm;
    const model = buildWeaponModel(id, TEAM_COLORS[this.team]);
    const root = new THREE.Group();
    root.add(model.group);
    const skin = new THREE.MeshStandardMaterial({ color: "#e0b088", roughness: 0.7 });
    const sleeve = new THREE.MeshStandardMaterial({ color: TEAM_COLORS[this.team], roughness: 0.6 });
    const def = WEAPONS[id];
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      me.position.set(x, y, z);
      me.rotation.set(rx, ry, 0);
      model.group.add(me);
    };
    // mano derecha
    box(0.065, 0.065, 0.1, skin, 0.0, -0.045, 0.02);
    box(0.07, 0.07, 0.34, skin, 0.03, -0.1, 0.22, 0.25, -0.1);
    box(0.085, 0.085, 0.2, sleeve, 0.05, -0.14, 0.45, 0.3, -0.1);
    if (!def.melee) {
      const z = id === "revolver" ? -0.12 : id === "uzi" ? -0.16 : id === "sniper" ? -0.32 : -0.34;
      box(0.065, 0.06, 0.1, skin, 0.0, -0.045, z);
      box(0.065, 0.065, 0.4, skin, -0.1, -0.12, z + 0.26, 0.15, 0.3);
      box(0.085, 0.085, 0.2, sleeve, -0.17, -0.16, z + 0.52, 0.15, 0.3);
    }
    const tex = this.flashTex();
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: "#ffd27a" }));
    flash.scale.set(0.42, 0.42, 1);
    flash.visible = false;
    model.muzzle.add(flash);
    root.scale.setScalar(def.melee ? 0.92 : 0.8);
    this.vmScene.add(root);
    root.visible = false;
    vm = { root, model, flash, magBase: model.mag ? model.mag.position.y : 0 };
    this.vms.set(id, vm);
    return vm;
  }
  flashTexCache: THREE.CanvasTexture | null = null;
  flashTex() {
    if (this.flashTexCache) return this.flashTexCache;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.3, "rgba(255,220,120,0.9)");
    gr.addColorStop(1, "rgba(255,120,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "rgba(255,240,180,0.9)";
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.4;
      g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * 31, 32 + Math.sin(a) * 31); g.stroke();
    }
    return (this.flashTexCache = new THREE.CanvasTexture(c));
  }

  applyLoadout() {
    const l = this.net.loadout;
    this.slots = [l.primary, l.secondary, l.melee];
    this.ammo = {};
    for (const s of this.slots) this.ammo[s] = WEAPONS[s].mag;
    this.cur = 0;
    this.last = 1;
    this.reloading = false;
    this.cooldown = 0.3;
    this.swapT = 0.3;
    this.autoReload = false;
    this.scoped = false;
  }

  switchTo(i: number) {
    if (i === this.cur || !this.alive) return;
    const ph = this.net.snap?.phase;
    if (ph !== "playing" && ph !== "loadout" && ph !== "roundEnd") return;
    this.last = this.cur;
    this.cur = i;
    this.reloading = false;
    this.autoReload = false;
    this.swapT = 0.3;
    this.meleeT = 0;
    this.cooldown = Math.max(this.cooldown, 0.18);
    sfx("swap");
  }

  startReload() {
    const id = this.slots[this.cur];
    const w = WEAPONS[id];
    if (w.melee || this.reloading || this.ammo[id] >= w.mag || this.swapT > 0 || !this.alive) return;
    this.reloading = true;
    this.reloadT = w.reload;
    this.autoReload = false;
    sfx(id === "shotgun" ? "pump" : "reload");
  }

  /* ---------- respawn / fases ---------- */
  respawn(snap: Snapshot) {
    if (!this.map) return;
    const me = snap.players.find((p) => p.id === snap.you);
    if (!me) return;
    const sp = this.map.spawns[me.team][me.spawn % this.map.spawns[me.team].length];
    this.body = { x: sp[0], y: 0, z: sp[1], vx: 0, vy: 0, vz: 0, onGround: true };
    this.yaw = me.team === 0 ? Math.PI : 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.sliding = false;
    this.dashT = 0;
    this.alive = true;
    this.hp = 100;
    this.lastHp = 100;
    this.specId = null;
    this.applyLoadout();
    this.forceSnap = true;
    for (const t of this.tracers) t.mesh.visible = false;
    this.tracers = [];
    this.holes.forEach((h) => (h.visible = false));
    if (this.locked) document.exitPointerLock();
    this.bots.fields.clear();
    for (const p of snap.players) {
      const b = this.bots.bots.get(p.id);
      if (b && this.isHost) {
        const s = this.map.spawns[p.team][p.spawn % this.map.spawns[p.team].length];
        b.place(s[0], s[1], p.team === 0 ? Math.PI : 0);
      }
    }
  }

  onEvents(evs: NetEvent[]) {
    for (const e of evs) {
      if (e.t === "shot") {
        if (e.by === this.myId || (this.isHost && e.by.startsWith("bot-"))) continue;
        const from = new V3(...e.from), to = new V3(...e.to);
        this.spawnTracer(from, to, WEAPONS[e.w]?.color ?? "#ffe9a8", 0.04);
        const d = from.distanceTo(this.camera.position);
        sfx("far", Math.max(0.08, 1 - d / 55));
      } else if (e.t === "kill") {
        if (e.killer === this.myId) { this.cb.onHitmarker("kill"); sfx("kill"); }
      } else if (e.t === "go") {
        sfx("go");
      } else if (e.t === "round") {
        sfx(e.winner === this.team ? "win" : "lose");
      }
    }
  }

  handleSnapshot(snap: Snapshot) {
    if (snap.mapId !== null && snap.mapId !== this.mapId) this.loadMap(snap.mapId);
    if (!this.map) return;
    const me = snap.players.find((p) => p.id === snap.you);
    if (!me) return;
    this.team = me.team;
    this.isHost = snap.hostId === snap.you;
    this.snapPlayers = snap.players;
    if (this.isHost) this.bots.sync(snap.players);
    else this.bots.clear();
    const key = snap.phase + snap.round;
    if (key !== this.lastKey) {
      if (snap.phase === "loadout" || this.lastKey === "") this.respawn(snap);
      if (snap.phase === "playing") { this.applyLoadout(); this.cooldown = 0.2; }
      this.lastKey = key;
    }
    if (me.hp < this.lastHp - 0.4) {
      this.cb.onHurt();
      sfx("hurt");
    }
    this.lastHp = me.hp;
    this.hp = me.hp;
    if (this.alive && !me.alive && snap.phase === "playing") {
      this.alive = false;
      this.mouseDown = false;
      this.rmb = false;
      this.scoped = false;
      sfx("hurt");
    }
    // avatares
    const seen = new Set<string>();
    for (const p of snap.players) {
      if (p.id === this.myId) continue;
      seen.add(p.id);
      let av = this.avatars.get(p.id);
      if (!av) {
        av = new Avatar(p.id, p.name, p.team, p.team === me.team);
        this.scene.add(av.root);
        this.avatars.set(p.id, av);
        av.setTarget(p.x, p.y, p.z, p.yaw, p.pitch, p.anim, true);
      }
      av.setWeapon(p.weapon);
      av.setState(p.hp, p.alive);
      const sim = this.isHost && p.bot ? this.bots.bots.get(p.id) : undefined;
      if (sim) {
        if (this.forceSnap || !sim) av.setTarget(sim.body.x, sim.body.y, sim.body.z, sim.yaw, sim.pitch, sim.anim, true);
        else av.setTarget(sim.body.x, sim.body.y, sim.body.z, sim.yaw, sim.pitch, sim.anim);
      } else {
        const far = Math.hypot(av.root.position.x - p.x, av.root.position.z - p.z) > 8;
        av.setTarget(p.x, p.y, p.z, p.yaw, p.pitch, p.anim, this.forceSnap || far);
      }
    }
    for (const [id, av] of this.avatars) if (!seen.has(id)) { av.dispose(); this.avatars.delete(id); }
    this.forceSnap = false;
  }

  /* ---------- bucle ---------- */
  loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    const snap = this.net.snap;
    if (snap) this.handleSnapshot(snap);
    if (!this.map || !snap) {
      this.renderer.clear();
      return;
    }
    this.map.updaters.forEach((u) => u(this.time, dt));
    if (this.isHost && snap.phase === "playing") {
      this.bots.time += dt;
      for (const b of this.bots.bots.values()) b.update(dt, this.botWorld, this.bots);
    } else if (this.isHost) {
      this.bots.time += dt;
    }
    this.updatePlayer(dt, snap);
    if (this.isHost) {
      for (const p of snap.players) {
        const sim = p.bot ? this.bots.bots.get(p.id) : undefined;
        const av = this.avatars.get(p.id);
        if (sim && av) av.setTarget(sim.body.x, sim.body.y, sim.body.z, sim.yaw, sim.pitch, sim.anim);
      }
    }
    for (const av of this.avatars.values()) av.update(dt);
    this.updateFx(dt);
    this.updateCamera(dt, snap);
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.08;
      this.emitHud();
    }
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.vmScene, this.vmCam);
  };

  emitHud() {
    const id = this.slots[this.cur];
    const w = WEAPONS[id];
    const spec = !this.alive && this.specId ? this.avatars.get(this.specId)?.name ?? null : null;
    this.cb.onHud({
      hp: this.hp,
      alive: this.alive,
      ammo: this.ammo[id] ?? 0,
      mag: w.mag,
      cur: this.cur,
      slots: this.slots,
      reloading: this.reloading,
      reloadP: this.reloading ? 1 - this.reloadT / w.reload : 0,
      scoped: this.scoped && this.aimT > 0.7,
      dashP: 1 - Math.max(0, this.dashCd) / 2.2,
      slideP: 1 - Math.max(0, this.slideCd) / 1.0,
      speed: this.hSpeed,
      spectate: spec,
    });
  }

  /* ---------- jugador ---------- */
  updatePlayer(dt: number, snap: Snapshot) {
    const b = this.body;
    const phase = snap.phase;
    const canMove = this.alive && (phase === "playing" || phase === "roundEnd");
    const canShoot = this.alive && phase === "playing";
    this.slideCd -= dt;
    this.dashCd -= dt;
    this.cooldown -= dt;
    this.swapT -= dt;
    this.firePressed -= dt;
    const id = this.slots[this.cur];
    const w = WEAPONS[id];
    this.hSpeed = Math.hypot(b.vx, b.vz);
    if (!this.alive) {
      this.anim = 0;
      b.vx = b.vz = 0;
      stepBody(this.map!, b, dt);
      this.rmbPressed = false;
      this.slidePressed = false;
      if (this.firePressed > 0 && this.mouseDown) { this.cycleSpectate(); this.firePressed = 0; this.mouseDown = false; }
      return;
    }
    // apuntar
    const wantAim = this.rmb && !w.melee && !this.reloading && canMove;
    this.scoped = id === "sniper" && wantAim;
    this.aimT += ((wantAim ? 1 : 0) - this.aimT) * Math.min(1, dt * (id === "sniper" ? 9 : 14));
    // recarga
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { this.reloading = false; this.ammo[id] = w.mag; }
    }
    if (this.autoReload && this.cooldown <= 0 && !this.reloading) this.startReload();

    if (canMove) {
      const f = new V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const r = new V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      let ix = 0, iz = 0;
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) iz += 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) iz -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ix += 1;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ix -= 1;
      const il = Math.hypot(ix, iz) || 1;
      const wx = (f.x * iz + r.x * ix) / il, wz = (f.z * iz + r.z * ix) / il;
      const hasInput = ix !== 0 || iz !== 0;
      const speed = BASE_SPEED * w.speed * (this.scoped ? 0.55 : lerp(1, 0.85, this.aimT)) * (this.reloading ? 0.97 : 1);
      // deslizamiento
      if (this.slidePressed && b.onGround && !this.sliding && this.slideCd <= 0 && this.dashT <= 0) {
        const hs = Math.hypot(b.vx, b.vz);
        if (hs > 3 || hasInput) {
          let dx = b.vx, dz = b.vz;
          if (hs < 3) { dx = wx; dz = wz; }
          const dl = Math.hypot(dx, dz) || 1;
          const sp = Math.min(17, Math.max(hs * 1.3, 14));
          b.vx = (dx / dl) * sp;
          b.vz = (dz / dl) * sp;
          this.sliding = true;
          this.slideT = 0.95;
          sfx("slide");
        }
      }
      this.slidePressed = false;
      if (this.sliding) {
        this.slideT -= dt;
        const fr = Math.exp(-dt * 0.9);
        b.vx *= fr;
        b.vz *= fr;
        b.vx += wx * hasInputNum(hasInput) * 6 * dt;
        b.vz += wz * hasInputNum(hasInput) * 6 * dt;
        if (this.slideT <= 0 || Math.hypot(b.vx, b.vz) < 5 || !b.onGround) {
          if (b.onGround || this.slideT <= 0) { this.sliding = false; this.slideCd = 0.9; }
        }
      }
      // salto
      if ((this.jumpHeld || this.keys.has("Space")) && b.onGround) {
        b.vy = 9.6;
        b.onGround = false;
        if (this.sliding) { this.sliding = false; this.slideCd = 0.5; b.vx *= 1.12; b.vz *= 1.12; }
        sfx("jump");
      }
      // dash
      if (this.rmbPressed && id === "katana" && this.dashCd <= 0 && canShoot) {
        const df = new V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        this.dashDir.copy(df);
        this.dashT = 0.2;
        this.dashCd = 2.2;
        this.sliding = false;
        sfx("dash");
      }
      this.rmbPressed = false;
      if (this.dashT > 0) {
        this.dashT -= dt;
        b.vx = this.dashDir.x * 34;
        b.vz = this.dashDir.z * 34;
        if (b.vy < 0) b.vy *= 0.2;
      } else if (!this.sliding) {
        const k = 1 - Math.exp(-dt * (b.onGround ? 13 : 2.4));
        b.vx += (wx * speed * (hasInput ? 1 : 0) - b.vx) * k;
        b.vz += (wz * speed * (hasInput ? 1 : 0) - b.vz) * k;
      }
    } else {
      this.slidePressed = false;
      this.rmbPressed = false;
      const k = 1 - Math.exp(-dt * 10);
      b.vx -= b.vx * k;
      b.vz -= b.vz * k;
      this.sliding = false;
    }
    stepBody(this.map!, b, dt, this.sliding ? 1.0 : 1.75);
    this.anim = this.sliding ? 2 : !b.onGround ? 3 : Math.hypot(b.vx, b.vz) > 1.5 ? 1 : 0;

    // disparo
    if (canShoot && this.swapT <= 0 && !this.reloading) {
      if (w.melee) {
        if (this.cooldown <= 0 && ((w.auto && this.mouseDown) || this.firePressed > 0)) this.startMelee(w);
      } else {
        const want = w.auto ? this.mouseDown : this.firePressed > 0;
        if (want && this.cooldown <= 0) {
          if (this.ammo[id] > 0) this.fire(id, w);
          else { sfx("empty"); this.cooldown = 0.25; this.startReload(); this.firePressed = 0; }
        }
      }
    }
    if (this.meleeT > 0) {
      this.meleeT -= dt;
      if (this.meleePending && this.meleeT < this.meleeDur * 0.55) { this.meleePending = false; this.meleeStrike(w); }
    }
    this.recoilPitch *= Math.exp(-dt * 9);
  }

  cycleSpectate() {
    const alive = this.snapPlayers.filter((p) => p.alive && p.id !== this.myId);
    if (!alive.length) { this.specId = null; return; }
    const i = alive.findIndex((p) => p.id === this.specId);
    this.specId = alive[(i + 1) % alive.length].id;
  }

  castRay(origin: THREE.Vector3, dir: THREE.Vector3, range: number) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = range;
    this.raycaster.near = 0;
    const hits = this.raycaster.intersectObjects(this.map!.rayMeshes, false);
    const wall = hits[0];
    const wallDist = wall ? wall.distance : range;
    let best: { id: string; dist: number; head: boolean } | null = null;
    for (const av of this.avatars.values()) {
      if (av.team === this.team || !av.alive) continue;
      const r = av.hitTest(origin, dir, wallDist);
      if (r && (!best || r.dist < best.dist)) best = { id: av.id, dist: r.dist, head: r.head };
    }
    let normal: THREE.Vector3 | null = null;
    if (!best && wall?.face) normal = wall.face.normal.clone().transformDirection(wall.object.matrixWorld);
    const dist = best ? best.dist : wallDist;
    return { dist, point: origin.clone().addScaledVector(dir, dist), target: best, wall: !best && !!wall, normal };
  }

  muzzleWorld(id: WeaponId) {
    const vm = this.vms.get(id);
    const v = new V3();
    if (vm) {
      vm.model.muzzle.getWorldPosition(v);
      this.camera.localToWorld(v);
    } else v.copy(this.camera.position);
    return v;
  }

  fire(id: WeaponId, w: (typeof WEAPONS)[WeaponId]) {
    this.ammo[id]--;
    this.cooldown = 60 / w.rpm;
    this.firePressed = 0;
    this.vmKick = Math.min(0.14, this.vmKick + 0.025 + w.recoil * 0.018);
    this.vmKickRot += 0.02 + w.recoil * 0.012;
    const kick = w.recoil * 0.0105;
    this.recoilPitch += kick * 1.5;
    this.pitch = Math.min(1.5, this.pitch + kick * 0.5);
    this.yaw += (Math.random() - 0.5) * kick * 0.8;
    const vm = this.getVM(id);
    vm.flash.visible = true;
    vm.flash.material.rotation = Math.random() * 6;
    const fs = id === "shotgun" ? 0.75 : id === "sniper" ? 0.7 : 0.45;
    vm.flash.scale.set(fs, fs, 1);
    setTimeout(() => (vm.flash.visible = false), 55);
    sfx(id);
    if (id === "sniper") setTimeout(() => sfx("bolt"), 450);
    if (id === "shotgun") setTimeout(() => sfx("pump"), 380);

    this.camera.updateMatrixWorld();
    const origin = this.camera.getWorldPosition(new V3());
    const fwd = this.camera.getWorldDirection(new V3());
    const right = new V3().crossVectors(fwd, new V3(0, 1, 0)).normalize();
    const up = new V3().crossVectors(right, fwd).normalize();
    const hs = Math.hypot(this.body.vx, this.body.vz);
    let spread = w.spread;
    if (id === "sniper") spread = this.scoped && this.aimT > 0.7 ? 0.0012 * (1 + hs / 3) : 0.07;
    else spread *= lerp(1, 0.45, this.aimT) * (1 + Math.min(hs, 12) / 12 * 0.8) * (this.body.onGround ? 1 : 1.6) * (this.sliding ? 0.8 : 1);
    const muzzle = this.muzzleWorld(id);
    const dmgMap = new Map<string, { dmg: number; head: boolean; pos: THREE.Vector3 }>();
    let firstEnd: THREE.Vector3 | null = null;
    for (let i = 0; i < w.pellets; i++) {
      const r = spread * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      const res = this.castRay(origin, dir, w.range);
      if (!firstEnd) firstEnd = res.point.clone();
      this.spawnTracer(muzzle, res.point, w.color, w.pellets > 1 ? 0.012 : 0.02);
      if (res.target) {
        let d = w.dmg * (res.target.head ? w.head : 1);
        if (id === "shotgun") d *= Math.max(0.25, Math.min(1, 1 - (res.dist - 7) / 28));
        const cur = dmgMap.get(res.target.id);
        if (cur) { cur.dmg += d; cur.head = cur.head || res.target.head; cur.pos = res.point; }
        else dmgMap.set(res.target.id, { dmg: d, head: res.target.head, pos: res.point });
        this.burst(res.point, "blood", 4, null);
      } else if (res.wall) {
        this.burst(res.point, "spark", 3, res.normal);
        this.burst(res.point, "dust", 2, res.normal);
        this.addHole(res.point, res.normal);
      }
    }
    this.net.shots.push({ by: this.myId, from: [origin.x, origin.y - 0.15, origin.z], to: [firstEnd!.x, firstEnd!.y, firstEnd!.z], w: id });
    let anyHead = false;
    for (const [tid, h] of dmgMap) {
      this.net.hits.push({ by: this.myId, target: tid, dmg: Math.round(h.dmg), head: h.head, w: id });
      this.showDamage(h.pos, Math.round(h.dmg), h.head);
      anyHead = anyHead || h.head;
    }
    if (dmgMap.size) {
      this.cb.onHitmarker(anyHead ? "head" : "hit");
      sfx(anyHead ? "head" : "hit");
    }
    if (this.ammo[id] <= 0) this.autoReload = true;
  }

  startMelee(w: (typeof WEAPONS)[WeaponId]) {
    this.cooldown = 60 / w.rpm;
    this.firePressed = 0;
    this.meleeDur = Math.min(0.42, 60 / w.rpm * 0.9);
    this.meleeT = this.meleeDur;
    this.meleePending = true;
    sfx("swing");
    const f = new V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    if (this.body.onGround && !this.sliding) { this.body.vx += f.x * 3; this.body.vz += f.z * 3; }
  }

  meleeStrike(w: (typeof WEAPONS)[WeaponId]) {
    this.camera.updateMatrixWorld();
    const origin = this.camera.getWorldPosition(new V3());
    const fwd = this.camera.getWorldDirection(new V3());
    let best: Avatar | null = null, bd = 1e9;
    for (const av of this.avatars.values()) {
      if (av.team === this.team || !av.alive) continue;
      const c = new V3(av.root.position.x, av.root.position.y + 1.0, av.root.position.z);
      const to = c.clone().sub(origin);
      const d = to.length();
      if (d > w.range + 0.6) continue;
      to.normalize();
      if (to.dot(fwd) < 0.5) continue;
      const res = this.castRay(origin, to, d);
      if (res.wall && res.dist < d - 0.5) continue;
      if (d < bd) { bd = d; best = av; }
    }
    if (best) {
      const p = new V3(best.root.position.x, best.root.position.y + 1.2, best.root.position.z);
      this.net.hits.push({ by: this.myId, target: best.id, dmg: w.dmg, head: false, w: w.id });
      this.showDamage(p, w.dmg, false);
      this.burst(p, "blood", 10, null);
      this.cb.onHitmarker("hit");
      sfx("slash");
      sfx("hit");
    } else {
      const res = this.castRay(origin, fwd, w.range);
      if (res.wall) { this.burst(res.point, "spark", 6, res.normal); sfx("slash", 0.6); }
    }
  }

  /* ---------- efectos ---------- */
  spawnTracer(from: THREE.Vector3, to: THREE.Vector3, color: string, width: number) {
    const m = this.tracerPool.find((x) => !x.visible && !this.tracers.some((t) => t.mesh === x));
    if (!m) return;
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.5) return;
    dir.normalize();
    (m.material as THREE.MeshBasicMaterial).color.set(color);
    m.userData.w = width;
    m.visible = true;
    this.tracers.push({ mesh: m, from: from.clone(), dir, len, t: 0 });
  }

  burst(p: THREE.Vector3, kind: "spark" | "dust" | "blood", n: number, normal: THREE.Vector3 | null) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 90) break;
      const m = new THREE.Mesh(this.partGeo, this.partMats[kind]);
      m.position.copy(p);
      this.scene.add(m);
      const v = new V3((Math.random() - 0.5) * 3, Math.random() * 3 + 0.5, (Math.random() - 0.5) * 3);
      if (normal) v.addScaledVector(normal, 3 + Math.random() * 3);
      this.particles.push({ mesh: m, vel: v, life: 0.35 + Math.random() * 0.35 });
    }
  }

  addHole(p: THREE.Vector3, n: THREE.Vector3 | null) {
    if (!n) return;
    const h = this.holes[this.holeIdx++ % this.holes.length];
    h.visible = true;
    h.position.copy(p).addScaledVector(n, 0.012);
    h.lookAt(p.clone().add(n));
  }

  showDamage(p: THREE.Vector3, dmg: number, head: boolean) {
    const key = `${dmg}|${head}`;
    let t = this.numTex.get(key);
    if (!t) {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 80;
      const g = c.getContext("2d")!;
      g.font = `900 ${head ? 58 : 50}px Arial Black, Arial`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 9;
      g.strokeStyle = "rgba(0,0,0,0.9)";
      g.strokeText(String(dmg), 80, 42);
      g.fillStyle = head ? "#fde047" : "#ffffff";
      g.fillText(String(dmg), 80, 42);
      t = new THREE.CanvasTexture(c);
      this.numTex.set(key, t);
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    const d = p.distanceTo(this.camera.position);
    const sc = 0.5 + d * 0.06;
    s.scale.set(sc * 2, sc, 1);
    s.position.copy(p).add(new V3((Math.random() - 0.5) * 0.5, 0.5, (Math.random() - 0.5) * 0.5));
    s.renderOrder = 20;
    this.scene.add(s);
    this.dmgNums.push({ s, life: 0.9, vy: 1.6 });
  }

  updateFx(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.t += dt;
      const head = Math.min(t.len, t.t * 280);
      const tail = Math.max(0, head - 16);
      if (tail >= t.len - 0.01 || t.t > 1) {
        t.mesh.visible = false;
        this.tracers.splice(i, 1);
        continue;
      }
      const w = t.mesh.userData.w as number;
      t.mesh.position.copy(t.from).addScaledVector(t.dir, (head + tail) / 2);
      t.mesh.scale.set(w, w, Math.max(0.01, head - tail));
      t.mesh.quaternion.setFromUnitVectors(new V3(0, 0, 1), t.dir);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); continue; }
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(Math.max(0.1, p.life * 2));
    }
    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const n = this.dmgNums[i];
      n.life -= dt;
      n.s.position.y += n.vy * dt;
      n.vy *= 0.96;
      (n.s.material as THREE.SpriteMaterial).opacity = Math.min(1, n.life * 3);
      if (n.life <= 0) { this.scene.remove(n.s); (n.s.material as THREE.SpriteMaterial).dispose(); this.dmgNums.splice(i, 1); }
    }
  }

  /* ---------- cámara y viewmodel ---------- */
  updateCamera(dt: number, snap: Snapshot) {
    const cam = this.camera;
    const id = this.slots[this.cur];
    const w = WEAPONS[id];
    for (const [wid, vm] of this.vms) vm.root.visible = false;
    if (!this.alive) {
      if (!this.specId || !this.avatars.get(this.specId)?.alive) this.cycleSpectate();
      const av = this.specId ? this.avatars.get(this.specId) : null;
      if (av && av.alive) {
        const e = av.eyePos();
        cam.position.lerp(e, 1 - Math.exp(-dt * 12));
        cam.rotation.set(av.pitch, av.yaw, 0);
      } else {
        cam.position.set(this.body.x, this.body.y + 0.4, this.body.z);
        cam.rotation.set(-0.5, this.yaw, 0.3);
      }
      cam.fov = lerp(cam.fov, 78, dt * 8);
      cam.updateProjectionMatrix();
      return;
    }
    const targetEye = this.sliding ? EYE_SLIDE : EYE;
    this.eyeH += (targetEye - this.eyeH) * Math.min(1, dt * 14);
    const sp = Math.min(1, this.hSpeed / 9);
    this.bobT += dt * (this.body.onGround ? 9 + sp * 3 : 1) * (this.sliding ? 0 : 1);
    const bob = this.body.onGround && !this.sliding ? Math.sin(this.bobT) * 0.035 * sp : 0;
    cam.position.set(this.body.x, this.body.y + this.eyeH + bob, this.body.z);
    const strafe = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const rollT = (this.sliding ? 0.13 : 0) - strafe * 0.018 * (this.body.onGround ? 1 : 0.5);
    this.roll += (rollT - this.roll) * Math.min(1, dt * 10);
    cam.rotation.set(this.pitch + this.recoilPitch, this.yaw, this.roll);
    const speedFov = Math.min(7, this.hSpeed * 0.28) + (this.dashT > 0 ? 14 : 0) + (this.sliding ? 5 : 0);
    const targetFov = lerp(78 + speedFov, w.zoom, this.aimT);
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 14);
    cam.updateProjectionMatrix();

    // ---- viewmodel
    const vm = this.getVM(id);
    const showVM = !(this.scoped && this.aimT > 0.75) && (snap.phase !== "lobby");
    vm.root.visible = showVM;
    const base = VM_BASE[id];
    const a = w.melee ? 0 : this.aimT;
    let px = lerp(base.p[0], base.aim[0], a), py = lerp(base.p[1], base.aim[1], a), pz = lerp(base.p[2], base.aim[2], a);
    let rx = base.r[0], ry = base.r[1], rz = base.r[2];
    const bk = 1 - a * 0.85;
    px += Math.sin(this.bobT * 0.5) * 0.012 * sp * bk;
    py += Math.abs(Math.cos(this.bobT * 0.5)) * 0.014 * sp * bk;
    this.swayX += (-this.mdx * 0.0005 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (this.mdy * 0.0005 - this.swayY) * Math.min(1, dt * 10);
    this.swayX = Math.max(-0.05, Math.min(0.05, this.swayX));
    this.swayY = Math.max(-0.05, Math.min(0.05, this.swayY));
    this.mdx = this.mdy = 0;
    px += this.swayX * bk;
    py += this.swayY * bk;
    this.vmKick *= Math.exp(-dt * 13);
    this.vmKickRot *= Math.exp(-dt * 11);
    pz += this.vmKick;
    rx += this.vmKickRot;
    if (this.sliding) { py -= 0.05; rz += 0.25; rx -= 0.1; px += 0.04; }
    if (!this.body.onGround) py -= 0.012;
    if (this.reloading) {
      const p = 1 - this.reloadT / w.reload;
      const rr = Math.sin(p * Math.PI);
      rx -= 0.85 * rr;
      rz += 0.55 * rr;
      py -= 0.1 * rr;
      px -= 0.05 * rr;
      if (vm.model.mag && id !== "revolver") {
        vm.model.mag.position.y = vm.magBase - (p > 0.2 && p < 0.45 ? 0.35 : p >= 0.45 && p < 0.6 ? 0.2 * (0.6 - p) / 0.15 : 0);
        vm.model.mag.visible = !(p > 0.28 && p < 0.42);
      } else if (vm.model.mag && id === "revolver") vm.model.mag.rotation.z = p * Math.PI * 4;
    } else if (vm.model.mag) {
      vm.model.mag.position.y = vm.magBase;
      vm.model.mag.visible = true;
    }
    if (this.swapT > 0) {
      const s = Math.max(0, this.swapT / 0.3);
      py -= 0.45 * s * s;
      rx -= 0.9 * s;
    }
    if (this.meleeT > 0) {
      const q = 1 - this.meleeT / this.meleeDur;
      const e = Math.sin(Math.min(1, q) * Math.PI);
      const sweep = 1 - Math.pow(1 - q, 2);
      px += 0.12 - 0.75 * sweep;
      py += 0.1 * e - 0.1 * sweep;
      pz -= 0.18 * e;
      rz += lerp(-0.2, 1.5, sweep) - 0.2;
      rx += lerp(0.5, -1.3, sweep);
      ry += lerp(0.2, -0.6, sweep);
    }
    if (this.dashT > 0) { pz += 0.1; py -= 0.06; rx -= 0.5; }
    vm.root.position.set(px, py, pz);
    vm.root.rotation.set(rx, ry, rz);
  }

  /* ---------- mundo para bots ---------- */
  botWorld: BotWorld = {
    get map() { return undefined as unknown as MapData; },
    los: () => true,
    targets: () => [],
    hit: () => undefined,
    shot: () => undefined,
  };

  setupBotWorld() {
    const self = this;
    this.botWorld = {
      get map() { return self.map as MapData; },
      los(a, b) {
        const d = b.clone().sub(a);
        const len = d.length();
        d.normalize();
        self.raycaster.set(a, d);
        self.raycaster.near = 0;
        self.raycaster.far = len - 0.35;
        return self.raycaster.intersectObjects(self.map!.rayMeshes, false).length === 0;
      },
      targets(team) {
        const out: BotTarget[] = [];
        if (self.alive && self.team !== team && self.net.snap?.phase === "playing") out.push({ id: self.myId, pos: new V3(self.body.x, self.body.y, self.body.z), anim: self.anim });
        for (const av of self.avatars.values()) if (av.team !== team && av.alive) out.push({ id: av.id, pos: av.root.position, anim: av.anim });
        return out;
      },
      hit(bot: BotSim, targetId, dmg, head) {
        self.net.hits.push({ by: bot.id, target: targetId, dmg: Math.round(dmg), head, w: bot.weapon });
      },
      shot(bot: BotSim, from, to) {
        self.net.shots.push({ by: bot.id, from: [from.x, from.y, from.z], to: [to.x, to.y, to.z], w: bot.weapon });
        self.spawnTracer(from, to, WEAPONS[bot.weapon].color, 0.04);
        const d = from.distanceTo(self.camera.position);
        sfx("far", Math.max(0.08, 1 - d / 55));
      },
    };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    this.unsub();
    this.net.stateProvider = null;
    this.net.botsProvider = null;
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    for (const av of this.avatars.values()) av.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function hasInputNum(b: boolean) {
  return b ? 1 : 0;
}
