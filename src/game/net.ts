import type { HitReport, Loadout, NetEvent, NetPlayer, Phase, ShotReport, Snapshot, StateReport, SyncBody, WeaponId } from "./shared";
import { DEFAULT_LOADOUT, LOADOUT_MS, MAX_HP, ROUNDS_TO_WIN, ROUND_MS } from "./shared";

const BOT_NAMES = ["El Chavo", "Don Beto", "La Catrina", "Chuy", "Lupita", "Memo", "Toño", "Paco", "Yadira", "Chente", "El Compa", "Nacho", "Panchito", "Güero", "Tacoman", "La Morra", "Jimmy", "Chela", "Rigo", "Maribel"];
const BOT_WEAPONS: WeaponId[] = ["rifle", "rifle", "uzi", "shotgun", "revolver"];
const PUBLIC_WAIT = 6000;
const PREFIX = "mx-rivals-ever-baruc-v1-";

interface PeerConn {
  peer: string;
  open: boolean;
  send: (data: unknown) => void;
  close: () => void;
  on: (ev: string, fn: (arg?: unknown) => void) => void;
}
interface PeerInstance {
  id: string;
  destroyed: boolean;
  on: (ev: string, fn: (arg?: unknown) => void) => void;
  connect: (id: string, opts?: { reliable?: boolean }) => PeerConn;
  destroy: () => void;
}

declare global {
  interface Window {
    Peer?: new (id?: string) => PeerInstance;
  }
}

async function loadPeerJS(): Promise<new (id?: string) => PeerInstance> {
  const mod = await import("peerjs");
  return (mod.Peer ?? mod.default) as unknown as new (id?: string) => PeerInstance;
}


interface HostRoom {
  code: string;
  peerId: string;
  isPublic: boolean;
  practice: boolean;
  size: number;
  lobbyEnd: number;
  hostId: string;
  players: NetPlayer[];
  loadouts: Record<string, Loadout>;
  phase: Phase;
  phaseEnd: number;
  mapId: number | null;
  votes: Record<string, number>;
  round: number;
  score: [number, number];
  events: NetEvent[];
  seq: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);
function genCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += abc[Math.floor(Math.random() * abc.length)];
  return c;
}

class P2PManager {
  peer: PeerInstance | null = null;
  room: HostRoom | null = null;
  conns = new Map<string, PeerConn>();
  connToPlayer = new Map<string, string>();
  clientConn: PeerConn | null = null;
  myId = "";
  lastSnap: Snapshot | null = null;
  activeNet: Net | null = null;

  reset() {
    this.conns.forEach((c) => { try { c.close(); } catch {} });
    this.conns.clear();
    this.connToPlayer.clear();
    if (this.clientConn) { try { this.clientConn.close(); } catch {} }
    this.clientConn = null;
    if (this.peer && !this.peer.destroyed) { try { this.peer.destroy(); } catch {} }
    this.peer = null;
    this.room = null;
    this.lastSnap = null;
  }

  private addPlayer(room: HostRoom, name: string, bot: boolean, pref?: 0 | 1): NetPlayer | null {
    const teamCount = (t: number) => room.players.filter((p) => p.team === t).length;
    let team: 0 | 1 = pref ?? (teamCount(0) <= teamCount(1) ? 0 : 1);
    if (teamCount(team) >= room.size) team = team === 0 ? 1 : 0;
    if (teamCount(team) >= room.size) return null;
    const used = new Set(room.players.filter((p) => p.team === team).map((p) => p.spawn));
    let spawn = 0;
    while (used.has(spawn)) spawn++;
    const p: NetPlayer = {
      id: (bot ? "bot-" : "") + uid(),
      name: name.slice(0, 14) || "Jugador",
      team,
      bot,
      spawn,
      x: 0, y: 0, z: 0, yaw: 0, pitch: 0, anim: 0,
      weapon: bot ? BOT_WEAPONS[Math.floor(Math.random() * BOT_WEAPONS.length)] : "rifle",
      hp: MAX_HP,
      alive: true,
      kills: 0,
      deaths: 0,
      seen: Date.now(),
    };
    room.players.push(p);
    if (!bot) room.loadouts[p.id] = { ...DEFAULT_LOADOUT };
    return p;
  }

  private fillBots(room: HostRoom) {
    const teamCount = (t: number) => room.players.filter((p) => p.team === t).length;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const used = new Set(room.players.map((p) => p.name));
    for (const t of [0, 1] as const) {
      while (teamCount(t) < room.size) {
        const n = names.find((x) => !used.has(x)) ?? "Bot" + Math.floor(Math.random() * 99);
        used.add(n);
        if (!this.addPlayer(room, n, true, t)) break;
      }
    }
  }

  private pushEv(room: HostRoom, ev: Omit<NetEvent, "seq"> & Record<string, unknown>) {
    room.seq++;
    room.events.push({ ...ev, seq: room.seq } as NetEvent);
    if (room.events.length > 120) room.events.splice(0, room.events.length - 120);
  }

  private startLoadout(room: HostRoom) {
    for (const p of room.players) { p.hp = MAX_HP; p.alive = true; }
    room.phase = "loadout";
    room.phaseEnd = Date.now() + LOADOUT_MS;
    this.pushEv(room, { t: "msg", text: "Ronda " + room.round });
  }

  private startVote(room: HostRoom) {
    room.votes = {};
    room.phase = "vote";
    room.phaseEnd = Date.now() + 10000;
  }

  private endRound(room: HostRoom, winner: number) {
    room.score[winner]++;
    this.pushEv(room, { t: "round", winner, score: [...room.score] as [number, number] });
    room.phase = "roundEnd";
    room.phaseEnd = Date.now() + 3800;
  }

  private applyHit(room: HostRoom, h: HitReport) {
    if (room.phase !== "playing") return;
    const by = room.players.find((p) => p.id === h.by);
    const tg = room.players.find((p) => p.id === h.target);
    if (!by || !tg || !by.alive || !tg.alive || by.team === tg.team) return;
    const dmg = Math.max(0, Math.min(200, Number(h.dmg) || 0));
    tg.hp = Math.max(0, tg.hp - dmg);
    if (tg.hp <= 0) {
      tg.alive = false;
      tg.deaths++;
      by.kills++;
      this.pushEv(room, { t: "kill", killer: by.id, victim: tg.id, w: h.w, head: !!h.head });
    }
  }
  hostTick(room: HostRoom) {
    const now = Date.now();
    const humans = room.players.filter((p) => !p.bot);
    switch (room.phase) {
      case "lobby":
        if (room.isPublic && (humans.length >= room.size * 2 || now >= room.lobbyEnd)) {
          this.fillBots(room);
          this.startVote(room);
        }
        break;
      case "vote": {
        const allVoted = humans.length > 0 && humans.every((h) => room.votes[h.id] !== undefined);
        if (now >= room.phaseEnd || (allVoted && now >= room.phaseEnd - 7000)) {
          const tally = new Array<number>(3).fill(0);
          Object.values(room.votes).forEach((v) => tally[v]++);
          const max = Math.max(...tally);
          const best = tally.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
          room.mapId = best[Math.floor(Math.random() * best.length)];
          room.round = 1;
          this.startLoadout(room);
        }
        break;
      }
      case "loadout":
        if (now >= room.phaseEnd) {
          room.phase = "playing";
          room.phaseEnd = now + ROUND_MS;
          this.pushEv(room, { t: "go" });
        }
        break;
      case "playing": {
        const a0 = room.players.filter((p) => p.team === 0 && p.alive).length;
        const a1 = room.players.filter((p) => p.team === 1 && p.alive).length;
        if (a0 === 0 || a1 === 0) this.endRound(room, a0 === 0 && a1 === 0 ? Math.round(Math.random()) : a0 > 0 ? 0 : 1);
        else if (now >= room.phaseEnd) {
          const hp = (t: number) => room.players.filter((p) => p.team === t).reduce((s, p) => s + (p.alive ? p.hp : 0), 0);
          const h0 = hp(0), h1 = hp(1);
          this.endRound(room, h0 === h1 ? Math.round(Math.random()) : h0 > h1 ? 0 : 1);
        }
        break;
      }
      case "roundEnd":
        if (now >= room.phaseEnd) {
          if (room.score.at(0)! >= ROUNDS_TO_WIN || room.score.at(1)! >= ROUNDS_TO_WIN) {
            room.phase = "matchEnd";
            room.phaseEnd = now;
          } else {
            room.round++;
            this.startLoadout(room);
          }
        }
        break;
    }
  }

  buildSnap(room: HostRoom, playerId: string, since = 0): Snapshot {
    const tally = new Array<number>(3).fill(0);
    Object.values(room.votes).forEach((v) => tally[v]++);
    return {
      code: room.code,
      you: playerId,
      now: Date.now(),
      phase: room.phase,
      phaseEnd: room.phaseEnd,
      isPublic: room.isPublic,
      practice: room.practice,
      size: room.size,
      mapId: room.mapId,
      round: room.round,
      score: room.score,
      hostId: room.hostId,
      votes: tally,
      myVote: room.votes[playerId] ?? -1,
      players: room.players,
      events: room.events.filter((e) => e.seq > since),
      seq: room.seq,
      lobbyEnd: room.lobbyEnd,
    };
  }

  processSync(body: SyncBody) {
    const room = this.room;
    if (!room) return;
    const me = room.players.find((p) => p.id === body.id);
    if (!me) return;
    me.seen = Date.now();
    const isHost = room.hostId === me.id;
    if (body.st && (room.phase === "playing" || room.phase === "roundEnd" || room.phase === "loadout")) {
      const s = body.st;
      Object.assign(me, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, anim: s.anim, weapon: s.weapon });
    }
    if (isHost && body.bots) {
      for (const b of body.bots) {
        const bp = room.players.find((p) => p.id === b.id && p.bot);
        if (bp) Object.assign(bp, { x: b.x, y: b.y, z: b.z, yaw: b.yaw, pitch: b.pitch, anim: b.anim });
      }
    }
    if (body.loadout && (room.phase === "lobby" || room.phase === "vote" || room.phase === "loadout")) {
      room.loadouts[me.id] = body.loadout;
    }
    if (body.vote !== undefined && room.phase === "vote" && body.vote >= 0 && body.vote <= 2) {
      room.votes[me.id] = body.vote;
    }
    for (const h of (body.hits ?? []).slice(0, 20)) {
      if (h.by === me.id || (isHost && h.by.startsWith("bot-"))) this.applyHit(room, h);
    }
    for (const s of (body.shots ?? []).slice(0, 20)) {
      if (s.by === me.id || (isHost && s.by.startsWith("bot-"))) {
        this.pushEv(room, { t: "shot", by: s.by, from: s.from, to: s.to, w: s.w });
      }
    }
  }

  handleAction(action: string, id: string) {
    const room = this.room;
    if (!room) {
      if (this.clientConn && this.clientConn.open) {
        this.clientConn.send({ type: "act", action, id });
      }
      return;
    }
    if (action === "start" && room.hostId === id && room.phase === "lobby") {
      this.fillBots(room);
      this.startVote(room);
    } else if (action === "team" && room.phase === "lobby") {
      const p = room.players.find((x) => x.id === id);
      if (!p) return;
      const nt = p.team === 0 ? 1 : 0;
      if (room.players.filter((x) => x.team === nt).length >= room.size) return;
      const used = new Set(room.players.filter((x) => x.team === nt).map((x) => x.spawn));
      let s = 0;
      while (used.has(s)) s++;
      p.team = nt;
      p.spawn = s;
    } else if (action === "leave") {
      room.players = room.players.filter((x) => x.id !== id);
    }
  }
  private bindHostPeer(peer: PeerInstance, room: HostRoom) {
    peer.on("connection", (rawConn) => {
      const conn = rawConn as PeerConn;
      this.conns.set(conn.peer, conn);
      conn.on("data", (raw) => {
        const msg = raw as Record<string, unknown>;
        if (msg.type === "hello") {
          const humans = room.players.filter((p) => !p.bot);
          if (room.phase !== "lobby") {
            conn.send({ type: "err", msg: "La partida ya inició" });
            return;
          }
          if (humans.length >= room.size * 2) {
            conn.send({ type: "err", msg: "Sala llena" });
            return;
          }
          const p = this.addPlayer(room, String(msg.name || "Jugador"), false);
          if (!p) {
            conn.send({ type: "err", msg: "Sala llena" });
            return;
          }
          this.connToPlayer.set(conn.peer, p.id);
          if (room.isPublic && room.lobbyEnd - Date.now() < 2500) room.lobbyEnd = Date.now() + 2500;
          conn.send({ type: "welcome", id: p.id, snap: this.buildSnap(room, p.id, 0) });
        } else if (msg.type === "sync" && msg.body) {
          this.processSync(msg.body as SyncBody);
        } else if (msg.type === "act") {
          this.handleAction(String(msg.action), String(msg.id));
        }
      });
      conn.on("close", () => {
        const pid = this.connToPlayer.get(conn.peer);
        if (pid) {
          room.players = room.players.filter((p) => p.id !== pid);
          this.connToPlayer.delete(conn.peer);
        }
        this.conns.delete(conn.peer);
      });
    });
  }

  async startSession(opts: { action: string; name: string; size: number; code?: string }): Promise<{ error?: string; code?: string; id?: string }> {
    this.reset();
    const name = (opts.name || "Jugador").trim().slice(0, 14) || "Jugador";
    const size = Math.max(1, Math.min(4, Number(opts.size) || 2));
    const zeroScore = () => new Array<number>(2).fill(0) as [number, number];

    if (opts.action === "practice") {
      const code = genCode();
      const room: HostRoom = {
        code, peerId: "", isPublic: false, practice: true, size, lobbyEnd: 0,
        hostId: "", players: [], loadouts: {}, phase: "lobby", phaseEnd: 0,
        mapId: Math.floor(Math.random() * 3), votes: {}, round: 1, score: zeroScore(), events: [], seq: 0,
      };
      const me = this.addPlayer(room, name, false, 0)!;
      room.hostId = me.id;
      this.fillBots(room);
      this.startLoadout(room);
      this.room = room;
      this.myId = me.id;
      this.lastSnap = this.buildSnap(room, me.id, 0);
      return { code, id: me.id };
    }

    let PeerCtor: new (id?: string) => PeerInstance;
    try { PeerCtor = await loadPeerJS(); } catch { return { error: "No se pudo conectar al servicio P2P" }; }

    if (opts.action === "create") {
      return new Promise((resolve) => {
        const tryCreate = (tries: number) => {
          const code = genCode();
          const peerId = PREFIX + code;
          const peer = new PeerCtor(peerId);
          peer.on("open", () => {
            this.peer = peer;
            const room: HostRoom = {
              code, peerId, isPublic: false, practice: false, size, lobbyEnd: 0,
              hostId: "", players: [], loadouts: {}, phase: "lobby", phaseEnd: 0,
              mapId: null, votes: {}, round: 1, score: zeroScore(), events: [], seq: 0,
            };
            const me = this.addPlayer(room, name, false, 0)!;
            room.hostId = me.id;
            this.room = room;
            this.myId = me.id;
            this.lastSnap = this.buildSnap(room, me.id, 0);
            this.bindHostPeer(peer, room);
            resolve({ code, id: me.id });
          });
          peer.on("error", () => {
            try { peer.destroy(); } catch {}
            if (tries > 0) tryCreate(tries - 1);
            else resolve({ error: "No se pudo crear la sala" });
          });
        };
        tryCreate(4);
      });
    }

    if (opts.action === "join") {
      const code = (opts.code || "").toUpperCase().trim();
      if (code.length < 4) return { error: "Código inválido" };
      return this.connectAsClient(PeerCtor, PREFIX + code, code, name, 6500);
    }

    if (opts.action === "public") {
      for (let slot = 0; slot < 3; slot++) {
        const pubPeerId = PREFIX + "PUB-" + size + "-" + slot;
        const joined = await this.connectAsClient(PeerCtor, pubPeerId, "P" + size + "0" + slot, name, 2200);
        if (!joined.error) return joined;
      }
      for (let slot = 0; slot < 3; slot++) {
        const pubPeerId = PREFIX + "PUB-" + size + "-" + slot;
        const created = await new Promise<{ error?: string; code?: string; id?: string }>((resolve) => {
          const peer = new PeerCtor(pubPeerId);
          peer.on("open", () => {
            this.peer = peer;
            const code = "P" + size + "0" + slot;
            const room: HostRoom = {
              code, peerId: pubPeerId, isPublic: true, practice: false, size,
              lobbyEnd: Date.now() + PUBLIC_WAIT, hostId: "", players: [], loadouts: {},
              phase: "lobby", phaseEnd: 0, mapId: null, votes: {}, round: 1, score: zeroScore(), events: [], seq: 0,
            };
            const me = this.addPlayer(room, name, false, 0)!;
            room.hostId = me.id;
            this.room = room;
            this.myId = me.id;
            this.lastSnap = this.buildSnap(room, me.id, 0);
            this.bindHostPeer(peer, room);
            resolve({ code, id: me.id });
          });
          peer.on("error", () => { try { peer.destroy(); } catch {} resolve({ error: "occupied" }); });
        });
        if (!created.error) return created;
      }
      return { error: "Salas públicas ocupadas" };
    }
    return { error: "Acción no válida" };
  }
  private connectAsClient(
    PeerCtor: new (id?: string) => PeerInstance,
    targetPeerId: string,
    code: string,
    name: string,
    timeoutMs: number,
  ): Promise<{ error?: string; code?: string; id?: string }> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (res: { error?: string; code?: string; id?: string }) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (res.error) this.reset();
        resolve(res);
      };
      const peer = new PeerCtor();
      const timer = setTimeout(() => finish({ error: "Código no encontrado o sala llena" }), timeoutMs);
      peer.on("open", () => {
        this.peer = peer;
        const conn = peer.connect(targetPeerId, { reliable: true });
        this.clientConn = conn;
        conn.on("open", () => conn.send({ type: "hello", name }));
        conn.on("data", (raw) => {
          const msg = raw as Record<string, unknown>;
          if (msg.type === "welcome") {
            this.myId = String(msg.id);
            this.lastSnap = msg.snap as Snapshot;
            finish({ code, id: this.myId });
          } else if (msg.type === "err") finish({ error: String(msg.msg || "No se pudo entrar") });
          else if (msg.type === "snap" && msg.snap) {
            this.lastSnap = msg.snap as Snapshot;
            this.activeNet?.receiveRemoteSnap(msg.snap as Snapshot);
          }
        });
        conn.on("close", () => {
          this.activeNet?.onError?.("El anfitrión cerró la sala");
          this.activeNet?.stop(false);
        });
        conn.on("error", () => finish({ error: "No se pudo conectar con la sala" }));
      });
      peer.on("error", () => finish({ error: "Código no encontrado" }));
    });
  }
}

export const p2p = new P2PManager();

export class Net {
  code: string;
  id: string;
  snap: Snapshot | null = null;
  loadout: Loadout = { ...DEFAULT_LOADOUT };
  offset = 0;
  lastSeq = 0;
  hits: HitReport[] = [];
  shots: ShotReport[] = [];
  vote: number | undefined;
  loadoutDirty = true;
  stateProvider: (() => StateReport | undefined) | null = null;
  botsProvider: (() => StateReport[] | undefined) | null = null;
  onSnap: ((s: Snapshot) => void) | null = null;
  evListeners: ((e: NetEvent[]) => void)[] = [];
  onError: ((m: string) => void) | null = null;
  timer: ReturnType<typeof setInterval> | null = null;
  seenSeq = new Set<number>();
  stopped = false;

  constructor(code: string, id: string) {
    this.code = code;
    this.id = id;
    p2p.activeNet = this;
  }

  start() {
    this.stopped = false;
    if (this.timer) clearInterval(this.timer);
    if (p2p.lastSnap) this.receiveRemoteSnap(p2p.lastSnap);
    this.tick();
    this.timer = setInterval(() => this.tick(), 50);
  }

  stop(leave = true) {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (leave) p2p.reset();
  }

  leaveNow() {
    p2p.handleAction("leave", this.id);
    this.stop(true);
  }

  addEvents(fn: (e: NetEvent[]) => void) {
    this.evListeners.push(fn);
    return () => { this.evListeners = this.evListeners.filter((f) => f !== fn); };
  }

  now() { return Date.now() + this.offset; }
  remaining() { return !this.snap || !this.snap.phaseEnd ? 0 : Math.max(0, this.snap.phaseEnd - this.now()); }
  setVote(v: number) { this.vote = v; if (this.snap) this.snap.myVote = v; }
  setLoadout(l: Loadout) { this.loadout = l; this.loadoutDirty = true; }

  receiveRemoteSnap(snap: Snapshot) {
    if (this.stopped) return;
    this.offset = snap.now - Date.now();
    const evs = snap.events.filter((e) => !this.seenSeq.has(e.seq));
    evs.forEach((e) => this.seenSeq.add(e.seq));
    if (snap.seq > this.lastSeq) this.lastSeq = snap.seq;
    this.snap = snap;
    this.onSnap?.(snap);
    if (evs.length) this.evListeners.forEach((f) => f(evs));
  }

  tick() {
    if (this.stopped) return;
    const hits = this.hits;
    const shots = this.shots;
    this.hits = [];
    this.shots = [];
    const body: SyncBody = {
      code: this.code, id: this.id, since: this.lastSeq,
      st: this.stateProvider?.(), bots: this.botsProvider?.(), hits, shots,
    };
    if (this.vote !== undefined) body.vote = this.vote;
    if (this.loadoutDirty) { body.loadout = this.loadout; this.loadoutDirty = false; }

    if (p2p.room) {
      p2p.processSync(body);
      p2p.hostTick(p2p.room);
      this.receiveRemoteSnap(p2p.buildSnap(p2p.room, this.id, this.lastSeq));
      p2p.conns.forEach((conn, peerKey) => {
        const pid = p2p.connToPlayer.get(peerKey);
        if (pid && conn.open) conn.send({ type: "snap", snap: p2p.buildSnap(p2p.room!, pid, Math.max(0, p2p.room!.seq - 25)) });
      });
    } else if (p2p.clientConn && p2p.clientConn.open) {
      p2p.clientConn.send({ type: "sync", body });
    }
  }
}
