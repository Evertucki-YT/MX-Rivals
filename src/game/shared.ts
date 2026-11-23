// Tipos y datos compartidos entre cliente y servidor — MX RIVALS (Creado por: Ever Baruc)

export type WeaponId = "rifle" | "sniper" | "shotgun" | "revolver" | "uzi" | "katana" | "machete";
export type Slot = 0 | 1 | 2;

export interface WeaponDef {
  id: WeaponId;
  name: string;
  slot: Slot;
  desc: string;
  melee: boolean;
  dmg: number; // daño por proyectil al cuerpo
  head: number; // multiplicador a la cabeza
  pellets: number;
  rpm: number;
  mag: number;
  reload: number; // segundos
  spread: number; // radianes
  auto: boolean;
  recoil: number;
  range: number;
  zoom: number; // fov al apuntar
  speed: number; // multiplicador de velocidad
  color: string;
  icon: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rifle: { id: "rifle", name: "Rifle de Asalto", slot: 0, desc: "Automático y equilibrado. Excelente a media distancia.", melee: false, dmg: 19, head: 1.7, pellets: 1, rpm: 600, mag: 30, reload: 1.7, spread: 0.014, auto: true, recoil: 0.9, range: 200, zoom: 66, speed: 1, color: "#22c55e", icon: "🔫" },
  sniper: { id: "sniper", name: "Francotirador", slot: 0, desc: "Un tiro a la cabeza elimina. Clic derecho para zoom.", melee: false, dmg: 72, head: 2.2, pellets: 1, rpm: 52, mag: 5, reload: 2.4, spread: 0.05, auto: false, recoil: 3.2, range: 400, zoom: 20, speed: 0.92, color: "#38bdf8", icon: "🎯" },
  shotgun: { id: "shotgun", name: "Escopeta", slot: 0, desc: "Devastadora de cerca. 8 perdigones por disparo.", melee: false, dmg: 12.5, head: 1.4, pellets: 8, rpm: 75, mag: 6, reload: 2.3, spread: 0.065, auto: false, recoil: 3.6, range: 60, zoom: 70, speed: 1, color: "#f97316", icon: "💥" },
  revolver: { id: "revolver", name: "Revólver", slot: 1, desc: "Alto daño y muy preciso. Cabeza = casi muerte.", melee: false, dmg: 46, head: 2.1, pellets: 1, rpm: 150, mag: 6, reload: 1.9, spread: 0.006, auto: false, recoil: 2.4, range: 200, zoom: 62, speed: 1.02, color: "#eab308", icon: "🤠" },
  uzi: { id: "uzi", name: "Subfusil Uzi", slot: 1, desc: "Disparo ultra rápido. Ideal para correr y disparar.", melee: false, dmg: 10.5, head: 1.5, pellets: 1, rpm: 900, mag: 32, reload: 1.4, spread: 0.04, auto: true, recoil: 0.5, range: 120, zoom: 70, speed: 1.04, color: "#a855f7", icon: "⚡" },
  katana: { id: "katana", name: "Katana", slot: 2, desc: "Corres más rápido. Clic derecho: DASH hacia adelante.", melee: true, dmg: 58, head: 1, pellets: 1, rpm: 130, mag: 0, reload: 0, spread: 0, auto: false, recoil: 0, range: 2.9, zoom: 78, speed: 1.28, color: "#ef4444", icon: "⚔️" },
  machete: { id: "machete", name: "Machete Táctico", slot: 2, desc: "Ataque cuerpo a cuerpo veloz y brutal.", melee: true, dmg: 42, head: 1, pellets: 1, rpm: 220, mag: 0, reload: 0, spread: 0, auto: true, recoil: 0, range: 2.6, zoom: 78, speed: 1.12, color: "#14b8a6", icon: "🔪" },
};

export const PRIMARY: WeaponId[] = ["rifle", "sniper", "shotgun"];
export const SECONDARY: WeaponId[] = ["revolver", "uzi"];
export const MELEE: WeaponId[] = ["katana", "machete"];

export interface Loadout {
  primary: WeaponId;
  secondary: WeaponId;
  melee: WeaponId;
}
export const DEFAULT_LOADOUT: Loadout = { primary: "rifle", secondary: "revolver", melee: "katana" };

export const MAPS = [
  { id: 0, name: "EL OXXO DE LA ESQUINA", sub: "Estacionamiento al atardecer", emoji: "🏪", grad: "linear-gradient(135deg,#dc2626,#facc15 60%,#7c3aed)", desc: "Fachada roja y amarilla, autos de cobertura, puesto de tacos y rampas al techo." },
  { id: 1, name: "GASOLINERA PEMEX", sub: "Estación de servicio", emoji: "⛽", grad: "linear-gradient(135deg,#15803d,#f8fafc 55%,#dc2626)", desc: "Techo gigante, islas con bombas, tambos, taller abierto y pasarelas elevadas." },
  { id: 2, name: "LA CANCHA DEL BARRIO", sub: "Fútbol rápido y azoteas", emoji: "⚽", grad: "linear-gradient(135deg,#16a34a,#f472b6 55%,#38bdf8)", desc: "Casas de colores, porterías, escaleras a azoteas con tinacos y tanques de gas." },
];

export const TEAM_NAMES = ["VERDE", "ROJO"];
export const TEAM_COLORS = ["#22c55e", "#ef4444"];
export const ROUNDS_TO_WIN = 3;
export const LOADOUT_MS = 8000;
export const ROUND_MS = 120000;
export const MAX_HP = 100;

export type Phase = "lobby" | "vote" | "loadout" | "playing" | "roundEnd" | "matchEnd";

export interface NetPlayer {
  id: string;
  name: string;
  team: 0 | 1;
  bot: boolean;
  spawn: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  anim: number; // 0 idle 1 run 2 slide 3 air
  weapon: WeaponId;
  hp: number;
  alive: boolean;
  kills: number;
  deaths: number;
  seen: number;
}

export type NetEvent =
  | { seq: number; t: "shot"; by: string; from: [number, number, number]; to: [number, number, number]; w: WeaponId }
  | { seq: number; t: "kill"; killer: string; victim: string; w: WeaponId; head: boolean }
  | { seq: number; t: "round"; winner: number; score: [number, number] }
  | { seq: number; t: "go" }
  | { seq: number; t: "msg"; text: string };

export interface Snapshot {
  code: string;
  you: string;
  now: number;
  phase: Phase;
  phaseEnd: number;
  isPublic: boolean;
  practice: boolean;
  size: number;
  mapId: number | null;
  round: number;
  score: [number, number];
  hostId: string;
  votes: number[];
  myVote: number;
  players: NetPlayer[];
  events: NetEvent[];
  seq: number;
  lobbyEnd: number;
}

export interface HitReport {
  by: string;
  target: string;
  dmg: number;
  head: boolean;
  w: WeaponId;
}
export interface ShotReport {
  by: string;
  from: [number, number, number];
  to: [number, number, number];
  w: WeaponId;
}
export interface StateReport {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  anim: number;
  weapon: WeaponId;
}
export interface SyncBody {
  code: string;
  id: string;
  since: number;
  st?: StateReport;
  bots?: StateReport[];
  hits?: HitReport[];
  shots?: ShotReport[];
  loadout?: Loadout;
  vote?: number;
}
