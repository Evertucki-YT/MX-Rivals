import type { HitReport, Loadout, NetEvent, ShotReport, Snapshot, StateReport, SyncBody } from "./shared";
import { DEFAULT_LOADOUT } from "./shared";

export class Net {
  code: string;
  id: string;
  snap: Snapshot | null = null;
  loadout: Loadout = { ...DEFAULT_LOADOUT };
  offset = 0;
  lastSeq = 0;
  inflight = false;
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
  }

  leaveTimer: ReturnType<typeof setTimeout> | null = null;

  start() {
    this.stopped = false;
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    if (this.timer) clearInterval(this.timer);
    this.tick();
    this.timer = setInterval(() => this.tick(), 66);
  }

  stop(leave = true) {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (leave) {
      this.leaveTimer = setTimeout(() => {
        try {
          const blob = new Blob([JSON.stringify({ action: "leave", code: this.code, id: this.id })], { type: "application/json" });
          navigator.sendBeacon("/api/rooms", blob);
        } catch {
          /* ignore */
        }
      }, 600);
    }
  }

  leaveNow() {
    this.stop(false);
    try {
      const blob = new Blob([JSON.stringify({ action: "leave", code: this.code, id: this.id })], { type: "application/json" });
      navigator.sendBeacon("/api/rooms", blob);
    } catch {
      /* ignore */
    }
  }

  addEvents(fn: (e: NetEvent[]) => void) {
    this.evListeners.push(fn);
    return () => {
      this.evListeners = this.evListeners.filter((f) => f !== fn);
    };
  }

  now() {
    return Date.now() + this.offset;
  }

  remaining() {
    if (!this.snap || !this.snap.phaseEnd) return 0;
    return Math.max(0, this.snap.phaseEnd - this.now());
  }

  setVote(v: number) {
    this.vote = v;
    if (this.snap) this.snap.myVote = v;
  }

  setLoadout(l: Loadout) {
    this.loadout = l;
    this.loadoutDirty = true;
  }

  async tick() {
    if (this.inflight || this.stopped) return;
    this.inflight = true;
    const hits = this.hits;
    const shots = this.shots;
    this.hits = [];
    this.shots = [];
    const body: SyncBody = {
      code: this.code,
      id: this.id,
      since: this.lastSeq,
      st: this.stateProvider?.(),
      bots: this.botsProvider?.(),
      hits,
      shots,
    };
    if (this.vote !== undefined) body.vote = this.vote;
    if (this.loadoutDirty) {
      body.loadout = this.loadout;
      this.loadoutDirty = false;
    }
    try {
      const res = await fetch("/api/game/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || data.error) {
        this.onError?.(data.error ?? "Error de conexión");
        this.stop(false);
        return;
      }
      const snap = data as Snapshot;
      this.offset = snap.now - Date.now();
      const evs = snap.events.filter((e) => !this.seenSeq.has(e.seq));
      evs.forEach((e) => this.seenSeq.add(e.seq));
      this.lastSeq = snap.seq;
      this.snap = snap;
      this.onSnap?.(snap);
      if (evs.length) this.evListeners.forEach((f) => f(evs));
    } catch {
      this.hits = hits.concat(this.hits);
      this.shots = shots.concat(this.shots);
    } finally {
      this.inflight = false;
    }
  }
}
