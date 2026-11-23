"use client";

import { MELEE, PRIMARY, SECONDARY, TEAM_COLORS, TEAM_NAMES, WEAPONS, type Loadout, type NetPlayer, type Snapshot, type WeaponId } from "@/game/shared";
import type { HudState } from "@/game/engine";
import type { Net } from "@/game/net";

export interface FeedItem {
  id: number;
  killer: string;
  kteam: number;
  victim: string;
  vteam: number;
  w: WeaponId;
  head: boolean;
}

export const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function Bar({ v, color }: { v: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
      <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, v))}%`, background: color }} />
    </div>
  );
}

function WeaponCard({ id, selected, onPick, teamColor }: { id: WeaponId; selected: boolean; onPick: () => void; teamColor: string }) {
  const w = WEAPONS[id];
  const dmg = w.melee ? w.dmg : Math.min(100, ((w.dmg * w.pellets) / 80) * 100);
  const rate = Math.min(100, (w.rpm / 900) * 100);
  const rng = w.melee ? w.speed * 70 : Math.min(100, (w.range / 300) * 100 + 12);
  return (
    <button
      onClick={onPick}
      className="mx-card rounded-2xl border-2 p-3 text-left"
      style={{
        borderColor: selected ? teamColor : "rgba(255,255,255,0.15)",
        background: selected ? `linear-gradient(160deg, ${teamColor}55, rgba(15,23,42,0.9))` : "rgba(15,23,42,0.8)",
        boxShadow: selected ? `0 0 26px ${teamColor}99` : "none",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-11 w-11 place-items-center rounded-xl text-2xl" style={{ background: w.color + "33", border: `2px solid ${w.color}` }}>
          {w.icon}
        </span>
        <div className="flex-1">
          <div className="text-[15px] font-black leading-tight text-white">{w.name}</div>
          {selected && <div className="text-[10px] font-extrabold tracking-widest" style={{ color: teamColor }}>✔ EQUIPADA</div>}
        </div>
      </div>
      <p className="mt-2 min-h-[2.4rem] text-[11.5px] font-medium leading-snug text-white/70">{w.desc}</p>
      <div className="mt-1 grid gap-1 text-[9px] font-bold uppercase tracking-wider text-white/50">
        <div>Daño<Bar v={dmg} color={w.color} /></div>
        <div>Cadencia<Bar v={rate} color={w.color} /></div>
        <div>{w.melee ? "Velocidad" : "Alcance"}<Bar v={rng} color={w.color} /></div>
      </div>
    </button>
  );
}

export function LoadoutPanel({ loadout, onChange, onReady, ready, remaining, round, team }: { loadout: Loadout; onChange: (l: Loadout) => void; onReady: () => void; ready: boolean; remaining: number; round: number; team: number }) {
  const tc = TEAM_COLORS[team];
  const secs = Math.ceil(remaining / 1000);
  if (ready)
    return (
      <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 rounded-2xl border-2 border-white/25 bg-black/60 px-6 py-3 text-center backdrop-blur">
        <div className="text-xs font-bold tracking-widest text-white/60">EQUIPAMIENTO LISTO</div>
        <div className="text-4xl font-black text-white">{secs}</div>
        <div className="text-xs font-semibold text-white/60">{WEAPONS[loadout.primary].name} • {WEAPONS[loadout.secondary].name} • {WEAPONS[loadout.melee].name}</div>
      </div>
    );
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold tracking-[0.3em] text-white/60">RONDA {round}</div>
            <h2 className="text-2xl font-black text-white sm:text-4xl">ELIGE TU EQUIPAMIENTO</h2>
            <div className="text-sm font-bold" style={{ color: tc }}>Equipo {TEAM_NAMES[team]}</div>
          </div>
          <div className="grid h-20 w-20 place-items-center rounded-full border-[6px] text-4xl font-black text-white sm:h-24 sm:w-24 sm:text-5xl" style={{ borderColor: secs <= 3 ? "#ef4444" : tc, boxShadow: `0 0 30px ${secs <= 3 ? "#ef4444" : tc}` }}>
            {secs}
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <div className="mb-2 text-xs font-black tracking-widest text-white/70">ARMA PRINCIPAL <span className="text-white/40">(1)</span></div>
            <div className="grid gap-2">
              {PRIMARY.map((id) => <WeaponCard key={id} id={id} teamColor={tc} selected={loadout.primary === id} onPick={() => onChange({ ...loadout, primary: id })} />)}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-black tracking-widest text-white/70">ARMA SECUNDARIA <span className="text-white/40">(2)</span></div>
            <div className="grid gap-2">
              {SECONDARY.map((id) => <WeaponCard key={id} id={id} teamColor={tc} selected={loadout.secondary === id} onPick={() => onChange({ ...loadout, secondary: id })} />)}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-black tracking-widest text-white/70">CUERPO A CUERPO <span className="text-white/40">(3)</span></div>
            <div className="grid gap-2">
              {MELEE.map((id) => <WeaponCard key={id} id={id} teamColor={tc} selected={loadout.melee === id} onPick={() => onChange({ ...loadout, melee: id })} />)}
            </div>
            <button onClick={onReady} className="mx-btn mt-4 w-full bg-gradient-to-r from-green-600 to-green-500 text-xl">
              ¡LISTO! ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AliveDots({ players, team, size }: { players: NetPlayer[]; team: number; size: number }) {
  const ps = players.filter((p) => p.team === team);
  return (
    <div className="flex gap-1">
      {Array.from({ length: size }).map((_, i) => (
        <div key={i} className="h-3 w-3 rounded-[3px] border border-black/50" style={{ background: ps[i]?.alive ? TEAM_COLORS[team] : "rgba(255,255,255,0.18)" }} />
      ))}
    </div>
  );
}

export function Hud({ snap, hud, net, hit, hurtK, feed }: { snap: Snapshot; hud: HudState | null; net: Net; hit: { k: number; kind: string }; hurtK: number; feed: FeedItem[] }) {
  const me = snap.players.find((p) => p.id === snap.you);
  const team = me?.team ?? 0;
  const mates = snap.players.filter((p) => p.team === team);
  const w = hud ? WEAPONS[hud.slots[hud.cur]] : null;
  const hp = hud?.hp ?? 100;
  const hpColor = hp > 60 ? "#22c55e" : hp > 30 ? "#eab308" : "#ef4444";
  const scoped = hud?.scoped;
  const isKatana = w?.id === "katana";
  const hitSize = hit.kind === "kill" ? 46 : hit.kind === "head" ? 40 : 32;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-[Trebuchet_MS,sans-serif]">
      {/* marcador superior */}
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-stretch overflow-hidden rounded-2xl border-2 border-white/25 bg-black/55 shadow-xl backdrop-blur">
        <div className="flex flex-col items-center gap-1 px-4 py-2" style={{ background: TEAM_COLORS[0] + "55" }}>
          <div className="text-[10px] font-black tracking-widest text-white/80">VERDE</div>
          <AliveDots players={snap.players} team={0} size={snap.size} />
        </div>
        <div className="grid place-items-center px-3 text-3xl font-black text-white" style={{ background: TEAM_COLORS[0] + "99" }}>{snap.score[0]}</div>
        <div className="flex min-w-[88px] flex-col items-center justify-center px-3">
          <div className="text-[10px] font-black tracking-widest text-white/60">RONDA {snap.round}</div>
          <div className="text-lg font-black text-white">{snap.phase === "playing" ? fmtTime(net.remaining()) : "—"}</div>
        </div>
        <div className="grid place-items-center px-3 text-3xl font-black text-white" style={{ background: TEAM_COLORS[1] + "99" }}>{snap.score[1]}</div>
        <div className="flex flex-col items-center gap-1 px-4 py-2" style={{ background: TEAM_COLORS[1] + "55" }}>
          <div className="text-[10px] font-black tracking-widest text-white/80">ROJO</div>
          <AliveDots players={snap.players} team={1} size={snap.size} />
        </div>
      </div>

      {/* killfeed */}
      <div className="absolute right-3 top-3 flex w-72 flex-col items-end gap-1">
        {feed.map((f) => (
          <div key={f.id} className="mx-kf flex items-center gap-2 rounded-lg border border-white/15 bg-black/60 px-3 py-1 text-sm font-extrabold">
            <span style={{ color: TEAM_COLORS[f.kteam] }}>{f.killer}</span>
            <span className="text-base">{WEAPONS[f.w]?.icon}</span>
            {f.head && <span title="Headshot">💀</span>}
            <span style={{ color: TEAM_COLORS[f.vteam] }}>{f.victim}</span>
          </div>
        ))}
      </div>

      {/* equipo */}
      <div className="absolute left-3 top-24 flex w-44 flex-col gap-1.5">
        {mates.map((p) => (
          <div key={p.id} className="rounded-md bg-black/45 px-2 py-1" style={{ opacity: p.alive ? 1 : 0.4 }}>
            <div className="flex justify-between text-[11px] font-extrabold text-white">
              <span>{p.name}{p.id === snap.you ? " (tú)" : ""}</span>
              <span>{p.kills}/{p.deaths}</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full" style={{ width: `${p.alive ? p.hp : 0}%`, background: TEAM_COLORS[team] }} />
            </div>
          </div>
        ))}
      </div>

      {/* mira */}
      {hud?.alive && !scoped && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute -left-[3px] -top-[3px] h-[6px] w-[6px] rounded-full bg-white shadow-[0_0_3px_#000]" />
          {[[-14, -1, 8, 2], [6, -1, 8, 2], [-1, -14, 2, 8], [-1, 6, 2, 8]].map(([x, y, ww, hh], i) => (
            <div key={i} className="absolute bg-white shadow-[0_0_2px_#000]" style={{ left: x, top: y, width: ww, height: hh }} />
          ))}
        </div>
      )}
      {scoped && (
        <div className="absolute inset-0 z-0" style={{ background: "radial-gradient(circle at center, transparent 0, transparent 26vh, #000 26.4vh)" }}>
          <div className="absolute left-0 top-1/2 h-px w-full bg-black/80" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-black/80" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
        </div>
      )}
      {hit.k > 0 && (
        <svg key={hit.k} className="mx-hitmarker" width={hitSize * 2} height={hitSize * 2} viewBox="-20 -20 40 40" style={{ marginLeft: 0 }}>
          <g stroke="#ff1e2d" strokeWidth={hit.kind === "head" ? 4.2 : hit.kind === "kill" ? 5 : 3.2} strokeLinecap="round">
            <line x1="-12" y1="-12" x2="-5" y2="-5" />
            <line x1="12" y1="-12" x2="5" y2="-5" />
            <line x1="-12" y1="12" x2="-5" y2="5" />
            <line x1="12" y1="12" x2="5" y2="5" />
          </g>
          {hit.kind === "head" && <circle r="3" fill="#fde047" />}
        </svg>
      )}
      {hurtK > 0 && <div key={hurtK} className="mx-hurt" />}
      {hp < 30 && hud?.alive && <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(220,38,38,0.55)" }} />}

      {/* vida */}
      <div className="absolute bottom-5 left-5 w-72">
        <div className="flex items-end gap-2">
          <div className="text-5xl font-black leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{Math.ceil(hp)}</div>
          <div className="pb-1 text-xs font-extrabold tracking-widest text-white/70">VIDA</div>
        </div>
        <div className="mt-1 h-3.5 overflow-hidden rounded-full border-2 border-black/60 bg-black/50">
          <div className="h-full transition-all" style={{ width: `${hp}%`, background: hpColor }} />
        </div>
        <div className="mt-2 flex gap-3 text-[10px] font-extrabold tracking-wider text-white/80">
          <div className="flex-1">DESLIZAR<Bar v={(hud?.slideP ?? 1) * 100} color="#38bdf8" /></div>
          {isKatana && <div className="flex-1">DASH<Bar v={(hud?.dashP ?? 1) * 100} color="#f43f5e" /></div>}
        </div>
      </div>

      {/* armas y munición */}
      {w && hud && (
        <div className="absolute bottom-5 right-5 flex flex-col items-end gap-2">
          <div className="flex items-end gap-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {!w.melee ? (
              <>
                <span className="text-6xl font-black leading-none text-white">{hud.ammo}</span>
                <span className="pb-1 text-2xl font-black text-white/60">/ {hud.mag}</span>
              </>
            ) : (
              <span className="text-3xl font-black text-white">{w.icon} {w.name}</span>
            )}
          </div>
          {hud.reloading && (
            <div className="w-56">
              <div className="text-right text-xs font-black tracking-widest text-amber-300">RECARGANDO…</div>
              <Bar v={hud.reloadP * 100} color="#fbbf24" />
            </div>
          )}
          <div className="flex gap-2">
            {hud.slots.map((s, i) => (
              <div key={i} className="grid h-16 w-20 place-items-center rounded-xl border-2 text-center" style={{ borderColor: i === hud.cur ? "#fde047" : "rgba(255,255,255,0.2)", background: i === hud.cur ? "rgba(250,204,21,0.25)" : "rgba(0,0,0,0.5)" }}>
                <div className="-mb-1 text-xl">{WEAPONS[s].icon}</div>
                <div className="text-[9px] font-extrabold leading-tight text-white">{i + 1} • {WEAPONS[s].name.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* eliminado */}
      {hud && !hud.alive && snap.phase === "playing" && (
        <div className="absolute inset-x-0 bottom-28 text-center">
          <div className="text-4xl font-black text-red-500 drop-shadow-[0_3px_6px_#000]">ELIMINADO</div>
          <div className="mt-1 text-lg font-bold text-white drop-shadow-[0_2px_4px_#000]">{hud.spectate ? `Observando a ${hud.spectate} • clic para cambiar` : "Esperando fin de ronda…"}</div>
        </div>
      )}
    </div>
  );
}
