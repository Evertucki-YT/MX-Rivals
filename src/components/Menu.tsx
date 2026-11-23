"use client";

import { useEffect, useState } from "react";
import { initAudio, sfx } from "@/game/audio";

export interface Session {
  code: string;
  id: string;
  name: string;
}

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json()) as { error?: string; code?: string; id?: string };
}

export default function Menu({ onStart }: { onStart: (s: Session) => void }) {
  const [name, setName] = useState("");
  const [size, setSize] = useState(2);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [priv, setPriv] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    const n = localStorage.getItem("mx_name");
    if (n) setName(n);
    else setName("Jugador" + Math.floor(Math.random() * 900 + 100));
  }, []);

  const go = async (action: string, extra: Record<string, unknown> = {}) => {
    initAudio();
    sfx("tick");
    const nick = (name.trim() || "Jugador").slice(0, 14);
    localStorage.setItem("mx_name", nick);
    setBusy(true);
    setErr("");
    try {
      const r = await api({ action, name: nick, size, ...extra });
      if (r.error || !r.code || !r.id) setErr(r.error ?? "No se pudo conectar");
      else onStart({ code: r.code, id: r.id, name: nick });
    } catch {
      setErr("Error de conexión con el servidor");
    }
    setBusy(false);
  };

  return (
    <div className="mx-bg relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-8">
      <div className="mx-stripes" />
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="mx-cube"
          style={{
            left: `${(i * 73) % 100}%`,
            animationDelay: `${-i * 1.7}s`,
            animationDuration: `${14 + (i % 5) * 3}s`,
            width: 24 + (i % 4) * 14,
            height: 24 + (i % 4) * 14,
            background: ["#16a34a", "#f8fafc", "#dc2626", "#facc15"][i % 4],
          }}
        />
      ))}

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center">
        <div className="mx-logo select-none text-center">
          <span className="mx-logo-mx">
            <span style={{ color: "#16a34a" }}>M</span>
            <span style={{ color: "#dc2626" }}>X</span>
          </span>
          <span className="mx-logo-rivals">RIVALS</span>
        </div>
        <div className="mt-2 flex h-2.5 w-72 overflow-hidden rounded-full shadow-lg">
          <div className="flex-1 bg-green-600" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-red-600" />
        </div>
        <div className="mt-4 rounded-full border border-white/25 bg-black/40 px-6 py-1.5 text-base font-extrabold tracking-wide text-amber-300 shadow-[0_0_24px_rgba(250,204,21,0.35)] backdrop-blur sm:text-lg">
          ★ Creado por: Ever Baruc ★
        </div>
        <p className="mt-3 text-center text-sm font-semibold text-white/80">Shooter competitivo por equipos • Mapas urbanos de México • Multijugador en línea</p>

        <div className="mt-6 w-full rounded-3xl border border-white/15 bg-slate-950/70 p-5 shadow-2xl backdrop-blur-md sm:p-7">
          <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/60">Tu apodo</label>
          <input
            value={name}
            maxLength={14}
            onChange={(e) => setName(e.target.value)}
            placeholder="Escribe tu apodo…"
            className="w-full rounded-xl border-2 border-white/15 bg-white/10 px-4 py-3 text-lg font-bold text-white outline-none transition focus:border-amber-400"
          />

          <label className="mb-1 mt-5 block text-xs font-bold uppercase tracking-widest text-white/60">Tamaño de equipo</label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => { setSize(n); sfx("tick"); initAudio(); }}
                className={`rounded-xl border-2 py-3 text-xl font-black transition ${size === n ? "border-amber-300 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 shadow-[0_0_20px_rgba(251,191,36,0.5)]" : "border-white/15 bg-white/10 text-white hover:bg-white/20"}`}
              >
                {n}v{n}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            <button
              disabled={busy}
              onClick={() => go("public")}
              className="mx-btn bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
            >
              <span className="text-2xl">🌎</span> BUSCAR PARTIDA PÚBLICA
            </button>
            <button disabled={busy} onClick={() => { setPriv(true); sfx("tick"); initAudio(); }} className="mx-btn bg-gradient-to-r from-slate-100 to-slate-300 !text-slate-900 hover:from-white hover:to-slate-200">
              <span className="text-2xl">🔒</span> SALA PRIVADA CON AMIGOS
            </button>
            <button disabled={busy} onClick={() => go("practice")} className="mx-btn bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400">
              <span className="text-2xl">🤖</span> PRACTICAR CON BOTS
            </button>
          </div>
          {err && <div className="mt-4 rounded-lg bg-red-600/80 px-4 py-2 text-center text-sm font-bold text-white">{err}</div>}
          {busy && <div className="mt-3 text-center text-sm font-semibold text-white/70">Conectando…</div>}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 text-center text-xs font-semibold text-white/70 sm:grid-cols-4">
          <span>WASD • moverse</span>
          <span>ESPACIO • saltar</span>
          <span>SHIFT / C • deslizarse</span>
          <span>1 2 3 • armas</span>
          <span>CLIC • disparar</span>
          <span>CLIC DER • apuntar / dash</span>
          <span>R • recargar</span>
          <span>ESC • soltar mouse</span>
        </div>
      </div>

      {priv && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPriv(false)}>
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-center text-2xl font-black text-white">SALA PRIVADA</h2>
            <p className="mt-1 text-center text-sm text-white/60">Hasta 8 jugadores • Formato {size}v{size}</p>
            <button disabled={busy} onClick={() => go("create")} className="mx-btn mt-5 w-full bg-gradient-to-r from-green-600 to-green-500">
              ➕ CREAR SALA
            </button>
            <div className="my-4 flex items-center gap-3 text-xs font-bold text-white/40">
              <div className="h-px flex-1 bg-white/20" /> O ÚNETE <div className="h-px flex-1 bg-white/20" />
            </div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="CÓDIGO"
              className="w-full rounded-xl border-2 border-white/15 bg-white/10 px-4 py-3 text-center text-3xl font-black tracking-[0.5em] text-white outline-none focus:border-amber-400"
            />
            <button disabled={busy || code.length < 4} onClick={() => go("join", { code })} className="mx-btn mt-3 w-full bg-gradient-to-r from-red-600 to-red-500 disabled:opacity-40">
              🚪 UNIRSE CON CÓDIGO
            </button>
            {err && <div className="mt-3 rounded-lg bg-red-600/80 px-3 py-2 text-center text-sm font-bold text-white">{err}</div>}
            <button onClick={() => setPriv(false)} className="mt-4 w-full text-sm font-bold text-white/60 hover:text-white">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
