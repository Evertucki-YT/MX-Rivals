import {
  DEFAULT_LOADOUT,
  LOADOUT_MS,
  MAX_HP,
  ROUNDS_TO_WIN,
  ROUND_MS,
  type HitReport,
  type Loadout,
  type NetEvent,
  type NetPlayer,
  type Phase,
  type Snapshot,
  type SyncBody,
  type WeaponId,
} from "@/game/shared";

interface Room {
  code: string;
  isPublic: boolean;
  practice: boolean;
  size: number;
  createdAt: number;
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

const g = globalThis as unknown as { __mxRooms?: Map<string, Room> };
const rooms: Map<string, Room> = (g.__mxRooms ??= new Map());

const BOT_NAMES = ["El Chavo", "Don Beto", "La Catrina", "Chuy", "Lupita", "Memo", "Toño", "Paco", "Yadira", "Chente", "El Compa", "Nacho", "Panchito", "Güero", "Tacoman", "La Morra", "Jimmy", "Chela", "Rigo", "Maribel"];
const BOT_WEAPONS: WeaponId[] = ["rifle", "rifle", "uzi", "shotgun", "revolver"];
const PUBLIC_WAIT = 6000;

const uid = () => Math.random().toString(36).slice(2, 10);
function genCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    let c = "";
    for (let i = 0; i < 4; i++) c += abc[Math.floor(Math.random() * abc.length)];
    if (!rooms.has(c)) return c;
  }
}

function push(room: Room, ev: Omit<NetEvent, "seq"> & Record<string, unknown>) {
  room.seq++;
  room.events.push({ ...ev, seq: room.seq } as NetEvent);
  if (room.events.length > 120) room.events.splice(0, room.events.length - 120);
}

const humans = (r: Room) => r.players.filter((p) => !p.bot);
const teamCount = (r: Room, t: number) => r.players.filter((p) => p.team === t).length;

function addPlayer(room: Room, name: string, bot: boolean, pref?: 0 | 1): NetPlayer | null {
  let team: 0 | 1 = pref ?? (teamCount(room, 0) <= teamCount(room, 1) ? 0 : 1);
  if (teamCount(room, team) >= room.size) team = team === 0 ? 1 : 0;
  if (teamCount(room, team) >= room.size) return null;
  const used = new Set(room.players.filter((p) => p.team === team).map((p) => p.spawn));
  let spawn = 0;
  while (used.has(spawn)) spawn++;
  const p: NetPlayer = {
    id: (bot ? "bot-" : "") + uid(),
    name: name.slice(0, 14) || "Jugador",
    team,
    bot,
    spawn,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    anim: 0,
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

function fillBots(room: Room) {
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const used = new Set(room.players.map((p) => p.name));
  for (const t of [0, 1] as const) {
    while (teamCount(room, t) < room.size) {
      const n = names.find((x) => !used.has(x)) ?? "Bot" + Math.floor(Math.random() * 99);
      used.add(n);
      if (!addPlayer(room, n, true, t)) break;
    }
  }
}

function setPhase(room: Room, phase: Phase, ms: number) {
  room.phase = phase;
  room.phaseEnd = ms ? Date.now() + ms : 0;
}

function startLoadout(room: Room) {
  for (const p of room.players) {
    p.hp = MAX_HP;
    p.alive = true;
  }
  setPhase(room, "loadout", LOADOUT_MS);
  push(room, { t: "msg", text: `Ronda ${room.round}` });
}

function createRoom(isPublic: boolean, practice: boolean, size: number): Room {
  const now = Date.now();
  const room: Room = {
    code: genCode(),
    isPublic,
    practice,
    size: Math.max(1, Math.min(4, size)),
    createdAt: now,
    lobbyEnd: now + PUBLIC_WAIT,
    hostId: "",
    players: [],
    loadouts: {},
    phase: "lobby",
    phaseEnd: 0,
    mapId: null,
    votes: {},
    round: 1,
    score: [0, 0],
    events: [],
    seq: 0,
  };
  rooms.set(room.code, room);
  return room;
}

function gc() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    room.players = room.players.filter((p) => p.bot || now - p.seen < 7000);
    const hs = humans(room);
    if (hs.length === 0 || (room.phase === "matchEnd" && now - room.phaseEnd > 120000)) {
      rooms.delete(code);
      continue;
    }
    if (!hs.find((h) => h.id === room.hostId)) room.hostId = hs[0].id;
  }
}

export type ApiResult = { error: string } | { code: string; id: string };

export function roomAction(body: {
  action: string;
  name?: string;
  size?: number;
  code?: string;
  id?: string;
}): ApiResult | { ok: true } {
  gc();
  const name = (body.name ?? "").trim() || "Jugador";
  const size = Math.max(1, Math.min(4, Number(body.size) || 2));
  switch (body.action) {
    case "public": {
      let room = [...rooms.values()].find(
        (r) => r.isPublic && r.phase === "lobby" && r.size === size && humans(r).length < r.size * 2 && Date.now() < r.lobbyEnd + 1500,
      );
      if (!room) room = createRoom(true, false, size);
      const p = addPlayer(room, name, false);
      if (!p) return { error: "Sala llena" };
      if (!room.hostId) room.hostId = p.id;
      if (room.lobbyEnd - Date.now() < 2500) room.lobbyEnd = Date.now() + 2500;
      return { code: room.code, id: p.id };
    }
    case "practice": {
      const room = createRoom(false, true, size);
      const p = addPlayer(room, name, false, 0)!;
      room.hostId = p.id;
      fillBots(room);
      room.mapId = Math.floor(Math.random() * 3);
      startLoadout(room);
      return { code: room.code, id: p.id };
    }
    case "create": {
      const room = createRoom(false, false, size);
      const p = addPlayer(room, name, false, 0)!;
      room.hostId = p.id;
      return { code: room.code, id: p.id };
    }
    case "join": {
      const room = rooms.get((body.code ?? "").toUpperCase().trim());
      if (!room) return { error: "Código no encontrado" };
      if (room.phase !== "lobby") return { error: "La partida ya inició" };
      if (humans(room).length >= room.size * 2) return { error: "Sala llena" };
      const p = addPlayer(room, name, false);
      if (!p) return { error: "Sala llena" };
      return { code: room.code, id: p.id };
    }
    case "leave": {
      const room = rooms.get(body.code ?? "");
      if (room) {
        room.players = room.players.filter((p) => p.id !== body.id);
        gc();
      }
      return { ok: true };
    }
    case "start": {
      const room = rooms.get(body.code ?? "");
      if (!room || room.hostId !== body.id || room.phase !== "lobby") return { error: "No permitido" };
      fillBots(room);
      startVote(room);
      return { ok: true };
    }
    case "team": {
      const room = rooms.get(body.code ?? "");
      const p = room?.players.find((x) => x.id === body.id);
      if (!room || !p || room.phase !== "lobby") return { error: "No permitido" };
      const nt = p.team === 0 ? 1 : 0;
      if (teamCount(room, nt) >= room.size) return { error: "Equipo lleno" };
      const used = new Set(room.players.filter((x) => x.team === nt).map((x) => x.spawn));
      let s = 0;
      while (used.has(s)) s++;
      p.team = nt;
      p.spawn = s;
      return { ok: true };
    }
  }
  return { error: "Acción inválida" };
}

function startVote(room: Room) {
  room.votes = {};
  setPhase(room, "vote", 10000);
}

function alive(room: Room, t: number) {
  return room.players.filter((p) => p.team === t && p.alive).length;
}

function endRound(room: Room, winner: number) {
  room.score[winner]++;
  push(room, { t: "round", winner, score: [...room.score] as [number, number] });
  setPhase(room, "roundEnd", 3800);
}

function tick(room: Room) {
  const now = Date.now();
  switch (room.phase) {
    case "lobby":
      if (room.isPublic && (humans(room).length >= room.size * 2 || now >= room.lobbyEnd)) {
        fillBots(room);
        startVote(room);
      }
      break;
    case "vote": {
      const hs = humans(room);
      const allVoted = hs.length > 0 && hs.every((h) => room.votes[h.id] !== undefined);
      if (now >= room.phaseEnd || (allVoted && now >= room.phaseEnd - 7000)) {
        const tally = [0, 0, 0];
        Object.values(room.votes).forEach((v) => tally[v]++);
        const max = Math.max(...tally);
        const best = tally.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
        room.mapId = best[Math.floor(Math.random() * best.length)];
        room.round = 1;
        startLoadout(room);
      }
      break;
    }
    case "loadout":
      if (now >= room.phaseEnd) {
        setPhase(room, "playing", ROUND_MS);
        push(room, { t: "go" });
      }
      break;
    case "playing": {
      const a0 = alive(room, 0);
      const a1 = alive(room, 1);
      if (a0 === 0 || a1 === 0) endRound(room, a0 === 0 && a1 === 0 ? Math.round(Math.random()) : a0 > 0 ? 0 : 1);
      else if (now >= room.phaseEnd) {
        const hp = (t: number) => room.players.filter((p) => p.team === t).reduce((s, p) => s + (p.alive ? p.hp : 0), 0);
        const h0 = hp(0);
        const h1 = hp(1);
        endRound(room, h0 === h1 ? Math.round(Math.random()) : h0 > h1 ? 0 : 1);
      }
      break;
    }
    case "roundEnd":
      if (now >= room.phaseEnd) {
        if (room.score[0] >= ROUNDS_TO_WIN || room.score[1] >= ROUNDS_TO_WIN) setPhase(room, "matchEnd", 0), (room.phaseEnd = now);
        else {
          room.round++;
          startLoadout(room);
        }
      }
      break;
  }
}

function applyHit(room: Room, h: HitReport) {
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
    push(room, { t: "kill", killer: by.id, victim: tg.id, w: h.w, head: !!h.head });
  }
}

export function syncRoom(body: SyncBody): Snapshot | { error: string } {
  gc();
  const room = rooms.get(body.code);
  if (!room) return { error: "La sala ya no existe" };
  const me = room.players.find((p) => p.id === body.id);
  if (!me) return { error: "Fuiste desconectado de la sala" };
  const now = Date.now();
  me.seen = now;
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
  if (body.vote !== undefined && room.phase === "vote" && body.vote >= 0 && body.vote <= 2) room.votes[me.id] = body.vote;

  for (const h of (body.hits ?? []).slice(0, 20)) {
    const okBy = h.by === me.id || (isHost && h.by.startsWith("bot-"));
    if (okBy) applyHit(room, h);
  }
  for (const s of (body.shots ?? []).slice(0, 20)) {
    const okBy = s.by === me.id || (isHost && s.by.startsWith("bot-"));
    if (okBy) push(room, { t: "shot", by: s.by, from: s.from, to: s.to, w: s.w });
  }
  tick(room);

  const tally = [0, 0, 0];
  Object.values(room.votes).forEach((v) => tally[v]++);
  return {
    code: room.code,
    you: me.id,
    now,
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
    myVote: room.votes[me.id] ?? -1,
    players: room.players,
    events: room.events.filter((e) => e.seq > body.since),
    seq: room.seq,
    lobbyEnd: room.lobbyEnd,
  };
}
