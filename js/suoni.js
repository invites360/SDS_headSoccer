'use strict';

// Effetti sonori sintetizzati con Web Audio: nessun file audio da caricare.
const Suoni = (() => {
  let ctx = null;
  let master = null;
  let rumore = null;
  let folla = null;
  let muto = false;
  const ultimi = {};

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muto ? 0 : 0.7;
    master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    rumore = buf;
    avviaFolla();
  }

  // evita raffiche dello stesso suono nello stesso istante
  function libero(nome, intervallo) {
    if (!ctx) return false;
    const t = ctx.currentTime;
    if (ultimi[nome] && t - ultimi[nome] < intervallo) return false;
    ultimi[nome] = t;
    return true;
  }

  function inviluppo(g, t, attacco, durata, picco) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(picco, t + attacco);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
  }

  function tono(freq, durata, { tipo = 'sine', volume = 0.3, finale = null, attacco = 0.004, ritardo = 0 } = {}) {
    const t = ctx.currentTime + ritardo;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (finale) o.frequency.exponentialRampToValueAtTime(finale, t + durata);
    inviluppo(g, t, attacco, durata, volume);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + durata + 0.05);
  }

  function soffio(durata, { filtro = 'bandpass', freq = 1000, q = 1, volume = 0.3, attacco = 0.005, freqFinale = null, ritardo = 0 } = {}) {
    const t = ctx.currentTime + ritardo;
    const s = ctx.createBufferSource();
    s.buffer = rumore;
    const f = ctx.createBiquadFilter();
    f.type = filtro;
    f.frequency.setValueAtTime(freq, t);
    if (freqFinale) f.frequency.exponentialRampToValueAtTime(freqFinale, t + durata);
    f.Q.value = q;
    const g = ctx.createGain();
    inviluppo(g, t, attacco, durata, volume);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random());
    s.stop(t + durata + 0.05);
  }

  function avviaFolla() {
    const s = ctx.createBufferSource();
    s.buffer = rumore;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 0.5;
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.23;
    lfoG.gain.value = 220;
    lfo.connect(lfoG).connect(f.frequency);
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(f).connect(g).connect(master);
    s.start();
    lfo.start();
    folla = g;
  }

  return {
    init,
    get muto() { return muto; },
    alternaMuto() {
      muto = !muto;
      if (master) master.gain.setTargetAtTime(muto ? 0 : 0.7, ctx.currentTime, 0.05);
      return muto;
    },
    // 0 = folla tranquilla, 1 = boato
    folla(livello) {
      if (!folla) return;
      folla.gain.setTargetAtTime(0.035 + livello * 0.22, ctx.currentTime, 0.25);
    },
    zittisciFolla() {
      if (folla) folla.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    },
    calcio(forza = 1) {
      if (!libero('calcio', 0.05)) return;
      tono(170, 0.13, { volume: 0.55 * forza, finale: 55 });
      soffio(0.05, { freq: 2500, q: 0.8, volume: 0.25 * forza });
    },
    testa() {
      if (!libero('testa', 0.06)) return;
      tono(260, 0.1, { volume: 0.35, finale: 120 });
      soffio(0.04, { freq: 1800, volume: 0.12 });
    },
    rimbalzo(v) {
      if (!libero('rimbalzo', 0.07)) return;
      tono(120, 0.08, { volume: clamp(v / 1500, 0.04, 0.25), finale: 70 });
    },
    traversa() {
      if (!libero('traversa', 0.1)) return;
      tono(1320, 0.6, { tipo: 'triangle', volume: 0.22 });
      tono(1980, 0.45, { tipo: 'sine', volume: 0.12 });
      tono(2640, 0.25, { tipo: 'sine', volume: 0.06 });
    },
    salto() {
      if (!libero('salto', 0.08)) return;
      soffio(0.12, { freq: 600, freqFinale: 1400, q: 2, volume: 0.06 });
    },
    fischio(volte = 1) {
      if (!ctx) return;
      for (let i = 0; i < volte; i++) {
        const lungo = i === volte - 1 && volte > 1;
        const t = ctx.currentTime + i * 0.45;
        const o = ctx.createOscillator();
        const vib = ctx.createOscillator();
        const vibG = ctx.createGain();
        const g = ctx.createGain();
        o.frequency.value = 2650;
        vib.frequency.value = 32;
        vibG.gain.value = 140;
        vib.connect(vibG).connect(o.frequency);
        const dur = lungo ? 0.9 : 0.32;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
        g.gain.setValueAtTime(0.16, t + dur - 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(master);
        o.start(t); vib.start(t);
        o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
      }
    },
    gol() {
      if (!ctx) return;
      soffio(3.2, { freq: 900, q: 0.4, volume: 0.55, attacco: 0.25 });
      soffio(2.6, { freq: 2200, q: 0.7, volume: 0.18, attacco: 0.3 });
      [233, 294, 349].forEach((f) => tono(f, 1.1, { tipo: 'sawtooth', volume: 0.07, attacco: 0.03 }));
    },
    potere() {
      if (!ctx) return;
      soffio(0.7, { freq: 300, freqFinale: 4000, q: 3, volume: 0.25 });
      [523, 659, 784, 1046].forEach((f, i) => tono(f, 0.25, { tipo: 'square', volume: 0.06, ritardo: i * 0.07 }));
    },
    esplosione() {
      if (!ctx) return;
      soffio(0.9, { filtro: 'lowpass', freq: 1800, freqFinale: 90, q: 0.7, volume: 0.8 });
      tono(90, 0.5, { volume: 0.5, finale: 30 });
    },
    puff() {
      if (!ctx) return;
      soffio(0.35, { freq: 900, freqFinale: 300, q: 1.2, volume: 0.25 });
    },
    pugno() {
      if (!ctx) return;
      tono(110, 0.18, { volume: 0.6, finale: 40 });
      soffio(0.1, { filtro: 'lowpass', freq: 1200, volume: 0.4 });
    },
    restringi() {
      if (!ctx) return;
      tono(900, 0.4, { tipo: 'square', volume: 0.06, finale: 200 });
    },
    bip(f = 880) {
      if (!ctx) return;
      tono(f, 0.15, { tipo: 'square', volume: 0.07 });
    },
    gelo() {
      if (!ctx) return;
      [1568, 2093, 2637, 3136].forEach((f, i) => tono(f, 0.5, { volume: 0.06, ritardo: i * 0.06 }));
      soffio(0.8, { filtro: 'highpass', freq: 3000, q: 0.5, volume: 0.12 });
    },
    getto() {
      if (!ctx) return;
      soffio(0.7, { freq: 1500, freqFinale: 2600, q: 4, volume: 0.22, attacco: 0.05 });
    },
    splash() {
      if (!ctx || !libero('splash', 0.15)) return;
      soffio(0.45, { filtro: 'lowpass', freq: 2400, freqFinale: 300, q: 0.8, volume: 0.35 });
      tono(300, 0.12, { volume: 0.12, finale: 900 });
    },
    // ---------- suoni delle mosse aggiunte ----------
    chitarra() {
      if (!ctx || !libero('chitarra', 0.3)) return;
      // accordo "suonato malissimo": quinte stonate e distorte
      [82, 123, 117, 165, 174].forEach((f, i) => tono(f, 0.7, { tipo: 'sawtooth', volume: 0.07, ritardo: i * 0.012, finale: f * 0.97 }));
      soffio(0.25, { freq: 3000, q: 0.6, volume: 0.06 });
    },
    risucchio() {
      if (!ctx) return;
      soffio(0.6, { freq: 3000, freqFinale: 200, q: 2, volume: 0.25 });
      tono(600, 0.5, { tipo: 'triangle', volume: 0.08, finale: 120 });
    },
    starnuto() {
      if (!ctx) return;
      tono(500, 0.15, { tipo: 'triangle', volume: 0.08, finale: 900 });
      soffio(0.3, { freq: 2600, q: 0.7, volume: 0.35, ritardo: 0.2 });
    },
    ruggito() {
      if (!ctx) return;
      tono(120, 0.8, { tipo: 'sawtooth', volume: 0.1, finale: 70, attacco: 0.08 });
      soffio(0.8, { filtro: 'lowpass', freq: 600, q: 4, volume: 0.25, attacco: 0.08 });
    },
    cresci() {
      if (!ctx) return;
      tono(150, 0.6, { tipo: 'square', volume: 0.06, finale: 600 });
    },
    allarme() {
      if (!ctx || !libero('allarme', 0.3)) return;
      tono(880, 0.12, { tipo: 'square', volume: 0.05 });
      tono(660, 0.12, { tipo: 'square', volume: 0.05, ritardo: 0.14 });
    },
    magia() {
      if (!ctx) return;
      [1046, 1318, 1568, 2093].forEach((f, i) => tono(f, 0.3, { tipo: 'triangle', volume: 0.06, ritardo: i * 0.05 }));
      soffio(0.4, { freq: 900, freqFinale: 300, q: 1.2, volume: 0.2 });
    },
    barrito() {
      if (!ctx) return;
      tono(420, 0.9, { tipo: 'sawtooth', volume: 0.12, finale: 700, attacco: 0.05 });
      tono(430, 0.9, { tipo: 'square', volume: 0.05, finale: 690, attacco: 0.05 });
    },
    passi() {
      if (!ctx || !libero('passi', 0.25)) return;
      tono(60, 0.25, { volume: 0.4, finale: 35 });
    },
    risata() {
      if (!ctx) return;
      for (let i = 0; i < 5; i++) tono(380 - i * 20, 0.09, { tipo: 'triangle', volume: 0.1, ritardo: i * 0.13, finale: 300 - i * 20 });
    },
    cucu() {
      if (!ctx) return;
      for (let k = 0; k < 2; k++) {
        tono(784, 0.18, { tipo: 'sine', volume: 0.2, ritardo: k * 0.6 });
        tono(622, 0.3, { tipo: 'sine', volume: 0.2, ritardo: k * 0.6 + 0.22 });
      }
    },
    fischietto() {
      if (!ctx) return;
      tono(1800, 0.15, { volume: 0.08, finale: 2400 });
      tono(2400, 0.2, { volume: 0.08, finale: 1500, ritardo: 0.18 });
    },
    hack() {
      if (!ctx) return;
      for (let i = 0; i < 10; i++) tono(rand(300, 2400), 0.05, { tipo: 'square', volume: 0.05, ritardo: i * 0.05 });
    },
    riflettore() {
      if (!ctx) return;
      tono(90, 0.3, { tipo: 'square', volume: 0.12, finale: 60 });
      soffio(0.5, { filtro: 'highpass', freq: 4000, q: 0.5, volume: 0.06, ritardo: 0.1 });
    },
    lancio() {
      if (!ctx || !libero('lancio', 0.1)) return;
      soffio(0.18, { freq: 900, freqFinale: 2200, q: 1.5, volume: 0.12 });
    },
    splat() {
      if (!ctx || !libero('splat', 0.08)) return;
      soffio(0.2, { filtro: 'lowpass', freq: 1200, freqFinale: 200, q: 1, volume: 0.35 });
      tono(160, 0.12, { volume: 0.2, finale: 60 });
    },
    scatto() {
      if (!ctx || !libero('scatto', 0.1)) return;
      soffio(0.2, { freq: 1500, freqFinale: 500, q: 1, volume: 0.15 });
    },
  };
})();

// In una partita online l'host registra i suoni da far suonare anche all'ospite.
Suoni.registro = null;
for (const nome of Object.keys(Suoni)) {
  if (['init', 'muto', 'alternaMuto', 'folla', 'zittisciFolla', 'registro'].includes(nome)) continue;
  const originale = Suoni[nome];
  if (typeof originale !== 'function') continue;
  Suoni[nome] = (...args) => {
    if (Suoni.registro && Suoni.registro.length < 40) Suoni.registro.push([nome, ...args]);
    return originale(...args);
  };
}
