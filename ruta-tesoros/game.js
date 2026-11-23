// La Ruta de los Tesoros Escondidos · Mundo 1: Carnaval de Barranquilla
// Demo jugable. Todo el arte es procedural y la música se sintetiza en vivo.
// No guarda ni envía datos: las métricas de la sesión viven solo en memoria.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (s) => document.querySelector(s);
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let R = mulberry32(20260223);
const rr = (a, b) => a + R() * (b - a);
const pick = (arr) => arr[Math.floor(R() * arr.length)];

const COL = { oro: '#ffc915', fucsia: '#e6197d', turq: '#18c3b8', rojo: '#e5322d', verde: '#1f9d55', cobalto: '#2346c8', naranja: '#ff7a1a', morado: '#8f3fd1', papel: '#fff7ea' };
const FESTIVE = [COL.oro, COL.fucsia, COL.turq, COL.rojo, COL.verde, COL.cobalto, COL.naranja, COL.morado];

// ---------------------------------------------------------------------------
// Saturación global inyectada en los shaders (nivel "Recupera los colores")
// ---------------------------------------------------------------------------
const SAT = { value: 1 };
const TIME = { value: 0 };
const BEAT = { value: 0 };
THREE.ShaderChunk.dithering_pars_fragment = '#ifdef USE_SAT\nuniform float uGlobalSat;\n#endif\n' + THREE.ShaderChunk.dithering_pars_fragment;
THREE.ShaderChunk.dithering_fragment = THREE.ShaderChunk.dithering_fragment +
  '\n#ifdef USE_SAT\n{ float lum = dot(gl_FragColor.rgb, vec3(0.2126,0.7152,0.0722)); gl_FragColor.rgb = mix(vec3(lum), gl_FragColor.rgb, uGlobalSat); }\n#endif\n';

function satify(mat) {
  if (!mat || mat.userData.satDone || mat.userData.noSat || mat.isShaderMaterial || mat.isLineBasicMaterial || mat.isPointsMaterial) return;
  mat.userData.satDone = true;
  const prevKey = mat.customProgramCacheKey();
  const prev = mat.onBeforeCompile;
  mat.defines = Object.assign({}, mat.defines, { USE_SAT: '' });
  mat.onBeforeCompile = function (sh, r) { sh.uniforms.uGlobalSat = SAT; prev.call(this, sh, r); };
  mat.customProgramCacheKey = () => prevKey + '|sat';
  mat.needsUpdate = true;
}
function satifyTree(root) {
  root.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(satify); });
}

// ---------------------------------------------------------------------------
// Íconos (SVG dibujados a mano para la interfaz)
// ---------------------------------------------------------------------------
const ICON = {
  nota: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 4.6v10.1A3.6 3.6 0 1 0 11 18V8.4l7-1.7v5.9a3.6 3.6 0 1 0 2 3.3V3.4a1 1 0 0 0-1.24-.97l-9 2.2A1 1 0 0 0 9 4.6Z"/></svg>',
  gota: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c-.3 0-.6.15-.8.4C9.3 5.5 5.5 10.6 5.5 14.6a6.5 6.5 0 0 0 13 0c0-4-3.8-9.1-5.7-11.7a1 1 0 0 0-.8-.4Zm-2.6 12.2a1 1 0 0 1 1 1 2.2 2.2 0 0 0 1.6 2.1 1 1 0 1 1-.6 1.9 4.2 4.2 0 0 1-3-4 1 1 0 0 1 1-1Z"/></svg>',
  farol: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 2h4a1 1 0 0 1 0 2h-.5v1.1c3 .6 5 3.6 5 6.9s-2 6.3-5 6.9V20h.5a1 1 0 0 1 0 2h-4a1 1 0 0 1 0-2h.5v-1.1c-3-.6-5-3.6-5-6.9s2-6.3 5-6.9V4H10a1 1 0 0 1 0-2Zm2 6.2c-.9 1-1.5 2.4-1.5 3.8s.6 2.8 1.5 3.8c.9-1 1.5-2.4 1.5-3.8s-.6-2.8-1.5-3.8Z"/></svg>',
  tambor: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><ellipse cx="20" cy="10" rx="11" ry="4"/><path d="M9 10v18c0 2.2 4.9 4 11 4s11-1.8 11-4V10"/><path d="M9 14l5.5 14L20 14l5.5 14L31 14"/></svg>',
  marimonda: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="20" cy="17" r="9"/><circle cx="6.5" cy="15" r="4.5"/><circle cx="33.5" cy="15" r="4.5"/><circle cx="16.3" cy="14.5" r="2"/><circle cx="23.7" cy="14.5" r="2"/><path d="M20 19c0 6 1 9 4.5 11.5 2 1.4 3.8.6 4-1.2"/></svg>',
  pollera: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><circle cx="20" cy="6.5" r="3"/><path d="M15 12h10l1.5 6h-13z"/><path d="M13.5 18C9 24 6 29 4.5 33.5c5 2 25 2 31 0C34 29 31 24 26.5 18"/><path d="M8 29c4 1.4 20 1.4 24 0"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 0 1 6 0v3Z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>',
  retry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5Z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.3a8 8 0 0 1 0 11.4"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="m16 9.5 5 5m0-5-5 5"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2.8 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.7l-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8Z"/></svg>',
};

// ---------------------------------------------------------------------------
// Audio: cumbia sintetizada por capas + efectos
// ---------------------------------------------------------------------------
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PROG = [ // Am · Dm · E · Am
  { r: 45, c: [57, 60, 64] }, { r: 50, c: [57, 62, 65] }, { r: 40, c: [56, 59, 64] }, { r: 45, c: [57, 60, 64] },
];
const MELODY = [ // [paso dentro de 4 compases, nota midi, duración en semicorcheas]
  [0, 76, 3], [3, 74, 1], [4, 72, 2], [6, 69, 2], [8, 72, 2], [10, 74, 2], [12, 76, 4],
  [16, 77, 3], [19, 76, 1], [20, 74, 2], [22, 72, 2], [24, 74, 4], [28, 69, 4],
  [32, 71, 3], [35, 72, 1], [36, 74, 2], [38, 76, 2], [40, 74, 2], [42, 72, 2], [44, 71, 4],
  [48, 72, 2], [50, 71, 2], [52, 69, 6], [60, 64, 2], [62, 68, 2],
];
const BRASS = [[8, 69], [10, 72], [12, 76], [40, 68], [42, 71], [44, 76]];
const ALEGRE = [
  [1, 0, 0, 2, 1, 0, 2, 0, 1, 0, 0, 2, 1, 0, 2, 2],
  [1, 0, 2, 0, 1, 0, 2, 1, 1, 0, 0, 2, 1, 2, 0, 2],
];
const LAYER_LEVEL = { tambora: 0.9, llamador: 0.7, alegre: 0.55, guacharaca: 0.32, maracas: 0.16, bass: 0.55, chords: 0.16, gaita: 0.28, brass: 0.2, crowd: 0.5 };

class Sound {
  constructor() { this.ok = false; this.muted = false; this.bpm = 100; this.spb = 60 / this.bpm; this.layers = {}; this.running = false; this.perfStart = performance.now(); }
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.85;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0.85;
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 18000; this.filter.Q.value = 0.8;
    this.music.connect(this.filter); this.filter.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(1.8);
    const vg = c.createGain(); vg.gain.value = 0.22; this.verb.connect(vg); vg.connect(this.master);
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    for (const k of Object.keys(LAYER_LEVEL)) { const g = c.createGain(); g.gain.value = 0; g.connect(this.music); this.layers[k] = g; }
    this.layers.gaita.connect(this.verb); this.layers.brass.connect(this.verb);
    this.ok = true;
  }
  impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return b;
  }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }
  start() {
    if (!this.ok || this.running) return;
    this.running = true; this.t0 = this.ctx.currentTime + 0.1; this.step = 0; this.nextT = this.t0;
    this.timer = setInterval(() => this.tick(), 25);
  }
  tick() {
    if (this.ctx.state !== 'running') return;
    const ahead = this.ctx.currentTime + 0.16, sd = this.spb / 4;
    if (this.nextT < this.ctx.currentTime - 0.3) { // la pestaña estuvo dormida: realinear
      const skip = Math.ceil((this.ctx.currentTime - this.nextT) / sd); this.step += skip; this.nextT = this.t0 + this.step * sd;
    }
    while (this.nextT < ahead) { this.playStep(this.step, this.nextT); this.step++; this.nextT = this.t0 + this.step * sd; }
  }
  beats() {
    if (this.ok && this.running) return (this.ctx.currentTime - this.t0) / this.spb;
    return (performance.now() - this.perfStart) / 1000 / this.spb;
  }
  setLayers(map, time = 0.8) {
    if (!this.ok) return; const now = this.ctx.currentTime;
    for (const k in this.layers) this.layers[k].gain.setTargetAtTime((map[k] ?? 0) * LAYER_LEVEL[k], now, time / 3);
  }
  setFilter(f, time = 0.5) { if (this.ok) this.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, time / 3); }
  setMuted(m) { this.muted = m; if (this.ok) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05); }

  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  noise(dest, t, dur, vel, type, freq, q = 1, attack = 0.002) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); this.env(g, t, attack, vel, dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + attack + dur + 0.05);
  }
  drum(dest, t, f, dec, vel, slap) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 1.9, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    this.env(g, t, 0.003, vel, dec); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dec + 0.05);
    if (slap) this.noise(dest, t, 0.06, vel * 0.55, 'bandpass', 1900, 1.4);
    else this.noise(dest, t, 0.02, vel * 0.2, 'lowpass', 2500, 0.7);
  }
  tone(dest, t, f, dur, vel, type = 'triangle', cutoff = 4000, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f, t); fl.type = 'lowpass'; fl.frequency.value = cutoff;
    this.env(g, t, attack, vel, dur); o.connect(fl); fl.connect(g); g.connect(dest); o.start(t); o.stop(t + attack + dur + 0.05);
    return o;
  }
  flute(dest, t, m, dur, vel) {
    const c = this.ctx, f = mtof(m), o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), fl = c.createBiquadFilter();
    o.type = 'triangle'; o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    lfo.frequency.value = 5.6; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency);
    fl.type = 'lowpass'; fl.frequency.value = 3200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.04);
    g.gain.setValueAtTime(vel * 0.85, t + Math.max(0.05, dur - 0.06)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(fl); fl.connect(g); g.connect(dest); o.start(t); lfo.start(t); o.stop(t + dur + 0.12); lfo.stop(t + dur + 0.12);
    this.noise(dest, t, dur * 0.6, vel * 0.12, 'bandpass', f * 2, 3, 0.03);
  }
  playStep(s, t) {
    const L = this.layers, p = s % 16, bar = Math.floor(s / 16), ch = PROG[bar % 4], sd = this.spb / 4;
    if (p === 0 || p === 8) this.drum(L.tambora, t, 78, 0.32, 0.95);
    if (p === 12 && bar % 2 === 1) this.drum(L.tambora, t, 70, 0.25, 0.6);
    if (p % 4 === 2) this.drum(L.llamador, t, 205, 0.14, 0.85);
    const a = ALEGRE[bar % 2][p]; if (a) this.drum(L.alegre, t, a === 2 ? 340 : 250, a === 2 ? 0.07 : 0.13, a === 2 ? 0.5 : 0.75, a === 2);
    if (p % 4 === 0) this.noise(L.guacharaca, t, 0.07, 0.8, 'bandpass', 5200, 1.3, 0.05);
    else if (p % 4 !== 1) this.noise(L.guacharaca, t, 0.03, 0.5, 'bandpass', 5600, 1.3, 0.004);
    this.noise(L.maracas, t, 0.025, p % 2 ? 0.7 : 0.35, 'highpass', 7500, 0.7);
    const bassPat = { 0: [0, 0.32], 6: [7, 0.16], 8: [0, 0.26], 12: [7, 0.2], 14: [bar % 4 === 2 ? 4 : 5, 0.12] };
    if (bassPat[p]) { const [iv, d] = bassPat[p]; this.tone(L.bass, t, mtof(ch.r + iv), d, 0.9, 'triangle', 900); this.tone(L.bass, t, mtof(ch.r + iv - 12), d, 0.5, 'sine', 400); }
    if (p % 4 === 2) for (const n of ch.c) this.tone(L.chords, t, mtof(n), 0.1, 0.35, 'sawtooth', 1700);
    const ms = (bar % 4) * 16 + p;
    for (const [st, m, len] of MELODY) if (st === ms) this.flute(L.gaita, t, m, len * sd, 0.7);
    for (const [st, m] of BRASS) if (st === ms) { this.tone(L.brass, t, mtof(m), 0.16, 0.5, 'sawtooth', 2400, 0.01); this.tone(L.brass, t, mtof(m - 12), 0.16, 0.35, 'square', 1400, 0.01); }
    if (p === 0 && bar % 2 === 0) this.noise(L.crowd, t, 1.6, 0.35, 'bandpass', 1100, 0.6, 0.6);
    if (p === 4 && bar % 4 === 1) { const o = this.tone(L.crowd, t, 2600, 0.35, 0.18, 'sine', 9000, 0.01); o.frequency.setValueAtTime(2600, t); o.frequency.linearRampToValueAtTime(3100, t + 0.1); o.frequency.linearRampToValueAtTime(2500, t + 0.3); }
  }
  // efectos
  now() { return this.ctx.currentTime + 0.005; }
  sfxJump() { if (!this.ok) return; const t = this.now(), o = this.tone(this.sfx, t, 380, 0.12, 0.13, 'square', 2200); o.frequency.exponentialRampToValueAtTime(780, t + 0.1); }
  sfxLand() { if (!this.ok) return; this.noise(this.sfx, this.now(), 0.06, 0.25, 'lowpass', 420, 0.7); }
  sfxBounce() { if (!this.ok) return; const t = this.now(); this.drum(this.sfx, t, 95, 0.4, 1); const o = this.tone(this.sfx, t, 180, 0.3, 0.25, 'sine', 3000); o.frequency.exponentialRampToValueAtTime(520, t + 0.25); }
  sfxCollect(n) {
    if (!this.ok) return; const t = this.now(), base = [76, 79, 81, 84, 86, 88];
    [0, 2, 4].forEach((k, i) => { const m = base[(n + k) % base.length] + (k > 3 ? 12 : 0); this.tone(this.sfx, t + i * 0.06, mtof(m), 0.35, 0.22, 'triangle', 7000); this.tone(this.verb, t + i * 0.06, mtof(m + 12), 0.3, 0.08, 'sine', 9000); });
  }
  sfxChime() { if (!this.ok) return; const t = this.now(); [72, 79, 84].forEach((m, i) => this.tone(this.sfx, t + i * 0.09, mtof(m), 0.5, 0.2, 'sine', 8000)); }
  sfxFall() { if (!this.ok) return; const t = this.now(), o = this.tone(this.sfx, t, 1100, 0.6, 0.15, 'sine', 6000); o.frequency.exponentialRampToValueAtTime(220, t + 0.6); this.noise(this.sfx, t + 0.4, 1, 0.3, 'bandpass', 1000, 0.6, 0.2); }
  sfxTick() { if (!this.ok) return; this.tone(this.sfx, this.now(), 1500, 0.04, 0.12, 'square', 5000); }
  sfxUnlock() { if (!this.ok) return; const t = this.now(); [69, 73, 76, 81].forEach((m, i) => this.tone(this.sfx, t + i * 0.08, mtof(m), 0.4, 0.2, 'triangle', 6000)); }
  sfxFanfare() {
    if (!this.ok) return; const t = this.now();
    [[69, 0], [72, 0.12], [76, 0.24], [81, 0.36]].forEach(([m, d]) => { this.tone(this.sfx, t + d, mtof(m), 0.3, 0.22, 'sawtooth', 3000, 0.01); this.tone(this.verb, t + d, mtof(m), 0.3, 0.1, 'sawtooth', 3000, 0.01); });
    [69, 73, 76, 81].forEach((m) => this.tone(this.sfx, t + 0.5, mtof(m), 1.2, 0.12, 'sawtooth', 2600, 0.02));
    this.noise(this.sfx, t + 0.4, 2.2, 0.45, 'bandpass', 1200, 0.5, 0.4);
  }
}
const sound = new Sound();

// ---------------------------------------------------------------------------
// Renderizador, escena y posproceso
// ---------------------------------------------------------------------------
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let DPR = Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.6 : 2);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);
camera.position.set(0, 10, 18);

const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType, samples: IS_TOUCH ? 2 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(DPR);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.55, 1.2);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uWarm: { value: new THREE.Vector3(1.03, 1.0, 0.97) }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform vec3 uWarm; uniform float uFlash; uniform vec3 uFlashColor; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb *= uWarm; vec2 d = vUv - .5; c.rgb *= 1. - dot(d,d)*uVig*1.8; c.rgb = mix(c.rgb, uFlashColor, uFlash); gl_FragColor = c; }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());
let useComposer = true;

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xffc49a, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d6, 2.8);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const sunOff = new THREE.Vector3(-14, 30, 12);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, uGlobalSat: SAT },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform vec3 top, mid, bot, sunDir, sunCol; uniform float uGlobalSat; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(mid, top, smoothstep(0.02, 0.55, h)); col = mix(bot, col, smoothstep(-0.05, 0.16, h));
      float s = max(dot(d, normalize(sunDir)), 0.); col += sunCol * (pow(s, 900.)*14. + pow(s, 12.)*0.35);
      float l = dot(col, vec3(.2126,.7152,.0722)); col = mix(vec3(l), col, uGlobalSat); gl_FragColor = vec4(col, 1.); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), skyMat);
sky.frustumCulled = false; sky.renderOrder = -1;
scene.add(sky);
scene.fog = new THREE.Fog(0xf3d6b4, 70, 240);

const THEMES = {
  day: { top: '#2a6fd6', mid: '#8fc6ff', bot: '#ffd8a6', fog: '#f1d7b8', hs: '#cfe8ff', hg: '#ffc49a', hi: 1.05, sun: '#fff0d6', si: 2.8, off: [-14, 30, 12], exp: 1.05, bulbs: 0.5, windows: 0 },
  dusk: { top: '#131a55', mid: '#6d3b8c', bot: '#ff8a4c', fog: '#7a4466', hs: '#8a7cff', hg: '#ff9466', hi: 0.7, sun: '#ffa060', si: 1.5, off: [-22, 13, -28], exp: 1.15, bulbs: 0.25, windows: 0.25 },
};
let theme = THEMES.day;
function applyTheme(t) {
  theme = t;
  skyMat.uniforms.top.value.set(t.top); skyMat.uniforms.mid.value.set(t.mid); skyMat.uniforms.bot.value.set(t.bot);
  skyMat.uniforms.sunCol.value.set(t.sun); sunOff.set(...t.off); skyMat.uniforms.sunDir.value.copy(sunOff).normalize();
  scene.fog.color.set(t.fog); hemi.color.set(t.hs); hemi.groundColor.set(t.hg); hemi.intensity = t.hi;
  sun.color.set(t.sun); sun.intensity = t.si; renderer.toneMappingExposure = t.exp;
}

// ---------------------------------------------------------------------------
// Texturas procedurales (en caché)
// ---------------------------------------------------------------------------
function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const TEX = {};
function shade(hex, k) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); }
function speckle(g, w, h, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${R() * a})` : `rgba(255,255,255,${R() * a})`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); } }

function buildTextures() {
  TEX.wood = canvasTex(256, 256, (g, w, h) => {
    const cols = ['#b77a43', '#a86d3a', '#c58a50', '#9c6334'];
    for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.fillRect(0, i * 32, w, 32); g.fillStyle = 'rgba(60,30,10,.5)'; g.fillRect(0, i * 32, w, 2); }
    g.strokeStyle = 'rgba(70,35,10,.18)'; for (let i = 0; i < 90; i++) { g.lineWidth = 1 + R(); const y = R() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rr(-3, 3), w * .6, y + rr(-3, 3), w, y + rr(-2, 2)); g.stroke(); }
    speckle(g, w, h, 600, 0.08);
  }, { repeat: true });
  TEX.fringe = canvasTex(512, 128, (g, w, h) => {
    const stripes = [COL.rojo, COL.oro, COL.verde];
    for (let i = 0; i < 12; i++) { g.fillStyle = stripes[i % 3]; g.fillRect(i * w / 12, 0, w / 12 + 1, h); }
    g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(0, 0, w, 14);
    g.fillStyle = '#ffffff'; for (let i = 0; i < 24; i++) { g.beginPath(); g.arc(i * w / 24 + w / 48, h - 4, w / 48, Math.PI, 0); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 14, w, 3);
  }, { repeat: true });
  TEX.drumSide = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8a4b23'); gr.addColorStop(.5, '#a8612d'); gr.addColorStop(1, '#6f3818'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = COL.rojo; g.fillRect(0, 0, w, 26); g.fillStyle = COL.oro; g.fillRect(0, h - 30, w, 30);
    g.strokeStyle = '#f3e3c3'; g.lineWidth = 6; g.beginPath();
    for (let i = 0; i <= 12; i++) { const x = i * w / 12; g.lineTo(x, i % 2 ? h - 40 : 28); } g.stroke();
    g.fillStyle = '#5a2c10'; for (let i = 0; i < 12; i++) { const x = i * w / 12 + w / 24; g.beginPath(); g.moveTo(x - 9, h - 30); g.lineTo(x + 9, h - 30); g.lineTo(x, h - 62); g.fill(); }
    speckle(g, w, h, 500, 0.06);
  }, { repeat: true });
  TEX.drumTop = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, '#fbf0d8'); gr.addColorStop(.8, '#ead2a6'); gr.addColorStop(1, '#a87a45');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, 400, 0.05);
    g.strokeStyle = 'rgba(120,80,40,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, w * .44, 0, TAU); g.stroke();
  });
  TEX.sombrero = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#f1e4c4'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    for (let r = 250; r > 40; r -= 26) {
      g.strokeStyle = '#1c1712'; g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
      const n = Math.floor(r / 6); g.fillStyle = '#1c1712';
      for (let i = 0; i < n; i++) { const a = i / n * TAU; if (i % 2) continue; const x = cx + Math.cos(a) * (r - 13), y = cy + Math.sin(a) * (r - 13); g.save(); g.translate(x, y); g.rotate(a + Math.PI / 4); g.fillRect(-3.2, -3.2, 6.4, 6.4); g.restore(); }
    }
  });
  TEX.street = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8a7f74'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const o = (y % 2) * 16; g.fillStyle = shade('#8f8478', rr(-0.06, 0.05)); g.fillRect(x * 32 + o + 1.5, y * 32 + 1.5, 29, 29); }
    speckle(g, w, h, 800, 0.08);
  }, { repeat: true });
  TEX.stripes = canvasTex(256, 64, (g, w, h) => { const cs = [COL.fucsia, '#fff7ea', COL.turq, '#fff7ea', COL.oro, '#fff7ea']; for (let i = 0; i < 12; i++) { g.fillStyle = cs[i % 6]; g.fillRect(i * w / 12, 0, w / 12 + 1, h); } }, { repeat: true });
  TEX.sign = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = COL.oro; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#0f1747'; g.lineWidth = 10; g.setLineDash([22, 14]); g.strokeRect(18, 18, w - 36, h - 36); g.setLineDash([]);
    g.fillStyle = '#0f1747'; g.textAlign = 'center'; g.font = '86px Shrikhand, Georgia, serif'; g.fillText('TU MARCA', w / 2, 140);
    g.font = '800 34px "Bricolage Grotesque", sans-serif'; g.fillText('ESTACIÓN DE AYUDA · +10 s', w / 2, 200);
  });
  TEX.pico = canvasTex(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, COL.fucsia); gr.addColorStop(.5, COL.naranja); gr.addColorStop(1, COL.oro);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,255,255,${0.06 + R() * 0.12})`; g.beginPath(); g.moveTo(w / 2, h * .25); g.arc(w / 2, h * .25, w, i / 14 * TAU, (i + .5) / 14 * TAU); g.fill(); }
    g.textAlign = 'center'; g.font = '92px Shrikhand, Georgia, serif'; g.lineWidth = 14; g.strokeStyle = '#0f1747'; g.strokeText('El Tesoro', w / 2, 120); g.fillStyle = '#fff7ea'; g.fillText('El Tesoro', w / 2, 120);
    for (const [x, y, r] of [[w * .3, h * .62, 92], [w * .7, h * .62, 92]]) {
      g.fillStyle = '#111'; g.beginPath(); g.arc(x, y, r + 10, 0, TAU); g.fill();
      const cg = g.createRadialGradient(x, y, 4, x, y, r); cg.addColorStop(0, '#555'); cg.addColorStop(.3, '#1b1b1b'); cg.addColorStop(.85, '#2a2a2a'); cg.addColorStop(1, '#0b0b0b');
      g.fillStyle = cg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = '#c0c0c0'; g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fill();
    }
    g.fillStyle = '#0f1747'; g.fillRect(0, h - 40, w, 40); g.fillStyle = COL.oro; g.font = '800 26px "Bricolage Grotesque", sans-serif'; g.fillText('SONIDO DE BARRIO', w / 2, h - 12);
  });
  TEX.tent = canvasTex(256, 256, (g, w, h) => { const cs = [COL.rojo, '#fff7ea']; for (let i = 0; i < 10; i++) { g.fillStyle = cs[i % 2]; g.fillRect(i * w / 10, 0, w / 10 + 1, h); } });
  TEX.mask = canvasTex(512, 256, (g, w, h) => { // tela de la marimonda: retazos de colores
    const cs = [COL.rojo, COL.oro, COL.cobalto, COL.verde, COL.fucsia, COL.naranja];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { g.fillStyle = cs[(x + y * 3) % cs.length]; g.fillRect(x * w / 8, y * h / 4, w / 8 + 1, h / 4 + 1); }
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.setLineDash([8, 6]);
    for (let x = 1; x < 8; x++) { g.beginPath(); g.moveTo(x * w / 8, 0); g.lineTo(x * w / 8, h); g.stroke(); }
    for (let y = 1; y < 4; y++) { g.beginPath(); g.moveTo(0, y * h / 4); g.lineTo(w, y * h / 4); g.stroke(); }
  }, { repeat: true });
  TEX.trunk = canvasTex(64, 256, (g, w, h) => { const cs = [COL.rojo, COL.oro, COL.verde, COL.cobalto]; for (let i = 0; i < 16; i++) { g.fillStyle = cs[i % 4]; g.fillRect(0, i * h / 16, w, h / 16 + 1); } }, { repeat: true });
  buildFacades();
}

const FACADES = [
  ['#f2b632', '#fffaf0', '#1e7fa8'], ['#e8457a', '#fff3e0', '#2f9e6e'], ['#2bb3b1', '#fff8e7', '#e55934'], ['#f07f3c', '#ffffff', '#3d5ba9'],
  ['#7cc576', '#fffbea', '#d9346a'], ['#5a7de0', '#ffffff', '#f6c344'], ['#f3dc6b', '#e2574c', '#2a8f8a'], ['#c95bd6', '#fff4f8', '#ffcc33'],
];
const SHOPS = ['Tienda Doña Toña', 'Variedades Marimonda', 'Kiosko El Tambor', 'Panadería La Cumbia', 'Droguería La Esquina', 'Sastrería El Congo'];
function buildFacades() {
  TEX.facades = FACADES.map(([wall, trim, shut], v) => {
    const W = 512, H = 960, lit = [];
    const map = canvasTex(W, H, (g) => {
      g.fillStyle = wall; g.fillRect(0, 0, W, H);
      speckle(g, W, H, 2500, 0.05);
      const gr = g.createLinearGradient(0, H * 0.8, 0, H); gr.addColorStop(0, 'rgba(70,40,20,0)'); gr.addColorStop(1, 'rgba(70,40,20,.28)'); g.fillStyle = gr; g.fillRect(0, H * .8, W, H * .2);
      // pretil con balaustres
      g.fillStyle = trim; g.fillRect(0, 0, W, H * 0.075);
      g.fillStyle = shade(wall, -0.05); for (let i = 0; i < 14; i++) g.fillRect(24 + i * 34, 16, 16, H * .075 - 30);
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, H * .075, W, 8);
      // pilastras y cornisa
      g.fillStyle = trim; g.fillRect(0, 0, W * .055, H); g.fillRect(W * .945, 0, W * .055, H);
      g.fillRect(0, H * .49, W, H * .028); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, H * .518, W, 7);
      g.fillStyle = trim; g.fillRect(0, H * .965, W, H * .035);
      const win = (cx, top, ww, hh, arch, kind) => {
        g.fillStyle = trim; g.beginPath();
        if (arch) { g.moveTo(cx - ww / 2 - 12, top + hh + 10); g.lineTo(cx - ww / 2 - 12, top + ww / 2); g.arc(cx, top + ww / 2, ww / 2 + 12, Math.PI, 0); g.lineTo(cx + ww / 2 + 12, top + hh + 10); }
        else g.rect(cx - ww / 2 - 12, top - 12, ww + 24, hh + 22);
        g.fill();
        g.save(); g.beginPath();
        if (arch) { g.moveTo(cx - ww / 2, top + hh); g.lineTo(cx - ww / 2, top + ww / 2); g.arc(cx, top + ww / 2, ww / 2, Math.PI, 0); g.lineTo(cx + ww / 2, top + hh); g.closePath(); }
        else g.rect(cx - ww / 2, top, ww, hh);
        g.clip();
        const open = kind !== 'door' && R() < 0.4;
        if (open) { g.fillStyle = '#2a1a14'; g.fillRect(cx - ww / 2, top, ww, hh); g.fillStyle = 'rgba(255,190,120,.25)'; g.fillRect(cx - ww / 2, top + hh * .4, ww, hh * .6); lit.push([cx, top, ww, hh, arch, true]); }
        else {
          g.fillStyle = shut; g.fillRect(cx - ww / 2, top, ww, hh);
          g.fillStyle = 'rgba(0,0,0,.22)'; for (let y = top + 6; y < top + hh; y += 11) g.fillRect(cx - ww / 2, y, ww, 3);
          g.fillStyle = 'rgba(255,255,255,.15)'; for (let y = top + 9; y < top + hh; y += 11) g.fillRect(cx - ww / 2, y, ww, 1.5);
          g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(cx - 2, top, 4, hh);
          lit.push([cx, top, ww, hh, arch, false]);
        }
        g.restore();
        if (kind === 'reja') { g.fillStyle = 'rgba(25,20,30,.85)'; for (let x = cx - ww / 2 + 8; x < cx + ww / 2; x += 14) g.fillRect(x, top, 3.5, hh); g.fillRect(cx - ww / 2, top + hh * .5, ww, 3.5); }
      };
      [0.22, 0.5, 0.78].forEach((fx) => win(W * fx, H * .17, W * .16, H * .29, v % 2 === 0, 'balcon'));
      win(W * .5, H * .63, W * .23, H * .335, true, 'door');
      win(W * .19, H * .67, W * .15, H * .2, false, 'reja');
      win(W * .81, H * .67, W * .15, H * .2, false, 'reja');
      if (v < SHOPS.length) {
        g.fillStyle = trim; g.fillRect(W * .2, H * .545, W * .6, H * .062);
        g.fillStyle = shut; g.textAlign = 'center'; g.textBaseline = 'middle';
        let fs = 40; g.font = `${fs}px Shrikhand, Georgia, serif`;
        while (g.measureText(SHOPS[v]).width > W * .56 && fs > 20) { fs -= 2; g.font = `${fs}px Shrikhand, Georgia, serif`; }
        g.fillText(SHOPS[v], W / 2, H * .578);
      }
    });
    const emis = canvasTex(W, H, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      for (const [cx, top, ww, hh, arch, open] of lit) {
        if (!open && R() < 0.5) continue;
        g.fillStyle = open ? '#ffb05a' : '#7a4a20';
        g.beginPath(); if (arch) { g.moveTo(cx - ww / 2, top + hh); g.lineTo(cx - ww / 2, top + ww / 2); g.arc(cx, top + ww / 2, ww / 2, Math.PI, 0); g.lineTo(cx + ww / 2, top + hh); } else g.rect(cx - ww / 2, top, ww, hh); g.fill();
      }
    });
    return { map, emis, wall, trim, shut };
  });
}

// ---------------------------------------------------------------------------
// Utilidades de geometría
// ---------------------------------------------------------------------------
function colorGeo(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
function placed(geo, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
  return geo.applyMatrix4(m);
}
const MAT_CACHE = new Map();
const TEX_CLONES = [];
function texClone(t, rx = 1, ry = 1) { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); TEX_CLONES.push(c); return c; }
function mat(hex, opts = {}) {
  const key = hex + JSON.stringify(opts);
  if (!MAT_CACHE.has(key)) MAT_CACHE.set(key, new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.7, metalness: 0 }, opts)));
  return MAT_CACHE.get(key);
}
function mesh(geo, material, shadow = true) { const m = new THREE.Mesh(geo, material); m.castShadow = shadow; m.receiveShadow = shadow; return m; }

function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (!m.userData.keep && ![...MAT_CACHE.values()].includes(m)) m.dispose(); });
  });
}

// ---------------------------------------------------------------------------
// Modelos: tesoros, carrozas, personajes
// ---------------------------------------------------------------------------
function makeTambor(s = 1) {
  const g = new THREE.Group();
  const side = new THREE.MeshStandardMaterial({ map: TEX.drumSide, roughness: 0.6 });
  const body = mesh(new THREE.CylinderGeometry(0.62, 0.5, 1.3, 32, 1, true), side); body.position.y = 0.65; g.add(body);
  const top = mesh(new THREE.CircleGeometry(0.62, 32), new THREE.MeshStandardMaterial({ map: TEX.drumTop, roughness: 0.8 })); top.rotation.x = -Math.PI / 2; top.position.y = 1.3; g.add(top);
  const bottom = mesh(new THREE.CircleGeometry(0.5, 24), mat('#5a2c10')); bottom.rotation.x = Math.PI / 2; g.add(bottom);
  const ring = mesh(new THREE.TorusGeometry(0.63, 0.05, 8, 40), mat('#3b1d0b')); ring.rotation.x = Math.PI / 2; ring.position.y = 1.27; g.add(ring);
  const ring2 = mesh(new THREE.TorusGeometry(0.52, 0.045, 8, 40), mat('#3b1d0b')); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.2; g.add(ring2);
  g.scale.setScalar(s); return g;
}

function makeMarimonda(s = 1) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ map: TEX.mask, roughness: 0.85 });
  const head = mesh(new THREE.SphereGeometry(0.62, 32, 24), cloth); head.scale.set(1, 1.08, 0.95); head.position.y = 0.7; g.add(head);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.62, 0.5), new THREE.Vector3(0, 0.3, 0.72), new THREE.Vector3(0, -0.15, 0.8), new THREE.Vector3(0.05, -0.55, 0.72), new THREE.Vector3(0.12, -0.75, 0.95), new THREE.Vector3(0.12, -0.62, 1.15)]);
  const trunkTex = texClone(TEX.trunk, 1, 3);
  const trunk = mesh(new THREE.TubeGeometry(curve, 48, 0.12, 12, false), new THREE.MeshStandardMaterial({ map: trunkTex, roughness: 0.8 })); trunk.position.y = 0.7; g.add(trunk);
  const tip = mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(COL.rojo)); tip.position.set(0.12, 0.08, 1.15); g.add(tip);
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 28), mat(sx < 0 ? COL.oro : COL.verde, { roughness: 0.8 })); ear.rotation.z = Math.PI / 2; ear.rotation.y = sx * 0.35; ear.position.set(sx * 0.78, 0.95, 0); g.add(ear);
    const rim = mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 32), mat(COL.rojo)); rim.rotation.y = Math.PI / 2 + sx * 0.35; rim.position.copy(ear.position); g.add(rim);
    const eye = mesh(new THREE.TorusGeometry(0.13, 0.055, 10, 24), mat('#ffffff', { roughness: 0.4 })); eye.position.set(sx * 0.22, 0.95, 0.56); eye.rotation.y = sx * 0.3; g.add(eye);
    const pupil = mesh(new THREE.CircleGeometry(0.09, 18), mat('#111111', { side: THREE.DoubleSide })); pupil.position.set(sx * 0.222, 0.95, 0.565); pupil.rotation.y = sx * 0.3; g.add(pupil);
  }
  const mouth = mesh(new THREE.TorusGeometry(0.14, 0.045, 8, 24), mat('#ffffff')); mouth.scale.set(1.4, 0.7, 1); mouth.position.set(0, 0.35, 0.56); g.add(mouth);
  const mouthIn = mesh(new THREE.CircleGeometry(0.14, 20), mat(COL.rojo, { side: THREE.DoubleSide })); mouthIn.scale.set(1.4, 0.7, 1); mouthIn.position.set(0, 0.35, 0.565); g.add(mouthIn);
  g.scale.setScalar(s); return g;
}

function makePollera(s = 1) {
  const g = new THREE.Group();
  const layers = [[COL.rojo, 0.0, 1.35], ['#fff7ea', 0.28, 1.15], [COL.oro, 0.52, 0.95], ['#fff7ea', 0.74, 0.76]];
  layers.forEach(([c, y, r]) => {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(lerp(r * 0.55, r, t) + Math.sin(t * Math.PI) * 0.02, 0.42 - t * 0.42)); }
    const geo = new THREE.LatheGeometry(pts, 48);
    const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 14) * 0.035 * (0.42 - pos.getY(i)) / 0.42 * 2; pos.setX(i, x * k); pos.setZ(i, z * k); }
    geo.computeVertexNormals();
    const m = mesh(geo, mat(c, { side: THREE.DoubleSide, roughness: 0.75 })); m.position.y = y; g.add(m);
  });
  const waist = mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.5, 24), mat('#fff7ea')); waist.position.y = 1.35; g.add(waist);
  const torso = mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.55, 24), mat('#fff7ea')); torso.position.y = 1.85; g.add(torso);
  const ruffle = mesh(new THREE.TorusGeometry(0.42, 0.09, 10, 36), mat(COL.rojo)); ruffle.rotation.x = Math.PI / 2; ruffle.position.y = 2.1; g.add(ruffle);
  const stand = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), mat('#3b2a20')); stand.position.y = 2.4; g.add(stand);
  for (let i = 0; i < 5; i++) { const f = mesh(new THREE.SphereGeometry(0.12, 12, 10), mat([COL.rojo, COL.fucsia, COL.oro][i % 3])); f.position.set(Math.cos(i / 5 * TAU) * 0.16, 2.72, Math.sin(i / 5 * TAU) * 0.16); g.add(f); }
  g.scale.setScalar(s); return g;
}

function makeCongoHat(s = 1) {
  const g = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(0.5, 0.55, 1.6, 24), mat('#fff7ea')); base.position.y = 0.8; g.add(base);
  for (let i = 0; i < 26; i++) { const a = R() * TAU, y = 0.25 + R() * 1.6; const f = mesh(new THREE.SphereGeometry(0.15 + R() * 0.07, 10, 8), mat(pick(FESTIVE), { roughness: 0.6 }), false); f.position.set(Math.cos(a) * 0.53, y, Math.sin(a) * 0.53); g.add(f); }
  for (let i = 0; i < 8; i++) { const r = mesh(new THREE.BoxGeometry(0.1, 1.4, 0.02), mat(FESTIVE[i % FESTIVE.length]), false); const a = i / 8 * TAU; r.position.set(Math.cos(a) * 0.58, -0.6, Math.sin(a) * 0.58); r.rotation.y = -a; g.add(r); }
  g.scale.setScalar(s); return g;
}

function makeTorito(s = 1) {
  const g = new THREE.Group();
  const head = mesh(new THREE.SphereGeometry(0.7, 24, 18), mat('#1b1512', { roughness: 0.5 })); head.scale.set(1, 0.9, 1.15); g.add(head);
  const snout = mesh(new THREE.SphereGeometry(0.42, 18, 14), mat('#2b211c')); snout.position.set(0, -0.25, 0.68); snout.scale.set(1, 0.75, 0.9); g.add(snout);
  for (const sx of [-1, 1]) {
    const horn = mesh(new THREE.ConeGeometry(0.13, 0.9, 12), mat('#fff3dc')); horn.position.set(sx * 0.68, 0.48, 0.1); horn.rotation.z = -sx * 0.9; g.add(horn);
    const eye = mesh(new THREE.SphereGeometry(0.1, 12, 10), mat('#ffffff')); eye.position.set(sx * 0.3, 0.12, 0.66); g.add(eye);
  }
  for (let i = 0; i < 10; i++) { const f = mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(pick(FESTIVE)), false); const a = (i / 9 - 0.5) * 2.2; f.position.set(Math.sin(a) * 0.62, 0.55 + Math.cos(a) * 0.12, Math.cos(a) * 0.2 - 0.1); g.add(f); }
  g.scale.setScalar(s); return g;
}

function makeCarroza(kind) {
  const g = new THREE.Group();
  const skirtTex = texClone(TEX.fringe, 3, 1);
  const base = mesh(new THREE.BoxGeometry(8, 1.6, 4.4), [mat('#fff7ea'), mat('#fff7ea'), mat(COL.cobalto), mat('#222'), new THREE.MeshStandardMaterial({ map: skirtTex }), new THREE.MeshStandardMaterial({ map: skirtTex })], false);
  base.position.y = 1.1; g.add(base);
  const deck = mesh(new THREE.BoxGeometry(7.4, 0.5, 3.8), mat(pick([COL.fucsia, COL.turq, COL.oro])), false); deck.position.y = 2.15; g.add(deck);
  let fig;
  if (kind === 'marimonda') { fig = makeMarimonda(2.4); fig.position.set(0, 2.5, 0); }
  else if (kind === 'torito') { fig = makeTorito(2.2); fig.position.set(0, 4.6, 0); }
  else if (kind === 'congo') { fig = makeCongoHat(2.2); fig.position.set(0, 2.4, 0); }
  else { fig = new THREE.Group(); for (let i = -1; i <= 1; i++) { const d = makeTambor(1.6 + (i === 0 ? 0.6 : 0)); d.position.set(i * 2.2, 2.4, 0); fig.add(d); } }
  g.add(fig);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), BULB_MAT, 26);
  const m4 = new THREE.Matrix4(); for (let i = 0; i < 26; i++) { const t = i / 25; m4.makeTranslation(-3.9 + t * 7.8, 1.95, 2.25); bulbs.setMatrixAt(i, m4); } g.add(bulbs);
  return g;
}

const BULB_MAT = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.78, 0.45) }); BULB_MAT.userData.keep = true;
function setBulbs(k) { BULB_MAT.color.setRGB(1 * k, 0.78 * k, 0.45 * k); }

function makePlayer() {
  const root = new THREE.Group(), body = new THREE.Group(), face = new THREE.Group();
  root.add(face); face.add(body);
  const skin = mat('#c98a5e', { roughness: 0.6 }), shirt = mat('#fbf7ef', { roughness: 0.8 }), pants = mat('#2a3f8f'), shoe = mat('#3a2416'), red = mat('#d7263d');
  const torso = mesh(new THREE.CapsuleGeometry(0.3, 0.42, 6, 16), shirt); torso.position.y = 1.05; body.add(torso);
  const belt = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 18), mat('#5a3a22')); belt.position.y = 0.8; body.add(belt);
  const scarf = mesh(new THREE.ConeGeometry(0.2, 0.32, 3), red); scarf.position.set(0, 1.3, 0.22); scarf.rotation.set(Math.PI + 0.3, 0, 0); body.add(scarf);
  const knot = mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 18), red); knot.rotation.x = Math.PI / 2; knot.position.y = 1.42; body.add(knot);
  const head = new THREE.Group(); head.position.y = 1.72; body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.3, 24, 18), skin));
  for (const sx of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.045, 10, 8), mat('#1a120c', { roughness: 0.3 }), false); eye.position.set(sx * 0.11, 0.03, 0.27); head.add(eye);
    const ear = mesh(new THREE.SphereGeometry(0.07, 10, 8), skin, false); ear.position.set(sx * 0.29, 0, 0); head.add(ear);
  }
  const nose = mesh(new THREE.SphereGeometry(0.05, 10, 8), skin, false); nose.position.set(0, -0.04, 0.3); head.add(nose);
  const brim = mesh(new THREE.CylinderGeometry(0.66, 0.68, 0.035, 40), [mat('#e8d7b0'), new THREE.MeshStandardMaterial({ map: TEX.sombrero, roughness: 0.85 }), mat('#d9c59c')]);
  brim.position.y = 0.2; brim.rotation.x = -0.08; head.add(brim);
  const crown = mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.3, 24), new THREE.MeshStandardMaterial({ map: TEX.sombrero, roughness: 0.85 })); crown.position.y = 0.36; head.add(crown);
  const crownTop = mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, TAU, 0, Math.PI / 2), mat('#e8d7b0')); crownTop.position.y = 0.5; crownTop.scale.y = 0.35; head.add(crownTop);
  const pack = mesh(new THREE.BoxGeometry(0.42, 0.5, 0.22), mat('#c2773a')); pack.position.set(0, 1.1, -0.32); body.add(pack);
  const flap = mesh(new THREE.BoxGeometry(0.44, 0.2, 0.24), mat(COL.oro)); flap.position.set(0, 1.3, -0.32); body.add(flap);
  const limbs = {};
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * 0.4, 1.32, 0); body.add(arm);
    const a = mesh(new THREE.CapsuleGeometry(0.085, 0.36, 4, 10), shirt); a.position.y = -0.24; arm.add(a);
    const hand = mesh(new THREE.SphereGeometry(0.09, 10, 8), skin); hand.position.y = -0.5; arm.add(hand);
    const leg = new THREE.Group(); leg.position.set(sx * 0.15, 0.78, 0); body.add(leg);
    const thigh = mesh(new THREE.CapsuleGeometry(0.12, 0.2, 4, 10), pants); thigh.position.y = -0.16; leg.add(thigh);
    const shin = mesh(new THREE.CapsuleGeometry(0.085, 0.24, 4, 10), skin); shin.position.y = -0.46; leg.add(shin);
    const foot = mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), shoe); foot.position.set(0, -0.68, 0.05); leg.add(foot);
    limbs[sx < 0 ? 'armL' : 'armR'] = arm; limbs[sx < 0 ? 'legL' : 'legR'] = leg;
  }
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.material.userData.noSat = true; blob.renderOrder = 2;
  return { root, body, face, head, limbs, blob };
}

function makeDancer(type) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skinTone = pick(['#8d5a3b', '#c98a5e', '#6b4129', '#e0aa7f']);
  const parts = { body, arms: [] };
  const torsoCol = type === 'cumbia' ? '#fff7ea' : type === 'congo' ? pick([COL.rojo, COL.oro, COL.cobalto]) : pick(FESTIVE);
  const torso = mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 12), mat(torsoCol), false); torso.position.y = 1.15; body.add(torso);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * 0.38, 1.45, 0); body.add(arm);
    const a = mesh(new THREE.CapsuleGeometry(0.08, 0.45, 4, 8), mat(torsoCol), false); a.position.y = -0.28; arm.add(a);
    parts.arms.push(arm);
    const leg = mesh(new THREE.CapsuleGeometry(0.1, 0.55, 4, 8), mat('#2a2238'), false); leg.position.set(sx * 0.14, 0.42, 0); body.add(leg);
  }
  if (type === 'marimonda') { const m = makeMarimonda(0.42); m.position.y = 1.55; body.add(m); }
  else {
    const head = mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(skinTone), false); head.position.y = 1.85; body.add(head);
    if (type === 'congo') { const h = makeCongoHat(0.45); h.position.y = 2.05; body.add(h); }
    if (type === 'cumbia') {
      const skirt = makePollera(0.62); skirt.children.slice(4).forEach((c) => (c.visible = false)); skirt.position.y = 0.05; body.add(skirt); parts.skirt = skirt;
      const flower = mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(COL.rojo), false); flower.position.set(0.18, 2.05, 0); body.add(flower);
      const candle = new THREE.Group(); const cw = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), mat('#fff7ea'), false); candle.add(cw);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.4) })); flame.position.y = 0.24; flame.scale.y = 1.6; candle.add(flame);
      candle.position.set(0, -0.6, 0.05); parts.arms[1].add(candle);
    }
    if (type === 'tambor') { const d = makeTambor(0.5); d.position.set(0, 0.7, 0.45); d.rotation.x = 0.3; body.add(d); }
  }
  parts.type = type;
  return { g, parts };
}

// ---------------------------------------------------------------------------
// Datos de niveles
// ---------------------------------------------------------------------------
const T = (x, y, z, w, d, o = {}) => Object.assign({ t: 'tarima', x, y, z, w, d }, o);
const Bt = (x, y, z, g, w = 3, d = 3) => ({ t: 'beat', x, y, z, w, d, g });
const D = (x, y, z, r = 1.3) => ({ t: 'drum', x, y, z, r });
const M = (x, y, z, w, d, mv) => ({ t: 'move', x, y, z, w, d, mv });
const P = (x, y, z) => ({ t: 'pico', x, y, z, w: 2.8, d: 2.8 });
const Lg = (x, y, z, w, d) => ({ t: 'ledge', x, y, z, w, d });

const LEVELS = [
  {
    id: 'ritmo', name: 'Encuentra el ritmo', theme: 'day', time: 95, pickup: 'nota', pickupName: 'notas', pickupOne: 'nota', treasure: 'tambor', treasureName: 'el tambor alegre',
    intro: 'La comparsa perdió el compás. Reúne las <strong>6 notas</strong> para que vuelva la cumbia. Las baldosas de colores aparecen y desaparecen con el ritmo: salta cuando se enciendan.',
    note: 'El tambor alegre lleva la voz cantante en la cumbia: improvisa encima del llamador y la tambora.',
    start: [0, 3, 2],
    platforms: [
      T(0, 3, 0, 7, 9), T(0, 3, -9, 4, 4), T(2.5, 3.8, -14.5, 3.5, 3.5),
      Bt(0, 4.2, -20, 0), Bt(-1.5, 4.2, -25, 1), Bt(0, 4.2, -30, 0), Bt(1.5, 4.6, -35, 1),
      T(0, 4.6, -41.5, 6, 6), D(3, 4.6, -47.5), T(3, 8, -53.5, 4, 4),
      T(0, 8, -61, 7, 7), M(0, 8, -68.5, 3, 3, { ax: 3.5, sp: 1.2 }), T(0, 8, -75.5, 5, 5), T(-5, 8.6, -75.5, 2.5, 2.5),
      Bt(0, 7.6, -81.5, 0), Bt(2, 7.2, -86.5, 1), Bt(0, 6.8, -91.5, 0), Bt(-2, 6.4, -96.5, 1),
      T(0, 6, -102.5, 5, 5), D(0, 6, -109), T(0, 9.5, -117, 5, 5), T(0, 9.5, -126, 8, 9),
    ],
    pickups: [[2.5, 5.3, -14.5], [1.5, 6.1, -35], [3, 9.2, -50.5], [-5, 10, -75.5], [2, 8.7, -86.5], [0, 10.6, -112.5]],
    station: [0, 8, -61], goal: [0, 9.5, -128],
  },
  {
    id: 'colores', name: 'Recupera los colores', theme: 'day', time: 105, pickup: 'gota', pickupName: 'gotas de color', pickupOne: 'gota de color', treasure: 'marimonda', treasureName: 'la máscara de marimonda',
    intro: 'Alguien se llevó los colores del desfile. Cada <strong>gota de color</strong> que atrapes le devuelve la vida a la calle. Son 6 y algunas están escondidas en los balcones.',
    note: 'La marimonda nació en Barranquilla como disfraz popular y burlón: trompa larga, orejas enormes y retazos de colores.',
    start: [0, 3, 2],
    platforms: [
      T(0, 3, 0, 7, 9), T(-2.5, 3.5, -8.5, 4, 4), Lg(-6.5, 4.5, -14, 3, 4), T(-2, 5, -20, 3.5, 3.5),
      M(2, 5.2, -26, 3, 3, { ay: 1.2, sp: 1.0 }), T(4, 6, -31.5, 3.5, 3.5), T(0, 6, -37.5, 4, 4), D(-3.5, 6, -43),
      Lg(-7, 10, -49, 3, 4), T(-3, 9, -56, 6, 6), M(0, 9, -64.5, 3, 3, { ax: 3, sp: 1.1, ph: -Math.PI / 2 }), T(0, 9, -70, 4, 4),
      Lg(6.5, 9.8, -75, 3, 3.5), T(0, 8.5, -76, 3, 3), T(-3, 8, -81, 3, 3), T(0, 7.5, -86, 3, 3),
      M(0, 7.5, -93, 3, 3, { az: 2, sp: 0.9 }), T(0, 7.5, -101, 4, 4), D(3, 7.5, -107), T(3, 11, -114, 4, 4), T(0, 11, -123, 8, 9),
    ],
    pickups: [[-6.5, 6, -14], [4, 7.5, -31.5], [-7, 11.4, -49], [6.5, 11.2, -75], [0, 9, -101], [3, 12.2, -110.5]],
    station: [-3, 9, -56], goal: [0, 11, -125],
  },
  {
    id: 'fiesta', name: 'Enciende la fiesta', theme: 'dusk', time: 110, pickup: 'farol', pickupName: 'faroles', pickupOne: 'farol', treasure: 'pollera', treasureName: 'el vestuario de cumbia',
    intro: 'Cae la tarde y la verbena sigue a oscuras. Enciende los <strong>6 faroles</strong> para prender las luces. Los picós te impulsan alto y las carrozas voladoras no se detienen.',
    note: 'La pollera amplia y las flores en el cabello acompañan el baile de la cumbia, que se baila con velas encendidas en la mano.',
    start: [0, 3, 2],
    platforms: [
      T(0, 3, 0, 7, 9), P(0, 3, -8), T(0, 6.5, -15.5, 4, 4),
      Bt(-2, 6.5, -21, 0), Bt(0, 6.5, -26, 1), Bt(2, 6.9, -31, 0), Bt(0, 7.2, -36, 1),
      T(0, 7.2, -42, 5, 5), M(0, 7.2, -49, 3.2, 3.2, { ax: 4, sp: 1.25 }), M(0, 7.2, -55, 3.2, 3.2, { ax: 4, sp: 1.25, ph: Math.PI }),
      T(0, 7.2, -61.5, 6, 6), T(-6, 8, -61.5, 2.5, 2.5), T(0, 7.2, -68.5, 3, 3), P(0, 5, -74), T(0, 8.6, -81.5, 4, 4),
      Bt(2.5, 8.6, -87, 0), Bt(0, 8.6, -92, 1), Bt(-2.5, 8.6, -97, 0), T(0, 8.6, -103, 5, 5),
      M(0, 8.6, -110, 3.2, 3.2, { az: 2.2, sp: 1 }), T(0, 8.6, -118.5, 4, 4), T(5.5, 9.4, -118.5, 2.5, 2.5), T(0, 8.6, -127, 8, 9),
    ],
    pickups: [[0, 7.4, -11.5], [2, 8.3, -31], [-6, 9.3, -61.5], [0, 9.6, -77.5], [0, 10, -92], [5.5, 10.7, -118.5]],
    station: [0, 7.2, -61.5], goal: [0, 8.6, -129],
  },
];

// ---------------------------------------------------------------------------
// Construcción del entorno (calle caribeña + plaza) y del nivel
// ---------------------------------------------------------------------------
let world = null;      // grupo que se reconstruye por nivel
const level = { i: 0, data: null, platforms: [], pickups: [], collected: 0, time: 0, checkpoint: new THREE.Vector3(), station: null, goal: null, unlocked: false, floats: [], plazaZ: 0, flags: null, banner: null };

function buildStreet(L, goalZ) {
  R = mulberry32(1000 + L.id.length * 77);
  const zStart = 46, zEnd = goalZ - 10, plazaZ = goalZ - 34;
  level.plazaZ = plazaZ;
  const bodyGeos = [], facadeGeos = TEX.facades.map(() => []), balconies = [], cornices = [], palms = [];
  const addBuilding = (x, z, side, w, H, v) => {
    // side: +1 fachada mira a +x (lado izquierdo), -1 mira a -x, 'back' mira a +z
    const depth = 9;
    let body, plane;
    if (side === 'back') {
      body = placed(new THREE.BoxGeometry(w, H, depth), x, H / 2, z - depth / 2);
      plane = placed(new THREE.PlaneGeometry(w, H), x, H / 2, z + 0.02);
    } else {
      body = placed(new THREE.BoxGeometry(depth, H, w), x - side * depth / 2, H / 2, z);
      plane = placed(new THREE.PlaneGeometry(w, H), x + side * 0.02, H / 2, z, 0, side * Math.PI / 2, 0);
    }
    bodyGeos.push(colorGeo(body, shade(TEX.facades[v].wall, -0.08)));
    facadeGeos[v].push(plane);
    const by = H * 0.53;
    if (side === 'back') balconies.push({ p: [x, by, z + 0.55], ry: 0, c: TEX.facades[v].shut });
    else balconies.push({ p: [x + side * 0.55, by, z], ry: side * Math.PI / 2, c: TEX.facades[v].shut });
    if (side === 'back') cornices.push({ p: [x, H, z + 0.2], ry: 0, w });
    else cornices.push({ p: [x + side * 0.2, H, z], ry: side * Math.PI / 2, w });
  };
  for (const side of [1, -1]) {
    const x = side > 0 ? -12.5 : 12.5;
    let z = zStart;
    while (z - 4 > zEnd) {
      const w = 8, H = rr(15, 19), v = Math.floor(R() * FACADES.length);
      addBuilding(x, z - w / 2, side, w, H, v);
      if (R() < 0.35) palms.push([x + side * 1.6, z - w, rr(5.5, 7.5)]);
      z -= w;
    }
  }
  for (let x = -44; x <= 44; x += 8) addBuilding(x, plazaZ - 26, 'back', 8, rr(16, 21), Math.floor(R() * FACADES.length));
  for (const side of [1, -1]) for (let z = goalZ - 16; z > plazaZ - 24; z -= 8) addBuilding(side > 0 ? -46 : 46, z, side, 8, rr(14, 18), Math.floor(R() * FACADES.length));
  // bloques de esquina entre la calle y la plaza
  for (const sx of [-1, 1]) { const b = placed(new THREE.BoxGeometry(32, 17, 6), sx * 30, 8.5, zEnd - 3); bodyGeos.push(colorGeo(b, shade(pick(FACADES)[0], -0.12))); }

  const bodyMesh = mesh(mergeGeometries(bodyGeos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  bodyMesh.castShadow = false; world.add(bodyMesh);
  level.facadeMats = [];
  facadeGeos.forEach((geos, v) => {
    if (!geos.length) return;
    const m = new THREE.MeshStandardMaterial({ map: TEX.facades[v].map, emissiveMap: TEX.facades[v].emis, emissive: new THREE.Color('#ffb060'), emissiveIntensity: theme.windows, roughness: 0.85 });
    level.facadeMats.push(m);
    const fm = mesh(mergeGeometries(geos), m); fm.castShadow = false; world.add(fm);
  });
  // balcones con barandas (instanciados)
  const balGeo = (() => {
    const parts = [placed(new THREE.BoxGeometry(6.2, 0.18, 1.1), 0, 0, 0), placed(new THREE.BoxGeometry(6.2, 0.08, 0.08), 0, 1.0, 0.5)];
    for (let i = 0; i <= 20; i++) parts.push(placed(new THREE.BoxGeometry(0.05, 1.0, 0.05), -3.05 + i * 0.305, 0.5, 0.5));
    parts.push(placed(new THREE.BoxGeometry(0.08, 1.0, 1.1), -3.06, 0.5, 0), placed(new THREE.BoxGeometry(0.08, 1.0, 1.1), 3.06, 0.5, 0));
    return mergeGeometries(parts);
  })();
  const bal = new THREE.InstancedMesh(balGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), balconies.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  balconies.forEach((b, i) => { m4.compose(new THREE.Vector3(...b.p), q.setFromEuler(e.set(0, b.ry, 0)), one); bal.setMatrixAt(i, m4); bal.setColorAt(i, new THREE.Color(b.c)); });
  bal.castShadow = true; bal.receiveShadow = true; world.add(bal);
  const cor = new THREE.InstancedMesh(new THREE.BoxGeometry(8.2, 0.45, 0.6), mat('#fff7ea', { roughness: 0.8 }), cornices.length);
  cornices.forEach((c, i) => { m4.compose(new THREE.Vector3(...c.p), q.setFromEuler(e.set(0, c.ry, 0)), one); cor.setMatrixAt(i, m4); });
  world.add(cor);
  // palmeras
  if (palms.length) {
    const pg = [];
    for (let i = 0; i < 7; i++) pg.push(colorGeo(placed(new THREE.CylinderGeometry(0.22 - i * 0.012, 0.26 - i * 0.012, 1.1, 8), Math.sin(i * 0.35) * 0.35, 0.55 + i * 1.05, 0, 0, 0, Math.sin(i * 0.35) * 0.06), i % 2 ? '#8a6a48' : '#7a5c3d'));
    for (let k = 0; k < 9; k++) {
      const leaf = new THREE.PlaneGeometry(0.9, 3.6, 1, 8); const p = leaf.attributes.position;
      for (let j = 0; j < p.count; j++) { const y = p.getY(j) + 1.8; p.setY(j, y); p.setZ(j, -Math.pow(y / 3.6, 2) * 1.6); p.setX(j, p.getX(j) * Math.sin(Math.PI * clamp(y / 3.6, 0.05, 1))); }
      leaf.rotateX(-Math.PI / 2 + 0.5); leaf.rotateY(k / 9 * TAU); leaf.translate(Math.sin(6 * 0.35) * 0.35, 7.6, 0);
      pg.push(colorGeo(leaf, k % 2 ? '#2f8f3a' : '#3fa548'));
    }
    const palmGeo = mergeGeometries(pg.map((gg) => gg.index ? gg.toNonIndexed() : gg));
    const pm = new THREE.InstancedMesh(palmGeo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }), palms.length);
    palms.forEach(([x, z, h], i) => { m4.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(e.set(0, R() * TAU, 0)), new THREE.Vector3(h / 7.5, h / 7.5, h / 7.5)); pm.setMatrixAt(i, m4); });
    pm.castShadow = true; world.add(pm);
  }
  // calle, andenes y plaza
  const streetTex = texClone(TEX.street, 8, (zStart - plazaZ + 60) / 4);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(32, zStart - plazaZ + 60), new THREE.MeshStandardMaterial({ map: streetTex, roughness: 0.95 }));
  street.rotation.x = -Math.PI / 2; street.position.set(0, 0, (zStart + plazaZ - 60) / 2); street.receiveShadow = true; world.add(street);
  const plazaTex = texClone(TEX.street, 24, 16);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(100, 64), new THREE.MeshStandardMaterial({ map: plazaTex, color: '#e8d6c0', roughness: 0.95 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.01, plazaZ); plaza.receiveShadow = true; world.add(plaza);
  for (const sx of [-1, 1]) { const s = mesh(new THREE.BoxGeometry(2.6, 0.3, zStart - zEnd), mat('#d8cbb8', { roughness: 0.9 })); s.position.set(sx * 11.2, 0.15, (zStart + zEnd) / 2); s.castShadow = false; world.add(s); }

  // banderines y bombillos cruzando la calle
  const flagCount = [], bulbCount = [];
  const strings = [];
  for (let z = zStart - 4; z > zEnd; z -= 9) strings.push({ a: new THREE.Vector3(-12.3, rr(16.8, 18), z + rr(-1.5, 1.5)), b: new THREE.Vector3(12.3, rr(16.8, 18), z + rr(-1.5, 1.5)), sag: rr(1.2, 2), bulbs: strings.length % 2 === 1 });
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; strings.push({ a: new THREE.Vector3(0, 19, plazaZ), b: new THREE.Vector3(Math.cos(a) * 40, 15, plazaZ + Math.sin(a) * 22), sag: 2.5, bulbs: true }); }
  const flagGeo = new THREE.BufferGeometry(); flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.3, 0, 0, 0.3, 0, 0, 0, -0.75, 0], 3)); flagGeo.computeVertexNormals();
  const flagPts = [], bulbPts = [], linePts = [];
  const pt = (s, t) => new THREE.Vector3().lerpVectors(s.a, s.b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * s.sag, 0));
  for (const s of strings) {
    const len = s.a.distanceTo(s.b), n = Math.floor(len / 0.75), dir = new THREE.Vector3().subVectors(s.b, s.a).normalize(), ang = Math.atan2(-dir.z, dir.x);
    for (let i = 0; i <= 40; i++) { if (i) linePts.push(pt(s, (i - 1) / 40), pt(s, i / 40)); }
    for (let i = 1; i < n; i++) { const t = i / n, p = pt(s, t); if (s.bulbs && i % 2 === 0) bulbPts.push(p.clone().add(new THREE.Vector3(0, -0.12, 0))); else flagPts.push([p, ang]); }
  }
  const flags = new THREE.InstancedMesh(flagGeo, makeFlagMaterial(), flagPts.length);
  flagPts.forEach(([p, ang], i) => { m4.compose(p, q.setFromEuler(e.set(0, ang, 0)), one); flags.setMatrixAt(i, m4); flags.setColorAt(i, new THREE.Color(FESTIVE[i % FESTIVE.length])); });
  flags.frustumCulled = false; world.add(flags);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), BULB_MAT, bulbPts.length);
  bulbPts.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m4); });
  world.add(bulbs);
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: 0x2b2230 }));
  world.add(lines);

  // público en la calle y alrededor de la plaza
  const crowdN = IS_TOUCH ? 420 : 700;
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 0.75, 3, 8), makeCrowdMaterial(), crowdN);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), makeCrowdMaterial(), crowdN);
  const hats = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 14), makeCrowdMaterial(), crowdN);
  for (let i = 0; i < crowdN; i++) {
    let x, z;
    if (i < crowdN * 0.62) { x = rr(-10, 10); z = rr(zStart - 4, zEnd); }
    else { const a = R() * TAU, r = rr(0.85, 1.15); x = Math.cos(a) * 20 * r; z = goalZ - 20 + Math.sin(a) * 11 * r; if (z > goalZ - 6) { z = goalZ - 6 - R() * 2; x = Math.sign(x || 1) * rr(6, 20); } }
    const s = rr(0.9, 1.1);
    m4.compose(new THREE.Vector3(x, 0.66 * s, z), q.identity(), new THREE.Vector3(s, s, s)); bodies.setMatrixAt(i, m4); bodies.setColorAt(i, new THREE.Color(pick(FESTIVE)).offsetHSL(0, -0.1, rr(-0.1, 0.05)));
    m4.compose(new THREE.Vector3(x, 1.5 * s, z), q.identity(), new THREE.Vector3(s, s, s)); heads.setMatrixAt(i, m4); heads.setColorAt(i, new THREE.Color(pick(['#8d5a3b', '#c98a5e', '#6b4129', '#e0aa7f', '#a8714d'])));
    m4.compose(new THREE.Vector3(x, R() < 0.4 ? 1.7 * s : -10, z), q.identity(), new THREE.Vector3(s, s, s)); hats.setMatrixAt(i, m4); hats.setColorAt(i, new THREE.Color('#efe0bd'));
  }
  bodies.receiveShadow = heads.receiveShadow = true;
  world.add(bodies, heads, hats);

  // carrozas al fondo, desfilando por la plaza
  level.floats = [];
  ['marimonda', 'torito', 'congo', 'tambores', 'marimonda', 'congo'].forEach((k, i) => {
    const f = makeCarroza(k); const lane = i % 2;
    f.userData = { lane, off: i * 16, speed: lane ? -2.2 : 2.6, z: plazaZ + (lane ? -12 : 0) };
    if (lane) f.rotation.y = Math.PI;
    world.add(f); level.floats.push(f);
  });
}

function makeFlagMaterial() {
  const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.75 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 0.45 + instanceMatrix[3].z * 0.31;
      float sway = sin(uTime * 2.6 + ph) * 0.4 + sin(uTime * 5.3 + ph * 1.7) * 0.12;
      transformed.z += sway * (-position.y);`);
  };
  m.customProgramCacheKey = () => 'flag';
  return m;
}
function makeCrowdMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBeat = BEAT;
    sh.vertexShader = 'uniform float uBeat;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float cph = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
      transformed.y += abs(sin(uBeat * 3.14159 + cph * 0.9)) * 0.28 / max(instanceMatrix[1].y, 0.5);`);
  };
  m.customProgramCacheKey = () => 'crowd';
  return m;
}

// --- plataformas -----------------------------------------------------------
function buildPlatform(p) {
  const o = { ...p, solid: true, bounce: false, depth: 1.2, mesh: new THREE.Group(), dx: 0, dy: 0, dz: 0, bx: p.x, by: p.y, bz: p.z, type: 'box' };
  const g = o.mesh;
  if (p.t === 'tarima' || p.t === 'move' || p.t === 'ledge') {
    const woodTex = texClone(TEX.wood, p.w / 3, p.d / 3);
    const top = mesh(new THREE.BoxGeometry(p.w, 0.4, p.d), [mat('#8a5a32'), mat('#8a5a32'), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.75 }), mat('#5a3a22'), mat('#8a5a32'), mat('#8a5a32')]);
    top.position.y = -0.2; g.add(top);
    const fr = texClone(TEX.fringe, Math.max(1, Math.round(p.w / 2)), 1);
    const fr2 = texClone(TEX.fringe, Math.max(1, Math.round(p.d / 2)), 1);
    const fm = new THREE.MeshStandardMaterial({ map: fr, roughness: 0.8 }), fm2 = new THREE.MeshStandardMaterial({ map: fr2, roughness: 0.8 });
    const skirt = mesh(new THREE.BoxGeometry(p.w - 0.12, 0.8, p.d - 0.12), [fm2, fm2, mat('#5a3a22'), mat('#5a3a22'), fm, fm]); skirt.position.y = -0.8; g.add(skirt);
    o.depth = 1.2;
    if (p.t === 'tarima') {
      const lg = []; const hy = p.y - 1.2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lg.push(placed(new THREE.BoxGeometry(0.28, hy, 0.28), sx * (p.w / 2 - 0.4), -1.2 - hy / 2, sz * (p.d / 2 - 0.4)));
      if (hy > 0.2) { const legs = mesh(mergeGeometries(lg), mat('#5b3a22')); g.add(legs); }
    } else if (p.t === 'ledge') {
      const br = mesh(new THREE.BoxGeometry(0.25, 2.2, p.d * 0.8), mat('#fff7ea')); br.position.set(Math.sign(p.x) * (p.w / 2 - 0.1), -2.2, 0); br.rotation.z = Math.sign(p.x) * 0.5; g.add(br);
    } else {
      o.mv = Object.assign({ ax: 0, ay: 0, az: 0, sp: 1, ph: 0 }, p.mv);
      const ropeMat = mat('#2b2230');
      for (const sx of [-1, 1]) { const balloon = mesh(new THREE.SphereGeometry(0.55, 16, 12), mat(sx < 0 ? COL.fucsia : COL.turq, { roughness: 0.35 })); balloon.position.set(sx * (p.w / 2 - 0.3), 2.6, 0); balloon.scale.y = 1.15; g.add(balloon);
        const rope = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.1, 4), ropeMat, false); rope.position.set(sx * (p.w / 2 - 0.3), 1.05, 0); g.add(rope); }
    }
  } else if (p.t === 'beat') {
    const c = p.g ? COL.turq : COL.fucsia;
    o.matA = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.35, transparent: true });
    const tile = mesh(new THREE.BoxGeometry(p.w, 0.45, p.d), o.matA); tile.position.y = -0.225; g.add(tile);
    o.ring = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.25, 0.08, p.d + 0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2), transparent: true, opacity: 0.8 }));
    o.ring.position.y = -0.46; g.add(o.ring); o.tile = tile; o.depth = 0.45;
  } else if (p.t === 'drum') {
    o.type = 'cyl'; o.bounce = true; o.depth = 1.6;
    const d = makeTambor(p.r / 0.62); d.scale.y = 1.6 / 1.3; d.position.y = -1.6; g.add(d); o.drum = d; o.drumSY = d.scale.y;
    const pole = mesh(new THREE.CylinderGeometry(0.18, 0.25, p.y - 1.6, 10), mat('#3b2a20')); pole.position.y = -1.6 - (p.y - 1.6) / 2; g.add(pole);
  } else if (p.t === 'pico') {
    o.bounce = true; o.depth = p.y;
    const front = new THREE.MeshStandardMaterial({ map: TEX.pico, roughness: 0.6 });
    const box = mesh(new THREE.BoxGeometry(p.w, p.y, p.d), [mat('#141414'), mat('#141414'), mat('#222'), mat('#141414'), front, mat('#141414')]); box.position.y = -p.y / 2; g.add(box);
    o.cone = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 28), mat('#2a2a2a', { roughness: 0.4 })); o.cone.position.y = 0.04; g.add(o.cone);
    const trim = mesh(new THREE.TorusGeometry(0.95, 0.08, 8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.oro).multiplyScalar(2) })); trim.rotation.x = Math.PI / 2; trim.position.y = 0.06; g.add(trim);
  }
  g.position.set(p.x, p.y, p.z);
  world.add(g);
  return o;
}

function makePickupMesh(kind, i) {
  const g = new THREE.Group();
  if (kind === 'nota') {
    const m = new THREE.MeshStandardMaterial({ color: COL.oro, emissive: COL.oro, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.25 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), m); head.scale.set(1.25, 0.9, 0.8); head.rotation.z = 0.4; head.position.set(-0.12, -0.35, 0); g.add(head);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), m); stem.position.set(0.16, 0.08, 0); g.add(stem);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.06), m); flag.position.set(0.32, 0.45, 0); flag.rotation.z = -0.5; g.add(flag);
  } else if (kind === 'gota') {
    const c = FESTIVE[i % FESTIVE.length];
    const pts = []; for (let k = 0; k <= 20; k++) { const t = k / 20, a = t * Math.PI; pts.push(new THREE.Vector2(Math.sin(a) * 0.36 * Math.pow(1 - t * 0.02, 1) * (t < 0.5 ? 1 : Math.pow(Math.sin(a), 0.4)), -Math.cos(a) * 0.36 + (t > 0.5 ? (t - 0.5) * 0.7 : 0))); }
    pts.push(new THREE.Vector2(0, 0.62));
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.75, roughness: 0.15, metalness: 0.1 }); m.userData.noSat = true;
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 24), m)); g.userData.color = c;
  } else {
    const paper = new THREE.MeshStandardMaterial({ color: '#ff5a3a', emissive: '#ff8a3a', emissiveIntensity: 1.3, roughness: 0.7 });
    const lan = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), paper); lan.scale.y = 1.25; g.add(lan);
    for (const y of [-0.42, 0.42]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12), mat('#2b1a12')); cap.position.y = y; g.add(cap); }
    for (let k = 0; k < 6; k++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 4, 24, Math.PI), mat('#8a2a1a')); rib.rotation.y = k / 6 * Math.PI; rib.scale.y = 1.25; g.add(rib); }
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(g.userData.color || COL.oro).multiplyScalar(1.8), transparent: true, opacity: 0.7 }));
  halo.material.userData.noSat = true; g.add(halo); g.userData.halo = halo;
  return g;
}

function makeStation(pos) {
  const g = new THREE.Group();
  const poleM = mat('#fff7ea');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const pl = mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), poleM); pl.position.set(sx * 1.1, 1.2, sz * 0.9); g.add(pl); }
  const roof = mesh(new THREE.ConeGeometry(1.75, 1.1, 4, 1, true), new THREE.MeshStandardMaterial({ map: TEX.tent, side: THREE.DoubleSide, roughness: 0.8 })); roof.position.y = 2.95; roof.rotation.y = Math.PI / 4; g.add(roof);
  const counter = mesh(new THREE.BoxGeometry(2.3, 1.0, 0.5), mat(COL.cobalto)); counter.position.set(0, 0.5, 0.85); g.add(counter);
  const sign = mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: TEX.sign, emissive: '#ffffff', emissiveMap: TEX.sign, emissiveIntensity: 0.18, roughness: 0.6, side: THREE.DoubleSide })); sign.position.set(0, 3.95, 0.2); g.add(sign);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.oro).multiplyScalar(1.6), transparent: true, opacity: 0.5 })); glow.position.y = 0.04; g.add(glow);
  g.position.set(pos[0] + 1.6, pos[1], pos[2] - 1.2);
  return { g, glow, pos: new THREE.Vector3(pos[0], pos[1], pos[2]), used: false };
}

function makeGoal(pos, kind) {
  const g = new THREE.Group();
  const ped = mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.9, 32), mat('#fff7ea', { roughness: 0.5 })); ped.position.y = 0.45; g.add(ped);
  const ped2 = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.14, 32), mat(COL.oro, { metalness: 0.6, roughness: 0.3 })); ped2.position.y = 0.95; g.add(ped2);
  const treasure = kind === 'tambor' ? makeTambor(0.95) : kind === 'marimonda' ? makeMarimonda(0.9) : makePollera(0.62);
  treasure.position.y = kind === 'marimonda' ? 1.55 : 1.05; g.add(treasure);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(0.3, 0.36, 0.85) }, uTime: TIME },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 uCol; uniform float uTime; varying vec2 vUv; void main(){ float a = pow(1.-vUv.y, 1.8) * smoothstep(0., .04, vUv.y) * (0.45 + 0.2*sin(vUv.y*30. - uTime*4.)); gl_FragColor = vec4(uCol*a, a); }',
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, 24, 32, 1, true), beamMat); beam.position.y = 3.7 + 12; g.add(beam);
  const cage = new THREE.Group();
  const bar = new THREE.MeshStandardMaterial({ color: '#a9b4ff', emissive: '#6f7dff', emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.3 });
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), bar); b.position.set(Math.cos(a) * 1.15, 2.3, Math.sin(a) * 1.15); cage.add(b); }
  const ringTop = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 8, 40), bar); ringTop.rotation.x = Math.PI / 2; ringTop.position.y = 3.6; cage.add(ringTop);
  g.add(cage);
  g.position.set(...pos);
  return { g, treasure, beam, cage, pos: new THREE.Vector3(...pos), baseY: treasure.position.y };
}

function buildLevel(i) {
  if (world) { world.remove(player.root, player.blob, confetti.points, sparks.mesh, fireworks.points); scene.remove(world); disposeTree(world); }
  TEX_CLONES.forEach((t) => t.dispose()); TEX_CLONES.length = 0;
  world = new THREE.Group(); scene.add(world);
  const L = LEVELS[i];
  level.i = i; level.data = L; level.collected = 0; level.time = L.time; level.unlocked = false;
  applyTheme(THEMES[L.theme]);
  buildStreet(L, L.goal[2]);
  R = mulberry32(99 + i);
  level.platforms = L.platforms.map(buildPlatform);
  level.pickups = L.pickups.map((p, k) => { const m = makePickupMesh(L.pickup, k); m.position.set(...p); world.add(m); return { m, base: new THREE.Vector3(...p), taken: false, k }; });
  level.station = makeStation(L.station); world.add(level.station.g);
  level.goal = makeGoal(L.goal, L.treasure); world.add(level.goal.g);
  level.platforms.push({ t: 'pedestal', type: 'cyl', x: L.goal[0], y: L.goal[1] + 0.95, z: L.goal[2], r: 1.3, depth: 0.95, solid: true, bounce: false, dx: 0, dy: 0, dz: 0 });
  level.checkpoint.set(...L.start);
  player.root.position.set(...L.start); player.vel.set(0, 0, 0); player.face.rotation.y = Math.PI;
  world.add(player.root, player.blob);
  world.add(confetti.points, sparks.mesh, fireworks.points);
  satifyTree(world);
  updateLevelMood(true);
}

// Estado visual de cada nivel según las piezas reunidas
function updateLevelMood(instant = false) {
  const L = level.data, n = level.collected, f = n / 6;
  if (L.id === 'ritmo') {
    const order = ['guacharaca', 'maracas', 'bass', 'alegre', 'chords', 'gaita'];
    const lay = { tambora: 1, llamador: 1, crowd: 0.3 }; order.forEach((k, idx) => { if (n > idx) lay[k] = 1; });
    sound.setLayers(lay, instant ? 0.1 : 1.2); sound.setFilter(18000); SAT.value = 1; setBulbs(theme.bulbs);
  } else if (L.id === 'colores') {
    sound.setLayers({ tambora: 1, llamador: 1, alegre: 1, guacharaca: 1, maracas: 1, bass: 1, chords: 1, gaita: 1, crowd: 0.2 + f * 0.6 }, 0.5);
    sound.setFilter(lerp(650, 18000, Math.pow(f, 1.6)), 1.2);
    level.satTarget = lerp(0.04, 1, f); if (instant) SAT.value = level.satTarget; setBulbs(theme.bulbs);
  } else {
    sound.setLayers({ tambora: 1, llamador: 1, alegre: 1, guacharaca: 1, maracas: 1, bass: 1, chords: n > 1 ? 1 : 0, gaita: n > 3 ? 1 : 0.4, brass: n > 2 ? 1 : 0, crowd: 0.3 + f * 0.7 }, 1);
    sound.setFilter(lerp(5000, 18000, f)); SAT.value = 1;
    level.lightTarget = f;
    if (instant) { setBulbs(lerp(0.15, 3.2, f)); level.facadeMats?.forEach((m) => (m.emissiveIntensity = lerp(0.2, 1.4, f))); }
  }
}

// ---------------------------------------------------------------------------
// Partículas: confeti, chispas y fuegos artificiales
// ---------------------------------------------------------------------------
const confetti = (() => {
  const n = IS_TOUCH ? 500 : 900, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 44; pos[i * 3 + 1] = Math.random() * 26; pos[i * 3 + 2] = (Math.random() - 0.5) * 50; const c = new THREE.Color(FESTIVE[i % FESTIVE.length]); col.set([c.r, c.g, c.b], i * 3); ph[i] = Math.random(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: TIME, uCenter: { value: new THREE.Vector3() }, uPixel: { value: 1 }, uAmount: { value: 1 }, uGlobalSat: SAT },
    vertexShader: `uniform float uTime; uniform vec3 uCenter; uniform float uPixel; uniform float uAmount; attribute vec3 aColor; attribute float aPhase; varying vec3 vColor; varying float vSpin; varying float vRot;
      void main(){ vec3 box = vec3(44., 26., 50.); vec3 p = position; p.y -= uTime * (1.1 + aPhase * 0.9); p.x += sin(uTime * 1.3 + aPhase * 6.28) * 0.9; p.z += cos(uTime * 0.9 + aPhase * 4.) * 0.6;
        p = mod(p - uCenter + box * 0.5, box) - box * 0.5 + uCenter;
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; vSpin = abs(sin(uTime * 3.5 + aPhase * 20.)); vRot = aPhase * 6.28 + uTime * 2.;
        gl_PointSize = step(aPhase, uAmount) * 0.16 * uPixel * 900. / -mv.z; vColor = aColor; }`,
    fragmentShader: `uniform float uGlobalSat; varying vec3 vColor; varying float vSpin; varying float vRot;
      void main(){ vec2 c = gl_PointCoord - .5; float s = sin(vRot), k = cos(vRot); c = vec2(c.x*k - c.y*s, c.x*s + c.y*k); if (abs(c.x) > .5*max(vSpin,.15) || abs(c.y) > .28) discard;
        vec3 col = vColor * (0.65 + 0.6 * vSpin); float l = dot(col, vec3(.2126,.7152,.0722)); gl_FragColor = vec4(mix(vec3(l), col, uGlobalSat), 1.); }`,
  });
  const points = new THREE.Points(geo, m); points.frustumCulled = false;
  return { points, m };
})();

const sparks = (() => {
  const n = 220, geo = new THREE.OctahedronGeometry(0.09, 0);
  const meshI = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), n); meshI.frustumCulled = false;
  meshI.material.userData.noSat = true;
  const p = Array.from({ length: n }, () => ({ life: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), col: new THREE.Color() }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let idx = 0;
  function burst(at, color, count = 36, speed = 6) {
    for (let i = 0; i < count; i++) { const o = p[idx]; idx = (idx + 1) % n; o.life = 1; o.pos.copy(at); o.vel.set(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8)); o.col.set(color || pick(FESTIVE)).multiplyScalar(2.5); }
  }
  function update(dt) {
    for (let i = 0; i < n; i++) { const o = p[i]; if (o.life > 0) { o.life -= dt * 1.4; o.vel.y -= 12 * dt; o.pos.addScaledVector(o.vel, dt); } const k = Math.max(o.life, 0); s.setScalar(k); m4.compose(o.pos, q, s); meshI.setMatrixAt(i, m4); meshI.setColorAt(i, o.col); }
    meshI.instanceMatrix.needsUpdate = true; if (meshI.instanceColor) meshI.instanceColor.needsUpdate = true;
  }
  burst(new THREE.Vector3(0, -50, 0), '#ffffff', 1, 0);
  return { mesh: meshI, burst, update };
})();

const fireworks = (() => {
  const n = 2400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geo, m); points.frustumCulled = false;
  let idx = 0;
  function launch(center) {
    const c = new THREE.Color(pick(FESTIVE)), c2 = new THREE.Color(pick([COL.oro, '#ffffff', COL.fucsia]));
    for (let i = 0; i < 220; i++) { const k = idx; idx = (idx + 1) % n; const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(9 + Math.random() * 3); pos.set([center.x, center.y, center.z], k * 3); vel.set([v.x, v.y, v.z], k * 3); life[k] = 1 + Math.random() * 0.3; const cc = i % 3 ? c : c2; col.set([cc.r * 3, cc.g * 3, cc.b * 3], k * 3); }
  }
  function update(dt) {
    for (let i = 0; i < n; i++) {
      if (life[i] <= 0) { pos[i * 3 + 1] = -999; continue; }
      life[i] -= dt * 0.55; vel[i * 3 + 1] -= 4 * dt; const dr = Math.exp(-dt * 1.5);
      vel[i * 3] *= dr; vel[i * 3 + 1] *= dr; vel[i * 3 + 2] *= dr;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const f = Math.max(life[i], 0) * 0.98; col[i * 3] *= f > 0.05 ? 0.995 : 0; col[i * 3 + 1] *= f > 0.05 ? 0.99 : 0; col[i * 3 + 2] *= f > 0.05 ? 0.99 : 0;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
  return { points, launch, update };
})();

// ---------------------------------------------------------------------------
// Jugador, física y entrada
// ---------------------------------------------------------------------------
let player = { jumpBuf: -1 };
function createPlayer() { player = Object.assign(makePlayer(), { vel: new THREE.Vector3(), ground: null, lastGround: -1, jumpBuf: -1, runPhase: 0, squash: 0, wasAir: false, facing: Math.PI }); }
const PHY = { speed: 7.4, accel: 40, airAccel: 22, grav: 28, jump: 11, bounce: 16.7, coyote: 0.11, buffer: 0.13, radius: 0.36, height: 1.75 };
const input = { x: 0, y: 0, jumpHeld: false, stickX: 0, stickY: 0 };
const keys = new Set();

addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (['Space', 'KeyK', 'KeyJ'].includes(e.code)) { input.jumpHeld = true; player.jumpBuf = clock; }
  if (['Escape', 'KeyP'].includes(e.code)) { if (state === 'play') pauseGame(); else if (state === 'paused') resumeGame(); }
  if (e.code === 'Enter' && state === 'title') $('#playBtn').click();
});
addEventListener('keyup', (e) => { keys.delete(e.code); if (['Space', 'KeyK', 'KeyJ'].includes(e.code)) input.jumpHeld = false; });
addEventListener('blur', () => { keys.clear(); input.jumpHeld = false; input.stickX = input.stickY = 0; if (state === 'play') pauseGame(); });

// controles táctiles: joystick dinámico a la izquierda, salto en toda la mitad derecha
const touchLayer = $('#touch'), stick = $('#stick'), knob = $('#knob'), jumpBtn = $('#jumpBtn');
const touch = { stickId: null, cx: 0, cy: 0, jumpIds: new Set() };
function stickHome() { stick.style.left = `max(96px, calc(env(safe-area-inset-left) + 86px))`; stick.style.top = `calc(100% - max(96px, calc(env(safe-area-inset-bottom) + 86px)))`; stick.classList.add('idle'); knob.style.transform = ''; }
stickHome();
touchLayer.addEventListener('pointerdown', (e) => {
  e.preventDefault(); sound.resume();
  if (e.clientX < innerWidth * 0.5 && touch.stickId === null) {
    touch.stickId = e.pointerId; touch.cx = e.clientX; touch.cy = e.clientY;
    stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; stick.classList.remove('idle');
  } else { touch.jumpIds.add(e.pointerId); input.jumpHeld = true; player.jumpBuf = clock; jumpBtn.classList.add('on'); }
  try { touchLayer.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
});
touchLayer.addEventListener('pointermove', (e) => {
  if (e.pointerId !== touch.stickId) return;
  const max = 52; let dx = e.clientX - touch.cx, dy = e.clientY - touch.cy; const l = Math.hypot(dx, dy);
  if (l > max) { dx *= max / l; dy *= max / l; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  const nx = dx / max, ny = dy / max, m = Math.hypot(nx, ny);
  if (m < 0.14) { input.stickX = input.stickY = 0; } else { const k = Math.min(1, (m - 0.14) / 0.76) / m; input.stickX = nx * k; input.stickY = ny * k; }
});
const endPointer = (e) => {
  if (e.pointerId === touch.stickId) { touch.stickId = null; input.stickX = input.stickY = 0; stickHome(); }
  if (touch.jumpIds.delete(e.pointerId) && touch.jumpIds.size === 0) { input.jumpHeld = false; jumpBtn.classList.remove('on'); }
};
touchLayer.addEventListener('pointerup', endPointer); touchLayer.addEventListener('pointercancel', endPointer);

function readInput() {
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
  x += input.stickX; y += input.stickY;
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  input.x = x; input.y = y;
}

function inFoot(p, px, pz, slack) {
  if (p.type === 'cyl') return Math.hypot(px - p.x, pz - p.z) <= p.r + slack;
  return Math.abs(px - p.x) <= p.w / 2 + slack && Math.abs(pz - p.z) <= p.d / 2 + slack;
}

function updatePlatforms(dt, beats) {
  const phase = ((beats % 4) + 4) % 4;
  for (const p of level.platforms) {
    if (p.mv) {
      const s = Math.sin(clock * p.mv.sp + p.mv.ph);
      const nx = p.bx + p.mv.ax * s, ny = p.by + p.mv.ay * s, nz = p.bz + p.mv.az * s;
      p.dx = nx - p.x; p.dy = ny - p.y; p.dz = nz - p.z; p.x = nx; p.y = ny; p.z = nz; p.mesh.position.set(nx, ny, nz);
    }
    if (p.t === 'beat') {
      const solid = p.g === 0 ? phase < 2.25 : (phase >= 2 || phase < 0.25);
      const warn = p.g === 0 ? (phase >= 1.5 && phase < 2.25) : (phase >= 3.5 || phase < 0.25);
      p.solid = solid;
      const pulse = 1 - (beats % 1);
      if (solid) {
        const blink = warn ? (Math.sin(clock * 40) > 0 ? 1 : 0.35) : 1;
        p.matA.opacity = blink; p.matA.emissiveIntensity = 0.4 + pulse * 1.4; p.tile.scale.set(1, 1, 1); p.matA.depthWrite = true; p.tile.castShadow = true;
        p.ring.material.opacity = 0.9;
      } else {
        p.matA.opacity = 0.13; p.matA.emissiveIntensity = 0.3; p.tile.scale.set(0.92, 0.5, 0.92); p.matA.depthWrite = false; p.tile.castShadow = false;
        p.ring.material.opacity = 0.35 + pulse * 0.2;
      }
    }
    if (p.drum) p.drum.scale.y = damp(p.drum.scale.y, p.drumSY, 9, dt);
    if (p.t === 'pico') { const k = 1 + Math.pow(1 - (beats % 1), 3) * 0.12; p.cone.scale.set(k, 1, k); }
  }
}

function stepPlayer(dt) {
  const pos = player.root.position, vel = player.vel;
  // arrastre de plataformas móviles
  if (player.ground && player.ground.mv) { pos.x += player.ground.dx; pos.y += player.ground.dy; pos.z += player.ground.dz; }
  // movimiento horizontal relativo a la cámara (adelante = -z)
  const tx = input.x * PHY.speed, tz = input.y * PHY.speed;
  const acc = player.ground ? PHY.accel : PHY.airAccel;
  vel.x = moveToward(vel.x, tx, acc * dt); vel.z = moveToward(vel.z, tz, acc * dt);
  pos.x += vel.x * dt; pos.z += vel.z * dt;
  // colisiones laterales
  for (const p of level.platforms) {
    if (!p.solid) continue;
    const top = p.y, bottom = p.y - p.depth;
    if (pos.y >= top - 0.12 || pos.y + PHY.height <= bottom) continue;
    if (p.type === 'cyl') {
      const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz), min = p.r + PHY.radius;
      if (d < min && d > 1e-4) { pos.x = p.x + dx / d * min; pos.z = p.z + dz / d * min; }
    } else {
      const ox = p.w / 2 + PHY.radius - Math.abs(pos.x - p.x), oz = p.d / 2 + PHY.radius - Math.abs(pos.z - p.z);
      if (ox > 0 && oz > 0) { if (ox < oz) { pos.x += Math.sign(pos.x - p.x) * ox; vel.x = 0; } else { pos.z += Math.sign(pos.z - p.z) * oz; vel.z = 0; } }
    }
  }
  // salto
  const canJump = player.ground || clock - player.lastGround < PHY.coyote;
  if (clock - player.jumpBuf < PHY.buffer && canJump && vel.y <= 0.1) {
    vel.y = PHY.jump; player.ground = null; player.lastGround = -1; player.jumpBuf = -1; player.squash = -0.25; sound.sfxJump();
  }
  if (!input.jumpHeld && vel.y > 4 && !player.bouncing) vel.y = Math.max(4, vel.y - 60 * dt);
  // gravedad y aterrizaje
  const prevY = pos.y;
  vel.y -= PHY.grav * dt; vel.y = Math.max(vel.y, -30);
  pos.y += vel.y * dt;
  let landed = null;
  if (vel.y <= 0) {
    for (const p of level.platforms) {
      if (!p.solid) continue;
      const tol = p.mv ? 0.35 + Math.abs(p.dy) : 0.3;
      if (prevY >= p.y - tol && pos.y <= p.y && inFoot(p, pos.x, pos.z, 0.22)) { if (!landed || p.y > landed.y) landed = p; }
    }
  } else {
    for (const p of level.platforms) {
      if (!p.solid) continue; const bottom = p.y - p.depth;
      if (prevY + PHY.height <= bottom + 0.01 && pos.y + PHY.height > bottom && inFoot(p, pos.x, pos.z, 0.05)) { pos.y = bottom - PHY.height; vel.y = 0; }
    }
  }
  if (landed) {
    pos.y = landed.y;
    if (landed.bounce) {
      vel.y = PHY.bounce; player.ground = null; player.bouncing = true; player.squash = 0.45; sound.sfxBounce();
      if (landed.drum) landed.drum.scale.y *= 0.82;
      sparks.burst(new THREE.Vector3(pos.x, pos.y + 0.2, pos.z), COL.oro, 14, 4);
    } else {
      if (player.wasAir && prevY - pos.y > 0.01) { player.squash = clamp(-vel.y / 30, 0.1, 0.4); sound.sfxLand(); }
      vel.y = 0; player.ground = landed; player.lastGround = clock; player.bouncing = false;
    }
  } else { if (player.ground) player.lastGround = clock; player.ground = null; }
  if (vel.y < 0) player.bouncing = false;
  player.wasAir = !player.ground;
}
function moveToward(v, t, d) { return Math.abs(t - v) <= d ? t : v + Math.sign(t - v) * d; }

function animatePlayer(dt, beats) {
  const v = player.vel, hs = Math.hypot(v.x, v.z), b = player.body, L = player.limbs;
  if (hs > 0.4) player.facing = Math.atan2(v.x, v.z);
  let df = player.facing - player.face.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
  player.face.rotation.y += df * (1 - Math.exp(-14 * dt));
  if (player.ground) {
    player.runPhase += dt * hs * 1.55;
    const sw = Math.sin(player.runPhase) * Math.min(1, hs / 5);
    L.legL.rotation.x = sw * 0.95; L.legR.rotation.x = -sw * 0.95; L.armL.rotation.x = -sw * 0.8; L.armR.rotation.x = sw * 0.8;
    L.armL.rotation.z = 0.08; L.armR.rotation.z = -0.08;
    b.position.y = Math.abs(Math.cos(player.runPhase)) * 0.08 * Math.min(1, hs / 4);
    b.rotation.x = Math.min(1, hs / 7) * 0.18;
    if (hs < 0.4) { // baila al ritmo cuando está quieto
      const bt = beats * Math.PI; b.position.y = Math.abs(Math.sin(bt)) * 0.06; b.rotation.z = Math.sin(bt) * 0.06;
      L.armL.rotation.x = Math.sin(bt) * 0.25; L.armR.rotation.x = -Math.sin(bt) * 0.25; L.legL.rotation.x = L.legR.rotation.x = 0;
    } else b.rotation.z = 0;
  } else {
    L.legL.rotation.x = damp(L.legL.rotation.x, 0.7, 10, dt); L.legR.rotation.x = damp(L.legR.rotation.x, -0.35, 10, dt);
    L.armL.rotation.x = damp(L.armL.rotation.x, -2.4, 10, dt); L.armR.rotation.x = damp(L.armR.rotation.x, -2.1, 10, dt);
    L.armL.rotation.z = damp(L.armL.rotation.z, 0.5, 8, dt); L.armR.rotation.z = damp(L.armR.rotation.z, -0.5, 8, dt);
    b.rotation.x = damp(b.rotation.x, v.y > 0 ? -0.08 : 0.12, 6, dt); b.position.y = 0; b.rotation.z = 0;
  }
  player.squash = damp(player.squash, 0, 12, dt);
  const s = player.squash; player.body.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
  // sombra circular sobre la superficie más alta debajo
  const pos = player.root.position; let gy = 0;
  for (const p of level.platforms) if (p.solid && p.y <= pos.y + 0.05 && p.y > gy && inFoot(p, pos.x, pos.z, 0)) gy = p.y;
  player.blob.position.set(pos.x, gy + 0.03, pos.z);
  const h = pos.y - gy; player.blob.material.opacity = clamp(0.42 - h * 0.035, 0.1, 0.42); player.blob.scale.setScalar(clamp(1 - h * 0.03, 0.55, 1));
}

// ---------------------------------------------------------------------------
// Cámara
// ---------------------------------------------------------------------------
const camState = { pos: new THREE.Vector3(0, 9, 14), look: new THREE.Vector3(0, 4, -4), mode: 'follow', t: 0 };
function portrait() { return innerHeight > innerWidth; }
function followCamera(dt, k = 5) {
  const p = player.root.position, por = portrait();
  const dist = por ? 12.5 : 9.4, hgt = por ? 6.8 : 5.2;
  const want = new THREE.Vector3(p.x * 0.55, p.y + hgt, p.z + dist);
  const look = new THREE.Vector3(p.x * 0.8, p.y + 1.1, p.z - (por ? 6 : 5));
  camState.pos.x = damp(camState.pos.x, want.x, k, dt); camState.pos.z = damp(camState.pos.z, want.z, k * 1.2, dt); camState.pos.y = damp(camState.pos.y, want.y, k * 0.6, dt);
  camState.look.x = damp(camState.look.x, look.x, k, dt); camState.look.z = damp(camState.look.z, look.z, k * 1.2, dt); camState.look.y = damp(camState.look.y, look.y, k * 0.6, dt);
  camera.position.copy(camState.pos); camera.lookAt(camState.look);
}

// ---------------------------------------------------------------------------
// Interfaz
// ---------------------------------------------------------------------------
const ui = {
  title: $('#title'), cardScreen: $('#cardScreen'), card: $('#card'), end: $('#end'), endPanel: $('#endPanel'), hud: $('#hud'), touch: $('#touch'),
  timer: $('#timer'), timerTxt: $('#timerTxt'), slots: $('#slots'), lvlName: $('#lvlName'), lvlSub: $('#lvlSub'), toast: $('#toast'), keysHint: $('#keysHint'), flash: $('#flash'),
};
const session = { start: 0, plays: 0, completed: 0, pieces: 0, falls: 0 };
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
let toastTimer = 0;
function toast(html, ms = 2200) { ui.toast.innerHTML = html; ui.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms); }
function flash(color = '#ffffff', amount = 0.35) { grade.uniforms.uFlashColor.value.set(color); grade.uniforms.uFlash.value = amount; }

const CO = [[-71.67, 12.46], [-71.15, 12.1], [-71.35, 11.8], [-71.95, 11.55], [-72.25, 11.15], [-72.5, 10.6], [-72.95, 9.9], [-73.2, 9.2], [-72.75, 8.6], [-72.45, 7.9], [-72.45, 7.4], [-71.8, 7.05], [-70.9, 7.05], [-70.1, 6.95], [-69.4, 6.1], [-68.6, 6.15], [-67.5, 6.2], [-67.85, 5.4], [-67.8, 4.6], [-67.3, 3.6], [-67.85, 2.8], [-67.3, 2.2], [-66.9, 1.25], [-67.6, 1.95], [-68.2, 1.75], [-69.3, 1.95], [-69.85, 1.7], [-69.5, 0.95], [-70.05, 0.6], [-70.0, -0.2], [-69.6, -0.6], [-69.4, -1.4], [-69.95, -4.2], [-70.7, -3.8], [-70.4, -3.1], [-71.4, -2.3], [-72.3, -2.45], [-73.1, -1.8], [-73.6, -1.25], [-74.4, -0.6], [-75.25, -0.1], [-75.8, 0.1], [-77.0, 0.35], [-77.7, 0.82], [-78.85, 1.4], [-78.6, 2.3], [-77.9, 2.7], [-77.3, 3.6], [-77.4, 4.5], [-77.35, 5.6], [-77.5, 6.6], [-77.9, 7.2], [-77.35, 7.9], [-77.4, 8.65], [-76.85, 8.6], [-76.75, 8.0], [-76.3, 8.4], [-76.2, 9.3], [-75.65, 9.5], [-75.55, 10.4], [-75.2, 10.85], [-74.85, 11.1], [-74.2, 11.25], [-73.3, 11.3], [-72.75, 11.7], [-72.2, 11.95]];
const DEST = [
  { name: 'Barranquilla', sub: 'Carnaval', ll: [-74.8, 10.96], anchor: 'end', dx: -4 },
  { name: 'Valledupar', sub: 'Festival Vallenato', ll: [-73.25, 10.46], anchor: 'start', dx: 4 },
  { name: 'Medellín', sub: 'Feria de las Flores', ll: [-75.57, 6.25], anchor: 'start', dx: 4 },
  { name: 'Cali', sub: 'Feria de Cali', ll: [-76.53, 3.45], anchor: 'start', dx: 4 },
  { name: 'Pasto', sub: 'Negros y Blancos', ll: [-77.28, 1.21], anchor: 'start', dx: 4 },
];
const proj = ([lon, lat]) => [(lon + 79.6) * 10, (12.9 - lat) * 10];
function mapSVG(done) {
  const d = 'M' + CO.map((p) => proj(p).map((v) => v.toFixed(1)).join(' ')).join('L') + 'Z';
  const pts = DEST.map((c) => proj(c.ll));
  let route = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], mx = (x1 + x2) / 2 + (y2 - y1) * 0.25, my = (y1 + y2) / 2 - (x2 - x1) * 0.25;
    const cls = i === 0 && done ? 'route' : (i === 0 ? 'route' : 'route locked');
    route += `<path class="${cls}" d="M${x1} ${y1}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2} ${y2}"/>`;
  }
  const cities = DEST.map((c, i) => {
    const [x, y] = pts[i]; const locked = i > 0;
    const state = i === 0 ? (done ? 'done' : '') : (i === 1 && done ? 'next' : '');
    const lock = locked ? `<g transform="translate(${x - 2.4} ${y - 2.6}) scale(.2)" fill="#aab2e6">${ICON.lock.replace(/<\/?svg[^>]*>/g, '')}</g>` : '';
    const pin = locked && !(i === 1 && done) ? `<circle class="pin" cx="${x}" cy="${y}" r="3.2"/>${lock}` : `<circle class="pulse" cx="${x}" cy="${y}" r="3.4"/><circle class="pin ${state}" cx="${x}" cy="${y}" r="2.6"/>`;
    return `<g class="city ${locked && !(i === 1 && done) ? 'locked' : ''}">${pin}<text x="${x + c.dx}" y="${y - 0.4}" text-anchor="${c.anchor}">${c.name}</text><text class="sub" x="${x + c.dx}" y="${y + 3.6}" text-anchor="${c.anchor}">${c.sub}${i === 1 && done ? ' · próximo' : ''}</text></g>`;
  }).join('');
  return `<svg class="rmap" viewBox="-6 -6 146 186" role="img" aria-label="Mapa de Colombia con la ruta de destinos"><path class="land" d="${d}"/><text class="sea" x="22" y="4">MAR CARIBE</text><text class="sea" x="-4" y="70" transform="rotate(-70 -4 70)">OCÉANO PACÍFICO</text>${route}${cities}</svg>`;
}

function renderSlots() {
  const L = level.data; ui.slots.innerHTML = '';
  for (let i = 0; i < 6; i++) { const s = document.createElement('div'); s.className = 'slot' + (i < level.collected ? ' on' : ''); s.innerHTML = ICON[L.pickup]; ui.slots.appendChild(s); }
}
function passportHTML(count, fresh = -1) {
  const t = ['tambor', 'marimonda', 'pollera'];
  return `<div class="passport">${t.map((k, i) => `<div class="stamp ${i < count ? 'on' : ''} ${i === fresh ? 'new' : ''}" title="${['Tambor alegre', 'Máscara de marimonda', 'Vestuario de cumbia'][i]}">${ICON[k]}</div>`).join('')}
    <div class="passport-label">Pasaporte de viaje<br>presentado por <span class="brandbox" style="height:26px;min-width:76px">Tu marca</span></div></div>`;
}
const controlsHTML = () => IS_TOUCH
  ? '<div class="controls"><span>Arrastra a la <b>izquierda</b> para moverte</span><span>Toca a la <b>derecha</b> para saltar</span></div>'
  : '<div class="controls"><span><kbd>WASD</kbd> o <kbd>flechas</kbd> moverse</span><span><kbd>Espacio</kbd> saltar (mantén para más altura)</span><span><kbd>P</kbd> pausa</span></div>';

function showCard(html, onShow) {
  ui.card.innerHTML = html; ui.cardScreen.hidden = false; ui.card.style.animation = 'none'; void ui.card.offsetWidth; ui.card.style.animation = '';
  onShow?.(); const b = ui.card.querySelector('button'); if (b && !IS_TOUCH) b.focus({ preventScroll: true });
}
function hideCard() { ui.cardScreen.hidden = true; }

// ---------------------------------------------------------------------------
// Estados del juego
// ---------------------------------------------------------------------------
let state = 'loading', clock = 0, stateT = 0, completedLevels = 0, lastTick = 0;
function setState(s) { state = s; stateT = 0; }

function showTitle() {
  const prev = state; setState('title');
  ui.title.hidden = false; ui.hud.hidden = true; ui.touch.hidden = true; ui.end.hidden = true; ui.keysHint.hidden = true; hideCard();
  $('#titleMap').innerHTML = mapSVG(false);
  if (prev !== 'loading' || !world) buildLevel(0);
  sound.setLayers({ tambora: 1, llamador: 1, alegre: 0.6, guacharaca: 1, maracas: 1, bass: 1, gaita: 0.8, crowd: 0.4 }, 1);
  sound.setFilter(18000); SAT.value = 1;
}

function introLevel(i) {
  completedLevels = Math.min(completedLevels, i);
  buildLevel(i);
  setState('intro');
  ui.title.hidden = true; ui.end.hidden = true; ui.hud.hidden = true; ui.touch.hidden = true; ui.keysHint.hidden = true;
  const L = LEVELS[i];
  camState.pos.set(L.start[0] + 6, L.start[1] + 9, L.start[2] + 14); camState.look.set(0, L.start[1] + 1, L.start[2] - 8);
  showCard(`
    <h2>${L.name}</h2>
    <p>${L.intro}</p>
    <div class="facts">
      <div class="fact">${ICON[L.pickup]}<div><b>6 ${L.pickupName}</b><small>reúnelas para abrir el tesoro</small></div></div>
      <div class="fact">${ICON.clock}<div><b>${fmt(L.time)} minutos</b><small>la estación de ayuda suma 10 s</small></div></div>
      <div class="fact" style="color:var(--oro)">${ICON[L.treasure]}<div><b>Tesoro</b><small>${L.treasureName}</small></div></div>
    </div>
    ${controlsHTML()}
    <div class="sponsor-strip"><span>Misión patrocinada por</span><span class="brandbox">Tu marca</span></div>
    <div class="card-actions"><button class="btn" id="goBtn">${ICON.play}¡Vamos!</button><span class="note">Nivel ${i + 1} de 3 · Carnaval de Barranquilla</span></div>`);
  $('#goBtn').onclick = startPlay;
}

function startPlay() {
  hideCard(); setState('play'); session.plays++;
  if (!session.start) session.start = performance.now();
  ui.hud.hidden = false; ui.touch.hidden = !IS_TOUCH;
  ui.lvlName.textContent = level.data.name; ui.lvlSub.textContent = `Carnaval de Barranquilla · ${level.i + 1}/3`;
  renderSlots(); updateTimer();
  if (!IS_TOUCH) { ui.keysHint.hidden = false; ui.keysHint.style.opacity = 1; setTimeout(() => (ui.keysHint.style.opacity = 0), 6000); }
  toast(`Busca ${level.data.pickupName} brillantes<small>El tesoro está al final de la calle, en la plaza</small>`, 3200);
}

function pauseGame() {
  if (state !== 'play') return;
  setState('paused');
  showCard(`<h2>Pausa</h2><p>${level.data.name}: llevas <strong>${level.collected} de 6</strong> ${level.data.pickupName} y te quedan <strong>${fmt(level.time)}</strong>.</p>
    <div class="card-actions"><button class="btn" id="resBtn">${ICON.play}Continuar</button><button class="btn alt sm" id="rstBtn">${ICON.retry}Reiniciar nivel</button>
    <button class="btn alt sm" id="sndBtn">${sound.muted ? ICON.soundOff + 'Activar sonido' : ICON.soundOn + 'Silenciar'}</button><button class="btn alt sm" id="homeBtn">${ICON.home}Volver al mapa</button></div>`);
  $('#resBtn').onclick = resumeGame; $('#rstBtn').onclick = () => introLevel(level.i);
  $('#sndBtn').onclick = () => { sound.setMuted(!sound.muted); setState('play'); pauseGame(); };
  $('#homeBtn').onclick = showTitle;
}
function resumeGame() { hideCard(); setState('play'); }

function failLevel() {
  setState('fail'); ui.touch.hidden = true; ui.hud.hidden = true;
  const left = 6 - level.collected;
  showCard(`<h2>Se acabó el tiempo</h2><p>${left > 0 ? `Te ${left === 1 ? 'faltó' : 'faltaron'} <strong>${left}</strong> ${left === 1 ? level.data.pickupOne : level.data.pickupName}.` : 'Tenías todas las piezas: te faltó llegar al tesoro.'} La estación de ayuda de la mitad del camino te da 10 segundos extra.</p>
    <div class="card-actions"><button class="btn" id="againBtn">${ICON.retry}Reintentar nivel</button><button class="btn alt sm" id="homeBtn">${ICON.home}Volver al mapa</button></div>`);
  $('#againBtn').onclick = () => introLevel(level.i); $('#homeBtn').onclick = showTitle;
}

function collectPickup(pk) {
  pk.taken = true; level.collected++; session.pieces++;
  sparks.burst(pk.m.position.clone(), pk.m.userData.color || (level.data.pickup === 'farol' ? '#ff9a3a' : COL.oro), 40, 7);
  sound.sfxCollect(level.collected); renderSlots(); flash(pk.m.userData.color || '#fff6d0', 0.12);
  updateLevelMood();
  const L = level.data;
  if (level.collected === 6) {
    level.unlocked = true; sound.sfxUnlock();
    toast(`¡El tesoro está libre!<small>Corre a la plaza por ${L.treasureName}</small>`, 3200);
    level.goal.beam.material.uniforms.uCol.value.set(1.1, 0.75, 0.22);
  } else {
    const msgs = { nota: ['¡Suena la guacharaca!', '¡Entran las maracas!', '¡Llegó el bajo!', '¡Repica el tambor alegre!', '¡Se suma el acordeón!'], gota: ['Vuelve el color', 'La calle respira', 'Brillan las fachadas', 'Regresan los banderines', 'Ya casi: ¡una más!'], farol: ['Se prende la primera luz', 'Bombillos encendidos', 'Llegan los metales', 'Se prenden las ventanas', 'La plaza se ilumina'] };
    toast(`${msgs[L.pickup][level.collected - 1]}<small>${level.collected} de 6 ${L.pickupName}</small>`, 1600);
  }
}

function respawn() {
  session.falls++; sound.sfxFall(); flash('#0f1747', 0.5);
  player.root.position.copy(level.checkpoint); player.vel.set(0, 0, 0); player.ground = null;
  level.time = Math.max(1, level.time - 3);
  toast('¡El público te devolvió a la ruta!<small>−3 segundos</small>', 1800);
  camState.pos.set(level.checkpoint.x, level.checkpoint.y + 6, level.checkpoint.z + 10);
}

function reachTreasure() {
  setState('treasure'); ui.touch.hidden = true; ui.hud.hidden = true; ui.keysHint.hidden = true;
  sound.sfxFanfare(); flash('#fff2c0', 0.5);
  player.root.position.set(level.goal.pos.x, level.goal.pos.y, level.goal.pos.z + 2.3); player.vel.set(0, 0, 0); player.facing = 0;
  level.goal.cage.visible = false; level.goal.beam.visible = false;
  const gp = level.goal.pos; for (let k = 0; k < 4; k++) setTimeout(() => sparks.burst(new THREE.Vector3(gp.x, gp.y + 2, gp.z), null, 50, 9), k * 220);
  confetti.m.uniforms.uAmount.value = 1;
}

function completeLevel() {
  const i = level.i; completedLevels = Math.max(completedLevels, i + 1); session.completed++;
  if (i === 2) { startFinale(); return; }
  setState('complete');
  const L = level.data;
  showCard(`<h2>¡Tesoro encontrado!</h2>
    <p><strong>Conseguiste ${L.treasureName}.</strong> ${L.note}</p>
    ${passportHTML(i + 1, i)}
    <div class="facts"><div class="fact">${ICON.clock}<div><b>${fmt(level.time)}</b><small>tiempo restante</small></div></div><div class="fact">${ICON[L.pickup]}<div><b>6 de 6</b><small>${L.pickupName}</small></div></div></div>
    <div class="card-actions"><button class="btn" id="nextBtn">${ICON.play}Siguiente: ${LEVELS[i + 1].name}</button></div>`);
  $('#nextBtn').onclick = () => introLevel(i + 1);
}

// --- final: la comparsa ----------------------------------------------------
let comparsa = [];
function startFinale() {
  setState('finale');
  setBulbs(3.4); level.facadeMats?.forEach((m) => (m.emissiveIntensity = 1.5));
  sound.setLayers({ tambora: 1, llamador: 1, alegre: 1, guacharaca: 1, maracas: 1, bass: 1, chords: 1, gaita: 1, brass: 1, crowd: 1 }, 1.5);
  sound.setFilter(18000);
  const types = ['marimonda', 'cumbia', 'congo', 'tambor', 'cumbia', 'marimonda', 'cumbia', 'congo'];
  const N = IS_TOUCH ? 18 : 26;
  comparsa = [];
  R = mulberry32(5);
  for (let k = 0; k < N; k++) { const d = makeDancer(types[k % types.length]); d.t = k / N; d.g.scale.setScalar(1.2); world.add(d.g); comparsa.push(d); }
  satifyTree(world);
  player.vel.set(0, 0, 0);
}
function updateComparsa(dt, beats) {
  const cz = level.plazaZ, gz = level.goal.pos.z;
  for (const d of comparsa) {
    d.t += dt * 0.022;
    const a = d.t * TAU, x = Math.cos(a) * 13, z = gz - 20 + Math.sin(a) * 6.5;
    d.g.position.set(x, 0, z);
    d.g.rotation.y = Math.atan2(-Math.sin(a) * 13, Math.cos(a) * 6.5);
    const bt = beats * Math.PI + d.t * 20, P = d.parts;
    P.body.position.y = Math.abs(Math.sin(bt)) * 0.25; P.body.rotation.z = Math.sin(bt) * 0.12;
    P.arms[0].rotation.x = -1.2 + Math.sin(bt) * 0.6; P.arms[1].rotation.x = -1.2 - Math.sin(bt) * 0.6;
    P.arms[0].rotation.z = 0.5; P.arms[1].rotation.z = -0.5;
    if (P.skirt) { P.skirt.rotation.y += dt * 3; const s = 1 + Math.abs(Math.sin(bt)) * 0.12; P.skirt.scale.set(0.62 * s, 0.62, 0.62 * s); }
  }
}
function showEnd() {
  setState('end'); hideCard(); ui.end.hidden = false;
  const mins = session.start ? (performance.now() - session.start) / 1000 : 0;
  ui.endPanel.innerHTML = `
    <div class="end-col">
      <h2>¡Barranquilla está de fiesta!</h2>
      <p>Recuperaste los tres tesoros del Carnaval, una celebración que la UNESCO declaró Obra Maestra del Patrimonio Oral e Inmaterial de la Humanidad. La ruta sigue hacia <strong>Valledupar y el Festival Vallenato</strong>.</p>
      ${passportHTML(3, 2)}
      <div class="card-actions"><button class="btn" id="replayBtn">${ICON.retry}Jugar otra vez</button><button class="btn alt sm" id="mapBtn">${ICON.home}Volver al inicio</button></div>
    </div>
    <div class="end-col">
      <div class="end-map">${mapSVG(true)}</div>
      <div class="sponsor-strip"><span>Con <span class="brandbox" style="height:26px">Tu marca</span>, desbloquea el siguiente tesoro</span><button class="btn sm" id="unlockBtn">${ICON.lock}Desbloquear</button></div>
      <div class="stats" aria-label="Métricas de esta sesión">
        <div class="stat"><b>${session.plays}</b><small>partidas iniciadas</small></div>
        <div class="stat"><b>${session.completed}</b><small>niveles completados</small></div>
        <div class="stat"><b>${fmt(mins)}</b><small>tiempo de interacción</small></div>
        <div class="stat"><b>${session.pieces}</b><small>piezas reunidas</small></div>
      </div>
      <p class="note">Así mediría una marca su participación. Estos datos son solo de esta sesión: no se guardan ni se envían.</p>
    </div>`;
  $('#unlockBtn').onclick = () => toast('Aquí la marca abre el próximo destino<small>Espacio de patrocinio disponible en la propuesta</small>', 3000);
  $('#replayBtn').onclick = () => { comparsa = []; introLevel(0); };
  $('#mapBtn').onclick = () => { comparsa = []; showTitle(); };
}

function updateTimer() {
  ui.timerTxt.textContent = fmt(level.time);
  ui.timer.classList.toggle('low', level.time <= 10);
}

// ---------------------------------------------------------------------------
// Bucle principal
// ---------------------------------------------------------------------------
let last = performance.now(), frameAcc = 0, frameN = 0, qualityChecked = false;
const tmpV = new THREE.Vector3();

function updateAmbient(dt, beats) {
  TIME.value = clock; BEAT.value = beats;
  for (const f of level.floats) {
    const u = f.userData; const range = 110; let x = ((clock * u.speed + u.off) % range + range) % range - range / 2;
    f.position.set(x, 0, u.z); f.children[2] && (f.children[2].rotation.y = Math.sin(clock * 0.8 + u.off) * 0.25);
    f.position.y = Math.abs(Math.sin(beats * Math.PI)) * 0.05;
  }
  for (const pk of level.pickups) {
    if (pk.taken) { pk.m.scale.multiplyScalar(Math.exp(-dt * 10)); pk.m.position.y += dt * 3; if (pk.m.scale.x < 0.02) pk.m.visible = false; continue; }
    pk.m.rotation.y += dt * 2.2; pk.m.position.y = pk.base.y + Math.sin(clock * 2.4 + pk.k) * 0.18;
    pk.m.userData.halo.rotation.x = Math.PI / 2 + Math.sin(clock * 1.7 + pk.k) * 0.3; pk.m.userData.halo.scale.setScalar(1 + Math.pow(1 - (beats % 1), 4) * 0.25);
  }
  const g = level.goal;
  if (g) {
    if (state === 'treasure' || state === 'finale' || state === 'end' || state === 'complete') { g.treasure.position.y = damp(g.treasure.position.y, g.baseY + 1.4, 3, dt); g.treasure.rotation.y += dt * 1.6; }
    else { g.treasure.rotation.y += dt * 0.6; g.cage.rotation.y -= dt * 0.3; if (level.unlocked) { g.cage.position.y = damp(g.cage.position.y, -3.2, 2, dt); } else g.cage.position.y = 0; }
  }
  if (level.station) { level.station.glow.material.opacity = level.station.used ? 0.12 : 0.35 + Math.sin(clock * 4) * 0.15; }
  if (level.data && level.data.id === 'colores' && level.satTarget !== undefined) SAT.value = damp(SAT.value, level.satTarget, 2.5, dt);
  if (level.data && level.data.id === 'fiesta' && level.lightTarget !== undefined && state !== 'finale' && state !== 'end') {
    const k = level.lightTarget; BULB_MAT.color.r = damp(BULB_MAT.color.r, lerp(0.15, 3.2, k), 2, dt); BULB_MAT.color.g = BULB_MAT.color.r * 0.78; BULB_MAT.color.b = BULB_MAT.color.r * 0.45;
    level.facadeMats?.forEach((m) => (m.emissiveIntensity = damp(m.emissiveIntensity, lerp(0.2, 1.4, k), 2, dt)));
  }
  grade.uniforms.uFlash.value = damp(grade.uniforms.uFlash.value, 0, 6, dt);
  confetti.m.uniforms.uCenter.value.copy(camera.position).add(tmpV.set(0, -4, -14));
  confetti.m.uniforms.uPixel.value = renderer.getPixelRatio() * (innerHeight / 900);
  sparks.update(dt);
  if (state === 'finale' || state === 'end') {
    fireworks.update(dt);
    if (Math.random() < dt * 1.6) fireworks.launch(new THREE.Vector3(rr(-30, 30), rr(24, 34), level.plazaZ - rr(5, 25)));
  }
  // sol y sombras siguen al jugador
  const focus = player.root.position;
  sun.target.position.set(focus.x, focus.y, focus.z - 4); sun.position.copy(sun.target.position).add(sunOff);
  sky.position.copy(camera.position);
}

function update(dt) {
  clock += dt; stateT += dt;
  const beats = sound.beats();
  readInput();
  if (level.data) updatePlatforms(dt, beats);
  if (state === 'title' || state === 'loading') {
    const t = clock * 0.06, z = 10 - ((t * 60) % 120);
    camera.position.set(Math.sin(clock * 0.15) * 3.5, 10 + Math.sin(clock * 0.2) * 1.2, z);
    camera.lookAt(Math.sin(clock * 0.15 + 1) * 2, 6.5, z - 22);
  } else if (state === 'intro') {
    camState.pos.lerp(tmpV.set(player.root.position.x + 3.5, player.root.position.y + 4.5, player.root.position.z + 7.5), 1 - Math.exp(-dt * 1.2));
    camState.look.lerp(tmpV.set(0, player.root.position.y + 1.5, player.root.position.z - 6), 1 - Math.exp(-dt * 1.5));
    camera.position.copy(camState.pos); camera.lookAt(camState.look);
    animatePlayer(dt, beats);
  } else if (state === 'play') {
    const sub = dt > 1 / 50 ? 2 : 1;
    for (let k = 0; k < sub; k++) stepPlayer(dt / sub);
    animatePlayer(dt, beats);
    followCamera(dt);
    level.time -= dt;
    if (level.time <= 10 && Math.ceil(level.time) !== lastTick) { lastTick = Math.ceil(level.time); sound.sfxTick(); }
    updateTimer();
    const pc = tmpV.copy(player.root.position); pc.y += 0.9;
    for (const pk of level.pickups) if (!pk.taken && pk.m.position.distanceTo(pc) < 1.25) collectPickup(pk);
    const st = level.station;
    if (st && player.root.position.distanceTo(st.pos) < 3.2) {
      if (!st.used) { st.used = true; level.time += 10; level.checkpoint.copy(st.pos); sound.sfxChime(); toast('Estación de ayuda · <span class="brandbox" style="height:24px">Tu marca</span><small>+10 segundos y punto de control</small>', 2600); sparks.burst(st.pos.clone().add(new THREE.Vector3(0, 1, 0)), COL.oro, 30, 5); }
    }
    if (level.unlocked && player.root.position.distanceTo(level.goal.pos) < 2.2) reachTreasure();
    else if (!level.unlocked && player.root.position.distanceTo(level.goal.pos) < 2.6 && stateT > 1 && (stateT % 2.5) < dt) toast(`La jaula sigue cerrada<small>Te faltan ${6 - level.collected} ${level.data.pickupName}</small>`, 1800);
    if (player.root.position.y < 0.9) respawn();
    if (level.time <= 0) { level.time = 0; updateTimer(); failLevel(); }
  } else if (state === 'treasure') {
    const g = level.goal.pos, a = stateT * 0.9 + Math.PI * 0.5;
    camera.position.set(g.x + Math.cos(a) * 5.2, g.y + 3.4, g.z + 1.5 + Math.abs(Math.sin(a)) * 4.5); camera.lookAt(g.x, g.y + 2.2, g.z);
    animatePlayer(dt, beats);
    if (stateT > 2.8) completeLevel();
  } else if (state === 'finale' || state === 'end') {
    const g = level.goal.pos, k = THREE.MathUtils.smoothstep(stateT + (state === 'end' ? 99 : 0), 1.5, 5);
    const ax = Math.sin(clock * 0.15);
    camera.position.set(lerp(g.x + 3, ax * 8, k), lerp(g.y + 2.6, 5.5 + Math.sin(clock * 0.3) * 0.5, k), lerp(g.z + 5.5, g.z - 9, k));
    camera.lookAt(lerp(g.x, ax * 2.5, k), lerp(g.y + 1.4, 2.2, k), lerp(g.z, g.z - 21, k));
    player.facing = Math.PI; player.vel.set(0, 0, 0); animatePlayer(dt, beats);
    updateComparsa(dt, beats);
    if (state === 'finale' && stateT > 8) showEnd();
  } else { // pausa, completo, fallo: la escena sigue viva
    if (state !== 'paused') followCamera(dt, 2);
    else { camera.position.copy(camState.pos); camera.lookAt(camState.look); }
    animatePlayer(dt, beats);
  }
  updateAmbient(dt, beats);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  if (useComposer) composer.render(); else renderer.render(scene, camera);
  // calidad automática: si el equipo no da, bajamos resolución y quitamos el brillo
  if (!qualityChecked && (state === 'play' || state === 'title')) {
    frameAcc += dt; frameN++;
    if (frameAcc > 3) {
      const avg = frameAcc / frameN; qualityChecked = true;
      if (avg > 1 / 38) { DPR = Math.max(1, DPR * 0.75); applySize(); bloom.enabled = false; }
      if (avg > 1 / 24) { sun.castShadow = false; }
    }
  }
}

function applySize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(DPR); renderer.setSize(w, h, false);
  composer.setPixelRatio(DPR); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = portrait() ? 72 : 58; camera.updateProjectionMatrix();
}
addEventListener('resize', applySize);
addEventListener('orientationchange', () => setTimeout(applySize, 200));
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pauseGame(); });

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
$('#playBtn').addEventListener('click', () => {
  sound.init(); sound.resume(); sound.start();
  if (IS_TOUCH && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) { /* no soportado */ }
  introLevel(0);
});
$('#pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); pauseGame(); });
$('#pauseBtn').addEventListener('pointerdown', (e) => e.stopPropagation());

async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('40px Shrikhand'), document.fonts.load('800 20px "Bricolage Grotesque"')]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* seguimos con la fuente de respaldo */ }
  buildTextures();
  createPlayer();
  applySize();
  buildLevel(0);
  renderer.compile(scene, camera);
  requestAnimationFrame(frame);
  showTitle();
  setTimeout(() => $('#loading').classList.add('out'), 150);
}
boot().catch((err) => { console.error(err); $('#loadingText').textContent = 'No se pudo iniciar el 3D en este navegador. Prueba con Chrome o Safari actualizados.'; });
