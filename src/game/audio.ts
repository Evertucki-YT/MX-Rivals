// Audio sintetizado con WebAudio (sin archivos externos)
let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let master: GainNode | null = null;

export function initAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = "lowpass", delay = 0) {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

export function sfx(name: string, volume = 1) {
  if (!ctx) return;
  const v = volume;
  switch (name) {
    case "rifle": noise(0.14, 0.7 * v, 5000, 300); tone(160, 0.1, "square", 0.25 * v, -100); break;
    case "uzi": noise(0.09, 0.55 * v, 6000, 500); tone(220, 0.06, "square", 0.18 * v, -120); break;
    case "shotgun": noise(0.35, 1 * v, 3500, 120); tone(90, 0.25, "sawtooth", 0.4 * v, -60); break;
    case "sniper": noise(0.6, 1 * v, 4000, 80); tone(70, 0.5, "sawtooth", 0.5 * v, -40); tone(1800, 0.15, "sine", 0.1 * v, -1000, 0.02); break;
    case "revolver": noise(0.28, 0.9 * v, 4500, 150); tone(120, 0.2, "square", 0.35 * v, -80); break;
    case "hit": tone(1400, 0.07, "square", 0.22); tone(1900, 0.05, "sine", 0.15, 0, 0.02); break;
    case "head": tone(2300, 0.09, "square", 0.25); tone(3100, 0.12, "sine", 0.2, 0, 0.05); break;
    case "kill": tone(900, 0.1, "triangle", 0.3); tone(1350, 0.18, "triangle", 0.3, 0, 0.08); break;
    case "hurt": noise(0.18, 0.5, 800, 200, "lowpass"); tone(140, 0.2, "sawtooth", 0.25, -60); break;
    case "reload": noise(0.05, 0.3, 3000, 2000, "bandpass"); tone(500, 0.04, "square", 0.1, 0, 0.0); noise(0.06, 0.4, 2500, 1200, "bandpass", 0.55); tone(380, 0.05, "square", 0.12, 0, 0.55); break;
    case "pump": noise(0.07, 0.35, 2500, 900, "bandpass"); noise(0.08, 0.4, 2200, 700, "bandpass", 0.14); break;
    case "bolt": noise(0.06, 0.3, 2800, 1000, "bandpass"); noise(0.07, 0.35, 2300, 800, "bandpass", 0.2); break;
    case "swing": noise(0.22, 0.5, 600, 3500, "bandpass"); break;
    case "slash": noise(0.12, 0.6, 5000, 1500, "bandpass"); tone(800, 0.1, "sawtooth", 0.15, -400); break;
    case "dash": noise(0.35, 0.7, 400, 4000, "bandpass"); break;
    case "slide": noise(0.5, 0.25, 1500, 400, "bandpass"); break;
    case "jump": tone(220, 0.1, "sine", 0.1, 140); break;
    case "empty": tone(900, 0.03, "square", 0.1); break;
    case "swap": noise(0.05, 0.25, 3000, 1500, "bandpass"); break;
    case "tick": tone(1000, 0.05, "square", 0.12); break;
    case "go": tone(520, 0.15, "square", 0.2); tone(780, 0.25, "square", 0.22, 0, 0.14); break;
    case "win": tone(523, 0.15, "triangle", 0.3); tone(659, 0.15, "triangle", 0.3, 0, 0.13); tone(784, 0.3, "triangle", 0.3, 0, 0.26); break;
    case "lose": tone(400, 0.2, "triangle", 0.3, -120); tone(300, 0.35, "triangle", 0.3, -120, 0.18); break;
    case "far": noise(0.12, 0.2 * v, 2500, 300); break;
  }
}
