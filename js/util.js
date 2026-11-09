'use strict';

// Mondo di gioco in unità logiche: il canvas viene scalato per riempire lo schermo.
const W = 1600;
const H = 900;
const GROUND = 770;

const GOAL_DEPTH = 140;
const GOAL_H = 250;
const BAR_Y = GROUND - GOAL_H;
const BAR_R = 9;

const DURATA_PARTITA = 60;

const COLORI_SQUADRA = {
  sinistra: { maglia: '#2563eb', scuro: '#1e3a8a', chiaro: '#60a5fa', pantaloni: '#0f172a', scarpe: '#f8fafc' },
  destra: { maglia: '#e11d48', scuro: '#881337', chiaro: '#fb7185', pantaloni: '#f8fafc', scarpe: '#111827' },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const segno = (v) => (v < 0 ? -1 : 1);

// "Aprea_Saverio" -> { cognome: "Aprea", nome: "Saverio" }
function partiNome(id) {
  const parti = id.split(/[_.]+/).filter(Boolean);
  return { cognome: parti[0] || id, nome: parti.slice(1).join(' ') };
}

function nomeCompleto(id) {
  const p = partiNome(id);
  return p.nome ? `${p.nome} ${p.cognome}` : p.cognome;
}

function chiaveId(id) {
  return id.trim().replace(/[.\s]/g, '_').toLowerCase();
}

// Mescola due colori "#rrggbb" (k = 0 -> a, k = 1 -> b) e restituisce ancora "#rrggbb".
function mescola(a, b, k) {
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(lerp((na >> s) & 255, (nb >> s) & 255, k));
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}

function hashStringa(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Punto del segmento AB più vicino a P.
function puntoSuSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return { x: ax + dx * t, y: ay + dy * t };
}

// Spinta minima per far uscire un cerchio da un rettangolo (null se non si toccano).
function spintaCerchioRett(cx, cy, r, rx, ry, rw, rh) {
  const qx = clamp(cx, rx, rx + rw);
  const qy = clamp(cy, ry, ry + rh);
  const dx = cx - qx, dy = cy - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: (dx / d) * (r - d), y: (dy / d) * (r - d), nx: dx / d, ny: dy / d };
  }
  // centro dentro il rettangolo: esce dal lato più vicino
  const opzioni = [
    { x: rx - r - cx, y: 0, nx: -1, ny: 0 },
    { x: rx + rw + r - cx, y: 0, nx: 1, ny: 0 },
    { x: 0, y: ry - r - cy, nx: 0, ny: -1 },
    { x: 0, y: ry + rh + r - cy, nx: 0, ny: 1 },
  ];
  return opzioni.reduce((a, b) => (Math.abs(a.x + a.y) < Math.abs(b.x + b.y) ? a : b));
}

// Spinta per far uscire un cerchio da una capsula (segmento con raggio).
function spintaCerchioCapsula(cx, cy, r, ax, ay, bx, by, cr) {
  const q = puntoSuSegmento(cx, cy, ax, ay, bx, by);
  const dx = cx - q.x, dy = cy - q.y;
  const d = Math.hypot(dx, dy);
  const R = r + cr;
  if (d >= R) return null;
  const nx = d > 0.0001 ? dx / d : 0;
  const ny = d > 0.0001 ? dy / d : -1;
  return { x: nx * (R - d), y: ny * (R - d), nx, ny };
}

// Rettangolo con angoli arrotondati (path soltanto).
function pathRett(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Schiarisce (k > 1) o scurisce (k < 1) un colore "#rrggbb".
function tinta(c, k) {
  return k >= 1 ? mescola(c, '#ffffff', clamp(k - 1, 0, 1)) : mescola(c, '#000000', clamp(1 - k, 0, 1));
}

// Nomi dei personaggi citati in un testo, scritti come "Cognome_Nome", "Cognome Nome" o "Nome Cognome".
function personaggiCitati(testo) {
  const elenco = Array.isArray(window.DATI_PERSONAGGI) ? window.DATI_PERSONAGGI : [];
  const t = ` ${testo.toLowerCase().replace(/[_.]/g, ' ')} `;
  const trovati = [];
  for (const p of elenco) {
    const { cognome, nome } = partiNome(p.id);
    if (!nome) continue;
    const varianti = [`${cognome} ${nome}`, `${nome} ${cognome}`].map((v) => ` ${v.toLowerCase()} `);
    const pos = Math.min(...varianti.map((v) => {
      const i = t.indexOf(v);
      return i < 0 ? Infinity : i;
    }));
    if (pos < Infinity) trovati.push({ id: p.id, pos });
  }
  return trovati.sort((a, b) => a.pos - b.pos).map((x) => x.id);
}

function creaCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Stato della tastiera: "giu" = tenuto premuto, "premuti" = appena premuti (consumati a ogni frame),
// "doppi" = premuti due volte di fila in poco tempo (per gli scatti di K-POP e Japan).
const Tasti = {
  giu: new Set(),
  premuti: new Set(),
  doppi: new Set(),
  ultimi: {},
  premuto(code) { return this.premuti.has(code); },
  tenuto(code) { return this.giu.has(code); },
  doppio(code) { return this.doppi.has(code); },
  consuma() { this.premuti.clear(); this.doppi.clear(); },
};

const TASTI_GIOCO = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyZ', 'KeyX', 'KeyF', 'KeyC', 'KeyP', 'KeyM'];

window.addEventListener('keydown', (e) => {
  if (!e.repeat) {
    Tasti.premuti.add(e.code);
    const ora = performance.now();
    if (ora - (Tasti.ultimi[e.code] || -1e9) < 280) {
      Tasti.doppi.add(e.code);
      Tasti.ultimi[e.code] = -1e9;
    } else {
      Tasti.ultimi[e.code] = ora;
    }
  }
  Tasti.giu.add(e.code);
  if (document.getElementById('partita').classList.contains('attiva') && TASTI_GIOCO.includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => Tasti.giu.delete(e.code));
window.addEventListener('blur', () => Tasti.giu.clear());
