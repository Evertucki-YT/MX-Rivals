"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Net, p2p } from "@/game/net";
import type { Game, GameCallbacks, HudState } from "@/game/engine";
import { DEFAULT_LOADOUT, MAPS, ROUNDS_TO_WIN, TEAM_COLORS, TEAM_NAMES, type Loadout, type NetPlayer, type Snapshot } from "@/game/shared";
import { initAudio, sfx } from "@/game/audio";
import { Hud, LoadoutPanel, type FeedItem } from "./GameUi";
import type { Session } from "./Menu";

async function roomApi(body: Record<string, unknown>) {
  p2p.handleAction(String(body.action || ""), String(body.id || ""));
  return {};
}

function GameView({ net, cbs, onReady }: { net: Net; cbs: GameCallbacks; onReady: (g: Game | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onReady);
  cbRef.current = onReady;
  useEffect(() => {
    let game: Game | null = null;
    let dead = false;
    import("@/game/engine").then(({ Game }) => {
      if (dead || !ref.current) return;
      game = new Game(ref.current, net, cbs);
      cbRef.current(game);
    });
    return () => {
      dead = true;
      game?.dispose();
      cbRef.current(null);
    };
  }, [net, cbs]);
  return <div ref={ref} className="absolute inset-0 bg-black" />;
}

function TeamList({ players, team, size, you }: { players: NetPlayer[]; team: number; size: number; you: string }) {
  const ps = players.filter((p) => p.team === team);
  return (
    <div className="flex-1 rounded-2xl border-2 p-3" style={{ borderColor: TEAM_COLORS[team], background: TEAM_COLORS[team] + "18" }}>
      <div className="mb-2 text-center text-sm font-black tracking-widest" style={{ color: TEAM_COLORS[team] }}>EQUIPO {TEAM_NAMES[team]}</div>
      <div className="grid gap-1.5">
        {Array.from({ length: size }).map((_, i) => {
          const p = ps[i];
          return (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-sm font-bold text-white">
              <span className="grid h-6 w-6 place-items-center rounded-md text-xs" style={{ background: p ? TEAM_COLORS[team] : "rgba(255,255,255,0.1)" }}>{p ? (p.bot ? "🤖" : "👤") : "·"}</span>
              <span className={p ? "" : "text-white/35"}>{p ? p.name : "esperando jugador…"}</span>
              {p?.id === you && <span className="ml-auto text-[10px] text-amber-300">TÚ</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RoomView({ session, onExit }: { session: Session; onExit: () => void }) {
  const [net] = useState(() => new Net(session.code, session.id));
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState("");
  const [hud, setHud] = useState<HudState | null>(null);
  const [locked, setLocked] = useState(false);
  const [hit, setHit] = useState({ k: 0, kind: "hit" });
  const [hurtK, setHurtK] = useState(0);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loadout, setLoadoutState] = useState<Loadout>(DEFAULT_LOADOUT);
  const [ready, setReady] = useState(false);
  const [, force] = useState(0);
  const gameRef = useRef<Game | null>(null);
  const feedId = useRef(1);
  const [copied, setCopied] = useState(false);
  const [roundWinner, setRoundWinner] = useState(0);

  const cbs = useMemo<GameCallbacks>(
    () => ({
      onHud: setHud,
      onHitmarker: (kind) => setHit((h) => ({ k: h.k + 1, kind })),
      onHurt: () => setHurtK((k) => k + 1),
      onLock: setLocked,
    }),
    [],
  );

  useEffect(() => {
    net.onSnap = (s) => setSnap(s);
    net.onError = (m) => setErr(m);
    net.start();
    const un = net.addEvents((evs) => {
      const items: FeedItem[] = [];
      for (const e of evs) {
        if (e.t === "round") setRoundWinner(e.winner);
        if (e.t !== "kill") continue;
        const k = net.snap?.players.find((p) => p.id === e.killer);
        const v = net.snap?.players.find((p) => p.id === e.victim);
        if (!k || !v) continue;
        items.push({ id: feedId.current++, killer: k.name, kteam: k.team, victim: v.name, vteam: v.team, w: e.w, head: e.head });
      }
      if (items.length) {
        setFeed((f) => [...f, ...items].slice(-6));
        items.forEach((it) => setTimeout(() => setFeed((f) => f.filter((x) => x.id !== it.id)), 5200));
      }
    });
    const iv = setInterval(() => force((n) => n + 1), 100);
    return () => {
      un();
      clearInterval(iv);
      net.stop(true);
    };
  }, [net]);

  const phase = snap?.phase;
  const round = snap?.round ?? 0;
  useEffect(() => {
    if (phase === "loadout") setReady(false);
    if (phase === "matchEnd" && document.pointerLockElement) document.exitPointerLock();
    if (phase === "vote" || phase === "lobby") sfx("tick", 0.5);
  }, [phase, round]);

  const exit = () => {
    net.leaveNow();
    onExit();
  };

  const changeLoadout = (l: Loadout) => {
    initAudio();
    sfx("swap");
    setLoadoutState(l);
    net.setLoadout(l);
  };

  if (err)
    return (
      <div className="mx-bg grid min-h-screen place-items-center p-6">
        <div className="max-w-md rounded-3xl border border-white/20 bg-slate-900/90 p-8 text-center">
          <div className="text-5xl">📡</div>
          <h2 className="mt-3 text-2xl font-black">Conexión perdida</h2>
          <p className="mt-2 text-white/70">{err}</p>
          <button onClick={exit} className="mx-btn mt-6 w-full bg-gradient-to-r from-red-600 to-red-500">VOLVER AL MENÚ</button>
        </div>
      </div>
    );

  if (!snap)
    return (
      <div className="mx-bg grid min-h-screen place-items-center">
        <div className="text-center">
          <div className="mx-spin mx-auto h-14 w-14 rounded-full border-4 border-white/20 border-t-amber-400" />
          <div className="mt-4 text-lg font-bold text-white/80">Conectando a la sala…</div>
        </div>
      </div>
    );

  const me = snap.players.find((p) => p.id === snap.you);
  const team = me?.team ?? 0;
  const isHost = snap.hostId === snap.you;
  const showGame = snap.mapId !== null && (snap.phase === "loadout" || snap.phase === "playing" || snap.phase === "roundEnd" || snap.phase === "matchEnd");
  const remaining = net.remaining();
  const humans = snap.players.filter((p) => !p.bot).length;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {showGame && <GameView net={net} cbs={cbs} onReady={(g) => (gameRef.current = g)} />}

      {/* ---------- LOBBY ---------- */}
      {snap.phase === "lobby" && (
        <div className="mx-bg absolute inset-0 grid place-items-center overflow-y-auto p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-slate-950/80 p-6 shadow-2xl backdrop-blur">
            {snap.isPublic ? (
              <div className="text-center">
                <div className="mx-spin mx-auto h-12 w-12 rounded-full border-4 border-white/20 border-t-green-400" />
                <h2 className="mt-3 text-2xl font-black">BUSCANDO PARTIDA PÚBLICA {snap.size}v{snap.size}</h2>
                <p className="mt-1 text-sm font-semibold text-white/70">
                  Jugadores en sala: {humans}/{snap.size * 2} • Los bots rellenarán los lugares vacíos en{" "}
                  <b className="text-amber-300">{Math.max(0, Math.ceil((snap.lobbyEnd - net.now()) / 1000))}s</b>
                </p>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-2xl font-black">SALA PRIVADA {snap.size}v{snap.size}</h2>
                <div className="mt-2 text-xs font-bold tracking-widest text-white/60">CÓDIGO PARA TUS AMIGOS</div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(snap.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="mx-auto mt-1 block rounded-2xl border-2 border-dashed border-amber-300 bg-amber-300/10 px-8 py-2 text-5xl font-black tracking-[0.35em] text-amber-300"
                >
                  {snap.code}
                </button>
                <div className="mt-1 h-4 text-xs font-bold text-green-400">{copied ? "¡Código copiado!" : "Clic para copiar • hasta 8 jugadores"}</div>
              </div>
            )}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <TeamList players={snap.players} team={0} size={snap.size} you={snap.you} />
              <TeamList players={snap.players} team={1} size={snap.size} you={snap.you} />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {!snap.isPublic && (
                <button onClick={() => roomApi({ action: "team", code: snap.code, id: snap.you })} className="mx-btn bg-gradient-to-r from-slate-100 to-slate-300 !py-3 !text-base !text-slate-900">
                  🔁 CAMBIAR DE EQUIPO
                </button>
              )}
              {!snap.isPublic && isHost && (
                <button onClick={() => roomApi({ action: "start", code: snap.code, id: snap.you })} className="mx-btn bg-gradient-to-r from-green-600 to-green-500 !py-3 !text-base">
                  ▶ INICIAR PARTIDA
                </button>
              )}
              {!snap.isPublic && !isHost && <div className="text-sm font-bold text-white/60">Esperando a que el anfitrión inicie…</div>}
              <button onClick={exit} className="mx-btn bg-gradient-to-r from-red-700 to-red-600 !py-3 !text-base">✕ SALIR</button>
            </div>
            <p className="mt-4 text-center text-xs font-semibold text-white/40">Los lugares vacíos se llenan con Bots IA • Creado por: Ever Baruc</p>
          </div>
        </div>
      )}

      {/* ---------- VOTACIÓN DE MAPA ---------- */}
      {snap.phase === "vote" && (
        <div className="mx-bg absolute inset-0 overflow-y-auto p-4">
          <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center">
            <div className="text-center">
              <div className="text-xs font-extrabold tracking-[0.35em] text-white/60">VOTACIÓN</div>
              <h2 className="text-3xl font-black sm:text-5xl">ELIGE EL MAPA</h2>
              <div className="mx-auto mt-3 grid h-16 w-16 place-items-center rounded-full border-4 border-amber-300 text-3xl font-black text-amber-300">{Math.ceil(remaining / 1000)}</div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {MAPS.map((m) => {
                const mine = snap.myVote === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => { initAudio(); sfx("tick"); net.setVote(m.id); }}
                    className="mx-card overflow-hidden rounded-3xl border-4 text-left"
                    style={{ borderColor: mine ? "#fde047" : "rgba(255,255,255,0.2)", boxShadow: mine ? "0 0 36px rgba(253,224,71,0.6)" : "none", background: "#0f172a" }}
                  >
                    <div className="relative grid h-36 place-items-center text-7xl" style={{ background: m.grad }}>
                      {m.emoji}
                      <div className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-lg font-black text-white">🗳 {snap.votes[m.id]}</div>
                    </div>
                    <div className="p-4">
                      <div className="text-lg font-black leading-tight text-white">{m.name}</div>
                      <div className="text-xs font-bold text-amber-300">{m.sub}</div>
                      <p className="mt-2 text-sm font-medium text-white/70">{m.desc}</p>
                      <div className="mt-3 rounded-lg py-1.5 text-center text-sm font-black" style={{ background: mine ? "#fde047" : "rgba(255,255,255,0.1)", color: mine ? "#111" : "#fff" }}>{mine ? "✔ TU VOTO" : "VOTAR"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <TeamList players={snap.players} team={0} size={snap.size} you={snap.you} />
              <TeamList players={snap.players} team={1} size={snap.size} you={snap.you} />
            </div>
          </div>
        </div>
      )}

      {/* ---------- LOADOUT ---------- */}
      {snap.phase === "loadout" && showGame && (
        <>
          <LoadoutPanel
            loadout={loadout}
            onChange={changeLoadout}
            ready={ready}
            remaining={remaining}
            round={snap.round}
            team={team}
            onReady={() => { setReady(true); gameRef.current?.requestLock(); }}
          />
          {snap.mapId !== null && !ready && <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1 text-xs font-bold text-white/80">{MAPS[snap.mapId].name}</div>}
        </>
      )}

      {/* ---------- HUD ---------- */}
      {(snap.phase === "playing" || snap.phase === "roundEnd" || (snap.phase === "loadout" && ready)) && showGame && <Hud snap={snap} hud={hud} net={net} hit={hit} hurtK={hurtK} feed={feed} />}

      {snap.phase === "loadout" && ready && !locked && (
        <div className="absolute inset-x-0 bottom-6 z-20 text-center text-sm font-bold text-white/80">Haz clic en la pantalla para capturar el mouse</div>
      )}

      {/* ---------- BANNER DE RONDA ---------- */}
      {snap.phase === "roundEnd" && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <div className="mx-pop rounded-3xl border-4 border-white/40 bg-black/65 px-10 py-6 text-center backdrop-blur">
            {(() => {
              const winner = roundWinner;
              return (
                <>
                  <div className="text-xs font-extrabold tracking-[0.35em] text-white/60">FIN DE LA RONDA {snap.round}</div>
                  <div className="text-4xl font-black sm:text-6xl" style={{ color: TEAM_COLORS[winner] }}>EQUIPO {TEAM_NAMES[winner]}</div>
                  <div className="text-xl font-black text-white">{winner === team ? "¡GANA LA RONDA!" : "GANA LA RONDA"}</div>
                  <div className="mt-2 text-3xl font-black text-white">{snap.score[0]} — {snap.score[1]}</div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ---------- BLOQUEO DE MOUSE ---------- */}
      {(snap.phase === "playing" || snap.phase === "roundEnd") && showGame && !locked && (
        <div className="absolute inset-0 z-30 grid cursor-pointer place-items-center bg-black/55 backdrop-blur-[2px]" onClick={() => gameRef.current?.requestLock()}>
          <div className="text-center">
            <div className="text-5xl font-black text-white drop-shadow-lg sm:text-6xl">HAZ CLIC PARA JUGAR</div>
            <div className="mt-3 text-sm font-semibold text-white/75">WASD mover • ESPACIO saltar • SHIFT/C deslizar • 1-2-3 armas • R recargar • CLIC DER apuntar/dash</div>
            <button onClick={(e) => { e.stopPropagation(); exit(); }} className="mx-btn mx-auto mt-6 bg-gradient-to-r from-red-700 to-red-600 !py-2 !text-sm">✕ SALIR DE LA PARTIDA</button>
          </div>
        </div>
      )}

      {/* ---------- FIN DE PARTIDA ---------- */}
      {snap.phase === "matchEnd" && (
        <div className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          {(() => {
            const winner = snap.score[0] >= ROUNDS_TO_WIN ? 0 : 1;
            const won = winner === team;
            return (
              <div className="mx-pop w-full max-w-2xl rounded-3xl border-4 bg-slate-950/90 p-6 text-center shadow-2xl" style={{ borderColor: TEAM_COLORS[winner] }}>
                <div className="text-sm font-extrabold tracking-[0.4em] text-white/60">FIN DE LA PARTIDA</div>
                <div className="text-5xl font-black sm:text-7xl" style={{ color: won ? "#fde047" : "#94a3b8" }}>{won ? "¡VICTORIA!" : "DERROTA"}</div>
                <div className="mt-1 text-xl font-black" style={{ color: TEAM_COLORS[winner] }}>Gana el Equipo {TEAM_NAMES[winner]}</div>
                <div className="mt-2 text-5xl font-black text-white">
                  <span style={{ color: TEAM_COLORS[0] }}>{snap.score[0]}</span> — <span style={{ color: TEAM_COLORS[1] }}>{snap.score[1]}</span>
                </div>
                <div className="mt-4 grid gap-3 text-left sm:grid-cols-2">
                  {[0, 1].map((t) => (
                    <div key={t} className="rounded-xl p-2" style={{ background: TEAM_COLORS[t] + "22", border: `1px solid ${TEAM_COLORS[t]}` }}>
                      <div className="mb-1 flex justify-between text-[11px] font-black tracking-widest" style={{ color: TEAM_COLORS[t] }}><span>{TEAM_NAMES[t]}</span><span>BAJAS / MUERTES</span></div>
                      {snap.players.filter((p) => p.team === t).sort((a, b) => b.kills - a.kills).map((p) => (
                        <div key={p.id} className="flex justify-between rounded px-2 py-1 text-sm font-bold text-white" style={{ background: p.id === snap.you ? "rgba(255,255,255,0.15)" : "transparent" }}>
                          <span>{p.bot ? "🤖 " : ""}{p.name}</span>
                          <span>{p.kills} / {p.deaths}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mx-auto mt-5 w-fit rounded-full border border-amber-300/50 bg-amber-300/10 px-6 py-2 text-lg font-extrabold tracking-wide text-amber-300">★ Creado por: Ever Baruc ★</div>
                <button onClick={exit} className="mx-btn mt-5 w-full bg-gradient-to-r from-green-600 to-green-500">VOLVER AL MENÚ</button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
