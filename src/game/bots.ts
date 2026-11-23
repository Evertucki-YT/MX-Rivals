import * as THREE from "three";
import { WEAPONS, type NetPlayer, type WeaponId } from "./shared";
import { flowField, nextWaypoint, stepBody, type Body, type MapData } from "./mapkit";

export interface BotTarget {
  id: string;
  pos: THREE.Vector3; // pies
  anim: number;
}

export interface BotWorld {
  map: MapData;
  los(a: THREE.Vector3, b: THREE.Vector3): boolean;
  targets(team: 0 | 1): BotTarget[];
  hit(bot: BotSim, targetId: string, dmg: number, head: boolean): void;
  shot(bot: BotSim, from: THREE.Vector3, to: THREE.Vector3): void;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class BotSim {
  id: string;
  name: string;
  team: 0 | 1;
  weapon: WeaponId;
  body: Body = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: true };
  yaw = 0;
  pitch = 0;
  anim = 0;
  alive = true;
  target: string | null = null;
  thinkT = Math.random() * 0.3;
  reactT = 0.4;
  cd = 0.5;
  strafeDir = 1;
  strafeT = 0;
  burst = 0;
  stuckT = 0;
  lastX = 0;
  lastZ = 0;
  jitterT = 0;
  jx = 0;
  jz = 0;
  skill = 0.8 + Math.random() * 0.4;
  slideT = 0;
  hasLos = false;

  constructor(p: NetPlayer) {
    this.id = p.id;
    this.name = p.name;
    this.team = p.team;
    this.weapon = p.weapon;
    this.body.x = p.x;
    this.body.y = p.y;
    this.body.z = p.z;
    this.yaw = p.yaw;
  }

  place(x: number, z: number, yaw: number) {
    Object.assign(this.body, { x, y: 0, z, vx: 0, vy: 0, vz: 0, onGround: true });
    this.yaw = yaw;
    this.pitch = 0;
    this.target = null;
    this.reactT = 0.5;
    this.cd = 0.6;
    this.anim = 0;
  }

  update(dt: number, w: BotWorld, mgr: BotManager) {
    if (!this.alive) return;
    const b = this.body;
    const def = WEAPONS[this.weapon];
    this.cd -= dt;
    this.thinkT -= dt;
    const eye = _a.set(b.x, b.y + 1.55, b.z);
    const targets = w.targets(this.team);
    if (this.thinkT <= 0) {
      this.thinkT = 0.25 + Math.random() * 0.2;
      let best: BotTarget | null = null, bestScore = 1e9;
      for (const t of targets) {
        const d = Math.hypot(t.pos.x - b.x, t.pos.z - b.z);
        _b.set(t.pos.x, t.pos.y + 1.4, t.pos.z);
        const vis = w.los(eye, _b);
        const score = d + (vis ? 0 : 25);
        if (score < bestScore) { bestScore = score; best = t; }
      }
      if (best?.id !== this.target) this.reactT = (0.3 + Math.random() * 0.35) / this.skill;
      this.target = best?.id ?? null;
    }
    const t = targets.find((x) => x.id === this.target);
    let wishX = 0, wishZ = 0;
    let desiredYaw = this.yaw, desiredPitch = 0;
    let los = false, dist = 0;
    if (t) {
      const tx = t.pos.x, tz = t.pos.z, ty = t.pos.y + (t.anim === 2 ? 0.9 : 1.35);
      const dx = tx - b.x, dz = tz - b.z, dy = ty - eye.y;
      dist = Math.hypot(dx, dz);
      los = w.los(eye, _b.set(tx, ty, tz));
      this.hasLos = los;
      const fx = dx / (dist || 1), fz = dz / (dist || 1);
      const rx = -fz, rz = fx;
      desiredYaw = Math.atan2(-dx, -dz);
      desiredPitch = Math.atan2(dy, dist);
      const engage = this.weapon === "shotgun" ? 5 : this.weapon === "revolver" ? 12 : 15;
      if (los && dist < 32) {
        this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0.5 + Math.random() * 1.2; }
        const adv = dist > engage ? 1 : dist < engage * 0.5 ? -0.7 : 0.1;
        wishX = fx * adv + rx * this.strafeDir * 0.85;
        wishZ = fz * adv + rz * this.strafeDir * 0.85;
      } else {
        const field = mgr.field(t.id, t.pos, w.map);
        const wp = nextWaypoint(w.map.nav, field, b.x, b.z);
        if (wp) {
          const ddx = wp[0] - b.x, ddz = wp[1] - b.z;
          const dd = Math.hypot(ddx, ddz) || 1;
          wishX = ddx / dd;
          wishZ = ddz / dd;
          desiredYaw = Math.atan2(-ddx, -ddz);
          desiredPitch = 0;
        }
      }
    }
    // atasco
    this.stuckT += dt;
    if (this.stuckT > 0.7) {
      if (t && Math.hypot(b.x - this.lastX, b.z - this.lastZ) < 0.5) {
        this.jitterT = 0.6;
        const a = Math.random() * Math.PI * 2;
        this.jx = Math.cos(a);
        this.jz = Math.sin(a);
        if (b.onGround) b.vy = 9;
      }
      this.stuckT = 0;
      this.lastX = b.x;
      this.lastZ = b.z;
    }
    if (this.jitterT > 0) {
      this.jitterT -= dt;
      wishX = this.jx;
      wishZ = this.jz;
    }
    // mirada
    let dyaw = desiredYaw - this.yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    const turn = (los ? 7 : 5) * this.skill * dt;
    this.yaw += Math.max(-turn, Math.min(turn, dyaw));
    this.pitch += (desiredPitch - this.pitch) * Math.min(1, dt * 8);
    // movimiento
    const wl = Math.hypot(wishX, wishZ);
    const speed = 8 * def.speed * (0.9 + this.skill * 0.1);
    const k = 1 - Math.exp(-dt * (b.onGround ? 10 : 2));
    const tvx = wl > 0.01 ? (wishX / wl) * speed : 0, tvz = wl > 0.01 ? (wishZ / wl) * speed : 0;
    b.vx += (tvx - b.vx) * k;
    b.vz += (tvz - b.vz) * k;
    if (b.onGround && los && Math.random() < dt * 0.5) b.vy = 9;
    stepBody(w.map, b, dt);
    this.anim = !b.onGround ? 3 : Math.hypot(b.vx, b.vz) > 1 ? 1 : 0;
    // disparo
    if (t && los) {
      this.reactT -= dt;
      if (this.reactT <= 0 && this.cd <= 0 && Math.abs(dyaw) < 0.3) this.fire(w, t, dist);
    } else this.reactT = Math.max(this.reactT, 0.25);
  }

  fire(w: BotWorld, t: BotTarget, dist: number) {
    const def = WEAPONS[this.weapon];
    const eye = new THREE.Vector3(this.body.x, this.body.y + 1.5, this.body.z);
    const aim = new THREE.Vector3(t.pos.x, t.pos.y + (t.anim === 2 ? 0.9 : 1.3), t.pos.z);
    let chance = Math.max(0.1, Math.min(0.62, 0.78 - dist * 0.02)) * this.skill * (t.anim === 2 ? 0.7 : 1);
    if (this.weapon === "shotgun") chance = dist < 11 ? 0.8 * this.skill : dist < 18 ? 0.25 : 0.03;
    if (this.weapon === "uzi") chance *= 0.8;
    const hit = Math.random() < chance;
    const to = aim.clone();
    if (!hit) to.add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.3) * 2, (Math.random() - 0.5) * 3));
    w.shot(this, eye, to);
    if (hit) {
      const head = Math.random() < 0.1;
      let dmg = def.dmg * 0.62 * (head ? def.head : 1);
      if (this.weapon === "shotgun") dmg = def.dmg * (dist < 6 ? 5 : 3) * 0.7;
      w.hit(this, t.id, dmg, head);
    }
    const rate = 60 / def.rpm;
    this.burst++;
    if (this.weapon === "rifle" || this.weapon === "uzi") {
      this.cd = rate * 1.4;
      if (this.burst >= 5 + Math.floor(Math.random() * 5)) { this.burst = 0; this.cd = 0.5 + Math.random() * 0.5; }
    } else this.cd = rate * 1.3 + 0.2 + Math.random() * 0.25;
  }
}

export class BotManager {
  bots = new Map<string, BotSim>();
  fields = new Map<string, { t: number; d: Int16Array; x: number; z: number }>();
  time = 0;

  field(id: string, pos: THREE.Vector3, map: MapData) {
    const f = this.fields.get(id);
    if (f && this.time - f.t < 0.6) return f.d;
    const d = flowField(map.nav, pos.x, pos.z);
    this.fields.set(id, { t: this.time, d, x: pos.x, z: pos.z });
    return d;
  }

  sync(players: NetPlayer[]) {
    const ids = new Set<string>();
    for (const p of players) {
      if (!p.bot) continue;
      ids.add(p.id);
      let b = this.bots.get(p.id);
      if (!b) this.bots.set(p.id, (b = new BotSim(p)));
      b.alive = p.alive;
      b.team = p.team;
      b.weapon = p.weapon;
    }
    for (const id of [...this.bots.keys()]) if (!ids.has(id)) this.bots.delete(id);
  }

  clear() {
    this.bots.clear();
    this.fields.clear();
  }
}
