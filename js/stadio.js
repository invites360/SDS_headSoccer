'use strict';

const PELLI = ['#f6d3b3', '#eec19b', '#e0ac69', '#d39a6a', '#c68642', '#a86b3c', '#8d5524', '#5c3a1e', '#ffdbac'];
const CAPELLI = ['#141414', '#1f1712', '#3b2416', '#5a3a22', '#7a5230', '#a67b4a', '#d8c08a', '#8a8a8a', '#cfcfcf', '#7a2e12'];
const MAGLIE_NEUTRE = ['#f8fafc', '#1f2937', '#374151', '#0f172a', '#6b7280', '#065f46', '#7c2d12', '#f59e0b', '#4c1d95', '#334155'];

const SPRITE_TIFOSO = { w: 60, h: 112, risoluzione: 2.5 };

// Un tifoso in due pose (seduto/tranquillo ed esultante), disegnato con sfumature per dare volume.
function creaTifoso(squadra) {
  const col = squadra ? COLORI_SQUADRA[squadra] : null;
  const pelle = pick(PELLI);
  const capelli = pick(CAPELLI);
  const donna = Math.random() < 0.35;
  const tifoso = {
    pelle,
    capelli,
    stileCapelli: donna ? pick(['lunghi', 'lunghi', 'coda', 'ricci', 'corti']) : pick(['corti', 'corti', 'rasato', 'calvo', 'ricci', 'cappello', 'berretto', 'corti']),
    barba: !donna && Math.random() < 0.3,
    occhiali: Math.random() < 0.15,
    maglia: col ? (Math.random() < 0.75 ? col.maglia : col.scuro) : pick(MAGLIE_NEUTRE),
    tipoMaglia: pick(['tinta', 'tinta', 'righe', 'giacca', 'felpa']),
    sciarpa: col && Math.random() < 0.45,
    col,
    esultanza: pick(['braccia', 'braccia', 'sciarpa', 'pugno']),
  };
  if (tifoso.esultanza === 'sciarpa' && !col) tifoso.esultanza = 'braccia';
  return {
    normale: disegnaSpriteTifoso(tifoso, false),
    esulta: disegnaSpriteTifoso(tifoso, true),
  };
}

function scurisci(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${clamp(r, 0, 255)},${clamp(g, 0, 255)},${clamp(b, 0, 255)})`;
}

function disegnaSpriteTifoso(t, esulta) {
  const { w, h, risoluzione: k } = SPRITE_TIFOSO;
  const c = creaCanvas(w * k, h * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  g.translate(w / 2, h);

  const coloreBraccio = t.tipoMaglia === 'giacca' ? scurisci(t.maglia, 0.7) : t.maglia;

  // braccia alzate dietro la testa
  if (esulta) {
    const braccia = t.esultanza === 'pugno' ? [1] : [-1, 1];
    braccia.forEach((s) => {
      const hx = s * (t.esultanza === 'sciarpa' ? 22 : 20);
      const hy = t.esultanza === 'pugno' ? -88 : -82;
      g.lineCap = 'round';
      g.strokeStyle = coloreBraccio;
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(s * 14, -32);
      g.lineTo(s * 18, -58);
      g.stroke();
      g.strokeStyle = t.pelle;
      g.lineWidth = 5.5;
      g.beginPath();
      g.moveTo(s * 18, -58);
      g.lineTo(hx, hy + 4);
      g.stroke();
      g.fillStyle = t.pelle;
      g.beginPath();
      g.arc(hx, hy + 2, 3.6, 0, Math.PI * 2);
      g.fill();
    });
    if (t.esultanza === 'sciarpa') {
      g.save();
      g.translate(0, -82);
      g.rotate(-0.05);
      g.fillStyle = t.col.maglia;
      g.fillRect(-24, -4, 48, 8);
      g.fillStyle = '#fff';
      for (let i = -20; i < 22; i += 8) g.fillRect(i, -4, 3, 8);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(-24, 2, 48, 2);
      g.restore();
    }
  }

  // capelli lunghi dietro la testa
  if (t.stileCapelli === 'lunghi') {
    g.fillStyle = t.capelli;
    g.beginPath();
    g.ellipse(0, -48, 11.5, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-11, -50, 22, 16);
  }

  // busto
  g.beginPath();
  g.moveTo(-19, 2);
  g.lineTo(-18, -24);
  g.quadraticCurveTo(-17.5, -35, -8, -37.5);
  g.lineTo(8, -37.5);
  g.quadraticCurveTo(17.5, -35, 18, -24);
  g.lineTo(19, 2);
  g.closePath();
  const gradBusto = g.createLinearGradient(-18, -38, 16, 0);
  gradBusto.addColorStop(0, scurisci(t.maglia, 1.15));
  gradBusto.addColorStop(1, scurisci(t.maglia, 0.7));
  g.fillStyle = gradBusto;
  g.fill();
  g.save();
  g.clip();
  if (t.tipoMaglia === 'righe') {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let x = -16; x < 20; x += 9) g.fillRect(x, -40, 3.5, 44);
  } else if (t.tipoMaglia === 'giacca') {
    g.fillStyle = scurisci(t.maglia, 0.55);
    g.fillRect(-20, -40, 40, 44);
    g.fillStyle = t.col ? t.col.chiaro : '#e5e7eb';
    g.beginPath();
    g.moveTo(-5, -37);
    g.lineTo(5, -37);
    g.lineTo(3, 4);
    g.lineTo(-3, 4);
    g.fill();
  } else if (t.tipoMaglia === 'felpa') {
    g.fillStyle = scurisci(t.maglia, 0.8);
    g.beginPath();
    g.ellipse(0, -36, 12, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(-3, -33); g.lineTo(-3, -22);
    g.moveTo(3, -33); g.lineTo(3, -22);
    g.stroke();
  }
  // pieghe
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-10, -20); g.quadraticCurveTo(-6, -12, -9, -2);
  g.moveTo(9, -24); g.quadraticCurveTo(6, -14, 10, -4);
  g.stroke();
  g.restore();

  // braccia abbassate
  if (!esulta) {
    [-1, 1].forEach((s) => {
      g.strokeStyle = coloreBraccio;
      g.lineCap = 'round';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(s * 16, -31);
      g.quadraticCurveTo(s * 20, -16, s * 17, -2);
      g.stroke();
    });
  } else if (t.esultanza === 'pugno') {
    g.strokeStyle = coloreBraccio;
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(-16, -31);
    g.quadraticCurveTo(-20, -16, -17, -2);
    g.stroke();
  }

  // collo
  g.fillStyle = scurisci(t.pelle, 0.82);
  g.fillRect(-4, -44, 8, 8);

  // sciarpa al collo
  if (t.sciarpa && !(esulta && t.esultanza === 'sciarpa')) {
    g.fillStyle = t.col.maglia;
    pathRett(g, -10, -40, 20, 6, 3);
    g.fill();
    g.fillRect(4, -37, 5, 18);
    g.fillStyle = '#fff';
    g.fillRect(4, -30, 5, 2.5);
    g.fillRect(4, -24, 5, 2.5);
  }

  // orecchie
  g.fillStyle = scurisci(t.pelle, 0.88);
  [-1, 1].forEach((s) => {
    g.beginPath();
    g.ellipse(s * 9.2, -51, 2, 3.2, 0, 0, Math.PI * 2);
    g.fill();
  });

  // viso
  const gradViso = g.createRadialGradient(-3, -56, 1, 0, -52, 13);
  gradViso.addColorStop(0, scurisci(t.pelle, 1.08));
  gradViso.addColorStop(0.7, t.pelle);
  gradViso.addColorStop(1, scurisci(t.pelle, 0.78));
  g.fillStyle = gradViso;
  g.beginPath();
  g.ellipse(0, -52, 9, 11.2, 0, 0, Math.PI * 2);
  g.fill();

  if (t.barba) {
    g.fillStyle = t.capelli;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.ellipse(0, -46, 8.4, 6, 0, 0, Math.PI);
    g.fill();
    g.globalAlpha = 1;
  }

  // occhi, sopracciglia, naso, bocca
  g.fillStyle = '#2b1d16';
  [-1, 1].forEach((s) => {
    g.beginPath();
    g.ellipse(s * 3.4, -53, 1.25, esulta ? 0.7 : 1, 0, 0, Math.PI * 2);
    g.fill();
  });
  g.strokeStyle = scurisci(t.capelli, 0.9);
  g.lineWidth = 1;
  [-1, 1].forEach((s) => {
    g.beginPath();
    g.moveTo(s * 1.8, esulta ? -57 : -56);
    g.lineTo(s * 5.2, esulta ? -57.6 : -56.2);
    g.stroke();
  });
  g.strokeStyle = scurisci(t.pelle, 0.7);
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(0.3, -52.5);
  g.lineTo(1, -49.5);
  g.lineTo(-0.6, -49.2);
  g.stroke();
  if (esulta) {
    g.fillStyle = '#3a0d0d';
    g.beginPath();
    g.ellipse(0, -45.6, 2.8, 2.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(-1.8, -47.8, 3.6, 0.9);
  } else {
    g.strokeStyle = '#6b2d2d';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(-2.2, -46);
    g.quadraticCurveTo(0, -45.2, 2.2, -46);
    g.stroke();
  }
  if (t.occhiali) {
    g.strokeStyle = '#111';
    g.lineWidth = 0.8;
    [-1, 1].forEach((s) => {
      g.beginPath();
      g.arc(s * 3.4, -53, 2.4, 0, Math.PI * 2);
      g.stroke();
    });
  }

  // capelli / copricapo
  g.fillStyle = t.capelli;
  switch (t.stileCapelli) {
    case 'corti':
    case 'lunghi':
    case 'coda':
      g.beginPath();
      g.ellipse(0, -56.5, 9.6, 7.5, 0, Math.PI, Math.PI * 2);
      g.lineTo(9.6, -52);
      g.quadraticCurveTo(6, -59, -2, -58.4);
      g.quadraticCurveTo(-8, -58, -9.6, -52);
      g.fill();
      if (t.stileCapelli === 'coda') {
        g.beginPath();
        g.ellipse(8, -60, 3, 5, 0.5, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'rasato':
      g.globalAlpha = 0.55;
      g.beginPath();
      g.ellipse(0, -56, 9.3, 7, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      break;
    case 'ricci':
      for (let i = 0; i < 11; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        g.beginPath();
        g.arc(Math.cos(a) * 8.5, -55 + Math.sin(a) * 7.5, 3.4, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'calvo':
      g.globalAlpha = 0.7;
      [-1, 1].forEach((s) => {
        g.beginPath();
        g.ellipse(s * 8.4, -54, 1.8, 3.5, 0, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath();
      g.ellipse(-2.5, -60, 3.5, 1.6, -0.3, 0, Math.PI * 2);
      g.fill();
      break;
    case 'cappello': {
      const cc = t.col ? t.col.maglia : pick(MAGLIE_NEUTRE);
      g.fillStyle = cc;
      g.beginPath();
      g.ellipse(0, -57, 9.8, 7.5, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.fillStyle = scurisci(cc.startsWith('#') ? cc : '#333333', 0.7);
      g.beginPath();
      g.ellipse(0, -56.5, 11, 2.4, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'berretto': {
      const cc = t.col ? t.col.maglia : pick(MAGLIE_NEUTRE);
      g.fillStyle = cc;
      g.beginPath();
      g.ellipse(0, -57, 9.8, 8.5, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(-9.8, -58, 19.6, 2.5);
      g.beginPath();
      g.arc(0, -66, 2.6, 0, Math.PI * 2);
      g.fill();
      break;
    }
  }

  // luce dall'alto, ombra in basso
  g.globalCompositeOperation = 'source-atop';
  const luce = g.createLinearGradient(0, -100, 0, 0);
  luce.addColorStop(0, 'rgba(255,255,255,0.06)');
  luce.addColorStop(0.55, 'rgba(0,0,0,0)');
  luce.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = luce;
  g.fillRect(-w / 2, -h, w, h);
  return c;
}

class Stadio {
  constructor() {
    this.ecc = { sinistra: 0, destra: 0 };
    this.sfondo = null;
    this.k = 0;
    this.flash = [];
    this.creaFolla();
  }

  creaFolla() {
    const varianti = { sinistra: [], destra: [], neutro: [] };
    for (let i = 0; i < 22; i++) varianti.sinistra.push(creaTifoso('sinistra'));
    for (let i = 0; i < 22; i++) varianti.destra.push(creaTifoso('destra'));
    for (let i = 0; i < 16; i++) varianti.neutro.push(creaTifoso(null));

    this.file = [];
    this.tifosi = [];
    this.bandiere = [];
    let y = 592;
    let s = 1;
    for (let fila = 0; fila < 8; fila++) {
      this.file.push({ y, s });
      let x = 6 + Math.random() * 14 * s;
      while (x < W - 6) {
        if (Math.random() > 0.06) {
          const lato = x < W / 2 ? 'sinistra' : 'destra';
          const r = Math.random();
          const tifo = r < 0.72 ? lato : r < 0.82 ? (lato === 'sinistra' ? 'destra' : 'sinistra') : 'neutro';
          this.tifosi.push({
            x: x + rand(-3, 3) * s,
            y: y + rand(-2, 2) * s,
            s: s * rand(0.93, 1.07),
            fila,
            tifo,
            sprite: pick(varianti[tifo]),
            fase: rand(0, Math.PI * 2),
            freq: rand(5, 9),
            soglia: rand(0.15, 0.85),
            pigro: Math.random() < 0.12,
          });
          if (fila < 4 && tifo !== 'neutro' && Math.random() < 0.025) {
            this.bandiere.push({ x, y: y - 70 * s, s, tifo, fase: rand(0, 6) });
          }
        }
        x += 31 * s * rand(0.92, 1.12);
      }
      y -= 56 * s;
      s *= 0.92;
    }
    // le file più lontane si disegnano per prime
    this.tifosi.sort((a, b) => b.fila - a.fila || a.x - b.x);
  }

  // eccita i tifosi di una squadra (o di tutte con null)
  esulta(lato, quanto) {
    if (lato) this.ecc[lato] = Math.max(this.ecc[lato], quanto);
    else {
      this.ecc.sinistra = Math.max(this.ecc.sinistra, quanto);
      this.ecc.destra = Math.max(this.ecc.destra, quanto);
    }
  }

  aggiorna(dt) {
    this.ecc.sinistra = Math.max(0, this.ecc.sinistra - dt * 0.18);
    this.ecc.destra = Math.max(0, this.ecc.destra - dt * 0.18);
    const media = (this.ecc.sinistra + this.ecc.destra) / 2;
    if (Math.random() < dt * (3 + media * 40)) {
      this.flash.push({ x: rand(10, W - 10), y: rand(140, 560), vita: 0.09, r: rand(4, 9) });
    }
    this.flash = this.flash.filter((f) => (f.vita -= dt) > 0);
    Suoni.folla(Math.max(this.ecc.sinistra, this.ecc.destra));
  }

  // ---------- sfondo statico ----------

  prepara(k) {
    k = Math.min(Math.max(k, 0.5), 2.5);
    if (this.sfondo && Math.abs(k - this.k) < 0.01) return;
    this.k = k;
    this.sfondo = creaCanvas(W * k, H * k);
    const g = this.sfondo.getContext('2d');
    g.scale(k, k);
    this.disegnaCielo(g);
    this.disegnaAnelloSuperiore(g);
    this.disegnaGradoni(g);
    this.disegnaCampo(g);
  }

  disegnaCielo(g) {
    const cielo = g.createLinearGradient(0, 0, 0, 260);
    cielo.addColorStop(0, '#05070f');
    cielo.addColorStop(1, '#141b33');
    g.fillStyle = cielo;
    g.fillRect(0, 0, W, 260);

    // copertura con travature
    g.fillStyle = '#0b0f1c';
    g.fillRect(0, 0, W, 64);
    g.strokeStyle = 'rgba(148,163,184,0.18)';
    g.lineWidth = 2;
    g.beginPath();
    for (let x = -40; x < W + 40; x += 80) {
      g.moveTo(x, 6); g.lineTo(x + 40, 58);
      g.moveTo(x + 80, 6); g.lineTo(x + 40, 58);
    }
    g.moveTo(0, 6); g.lineTo(W, 6);
    g.moveTo(0, 58); g.lineTo(W, 58);
    g.stroke();

    // riflettori
    [150, 470, 1130, 1450].forEach((cx) => {
      const alone = g.createRadialGradient(cx, 40, 4, cx, 40, 200);
      alone.addColorStop(0, 'rgba(255,255,240,0.55)');
      alone.addColorStop(0.25, 'rgba(200,220,255,0.16)');
      alone.addColorStop(1, 'rgba(200,220,255,0)');
      g.fillStyle = alone;
      g.fillRect(cx - 200, 0, 400, 300);
      g.fillStyle = '#1e293b';
      pathRett(g, cx - 66, 22, 132, 38, 4);
      g.fill();
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 6; c++) {
          const lx = cx - 55 + c * 22;
          const ly = 32 + r * 17;
          const lampada = g.createRadialGradient(lx, ly, 0, lx, ly, 9);
          lampada.addColorStop(0, '#ffffff');
          lampada.addColorStop(0.5, '#fff7d6');
          lampada.addColorStop(1, 'rgba(255,247,214,0)');
          g.fillStyle = lampada;
          g.beginPath();
          g.arc(lx, ly, 9, 0, Math.PI * 2);
          g.fill();
        }
      }
    });
  }

  // anello superiore: folla lontana resa come trama di puntini
  disegnaAnelloSuperiore(g) {
    const y0 = 70, y1 = 212;
    const fondo = g.createLinearGradient(0, y0, 0, y1);
    fondo.addColorStop(0, '#111827');
    fondo.addColorStop(1, '#1f2937');
    g.fillStyle = fondo;
    g.fillRect(0, y0, W, y1 - y0);
    for (let y = y0 + 6; y < y1 - 4; y += 7) {
      const prof = (y - y0) / (y1 - y0);
      for (let x = 2; x < W; x += rand(5, 8)) {
        if (Math.random() < 0.08) continue;
        const lato = x < W / 2 ? 'sinistra' : 'destra';
        const col = Math.random() < 0.6 ? COLORI_SQUADRA[lato].maglia : pick(MAGLIE_NEUTRE);
        g.globalAlpha = 0.35 + prof * 0.45;
        g.fillStyle = col;
        g.fillRect(x - 2, y, 4, 4);
        g.fillStyle = pick(PELLI);
        g.beginPath();
        g.arc(x, y - 1.5, 1.8, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    // parapetto
    const parap = g.createLinearGradient(0, y1, 0, y1 + 26);
    parap.addColorStop(0, '#475569');
    parap.addColorStop(1, '#1e293b');
    g.fillStyle = parap;
    g.fillRect(0, y1, W, 26);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(0, y1 + 26, W, 8);
  }

  disegnaGradoni(g) {
    const top = 246;
    g.fillStyle = '#1a2233';
    g.fillRect(0, top, W, 600 - top);
    // ogni fila: gradino in cemento e schienali dei seggiolini
    for (let i = this.file.length - 1; i >= 0; i--) {
      const f = this.file[i];
      const yGradino = f.y - 14 * f.s;
      const cemento = g.createLinearGradient(0, yGradino, 0, yGradino + 22 * f.s);
      cemento.addColorStop(0, '#64748b');
      cemento.addColorStop(0.15, '#475569');
      cemento.addColorStop(1, '#1e293b');
      g.fillStyle = cemento;
      g.fillRect(0, yGradino, W, 22 * f.s);
      for (let x = 4; x < W; x += 31 * f.s) {
        g.fillStyle = x < W / 2 ? '#1d4ed8' : '#be123c';
        g.globalAlpha = 0.75;
        pathRett(g, x, yGradino - 22 * f.s, 24 * f.s, 20 * f.s, 4 * f.s);
        g.fill();
        g.globalAlpha = 1;
      }
    }
  }

  disegnaCampo(g) {
    const y0 = 600;
    const erba = g.createLinearGradient(0, y0, 0, H);
    erba.addColorStop(0, '#1d5f2b');
    erba.addColorStop(0.5, '#2a7f37');
    erba.addColorStop(1, '#319a41');
    g.fillStyle = erba;
    g.fillRect(0, y0, W, H - y0);

    // strisce di taglio in prospettiva
    const prospettiva = (x, y) => W / 2 + (x - W / 2) * lerp(0.78, 1, (y - y0) / (H - y0));
    for (let i = -2; i < 18; i++) {
      if (i % 2) continue;
      const xa = i * 100, xb = xa + 100;
      g.fillStyle = 'rgba(255,255,255,0.045)';
      g.beginPath();
      g.moveTo(prospettiva(xa, y0), y0);
      g.lineTo(prospettiva(xb, y0), y0);
      g.lineTo(xb, H);
      g.lineTo(xa, H);
      g.fill();
    }
    let yb = y0, hb = 26, pari = true;
    while (yb < H) {
      if (pari) {
        g.fillStyle = 'rgba(0,0,0,0.05)';
        g.fillRect(0, yb, W, hb);
      }
      yb += hb;
      hb *= 1.18;
      pari = !pari;
    }
    // fili d'erba
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * W;
      const y = y0 + Math.random() * (H - y0);
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(10,50,20,0.18)' : 'rgba(170,230,150,0.10)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rand(-1, 1), y - rand(2, 5));
      g.stroke();
    }

    // linee del campo
    g.strokeStyle = 'rgba(255,255,255,0.72)';
    g.lineWidth = 3;
    g.lineJoin = 'round';
    const lontano = 626, vicino = 884;
    g.beginPath();
    g.moveTo(prospettiva(80, lontano), lontano);
    g.lineTo(prospettiva(1520, lontano), lontano);
    g.moveTo(40, vicino);
    g.lineTo(1560, vicino);
    g.moveTo(W / 2, lontano);
    g.lineTo(W / 2, vicino);
    g.stroke();
    g.beginPath();
    g.ellipse(W / 2, 756, 128, 48, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.ellipse(W / 2, 756, 5, 2.5, 0, 0, Math.PI * 2);
    g.fill();
    [-1, 1].forEach((s) => {
      const bx = s < 0 ? 0 : W;
      const px = (d) => bx - s * d;
      g.beginPath();
      g.moveTo(prospettiva(px(150), 655), 655);
      g.lineTo(prospettiva(px(330), 655), 655);
      g.lineTo(px(350), 860);
      g.lineTo(px(120), 860);
      g.moveTo(prospettiva(px(150), 690), 690);
      g.lineTo(prospettiva(px(220), 690), 690);
      g.lineTo(px(225), 820);
      g.lineTo(px(140), 820);
      g.stroke();
    });

    // pozze di luce dei riflettori e vignettatura
    [400, 1200].forEach((cx) => {
      const p = g.createRadialGradient(cx, 760, 20, cx, 760, 520);
      p.addColorStop(0, 'rgba(255,255,230,0.10)');
      p.addColorStop(1, 'rgba(255,255,230,0)');
      g.fillStyle = p;
      g.fillRect(0, y0, W, H - y0);
    });
    const vig = g.createLinearGradient(0, 0, W, 0);
    vig.addColorStop(0, 'rgba(0,0,0,0.25)');
    vig.addColorStop(0.15, 'rgba(0,0,0,0)');
    vig.addColorStop(0.85, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = vig;
    g.fillRect(0, y0, W, H - y0);
  }

  // ---------- parti animate ----------

  disegnaSfondo(ctx) {
    if (this.sfondo) ctx.drawImage(this.sfondo, 0, 0, W, H);
  }

  disegnaTifosi(ctx, t) {
    const { w, h } = SPRITE_TIFOSO;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 200, W, 400);
    ctx.clip();
    for (const f of this.tifosi) {
      const e = f.tifo === 'neutro' ? (this.ecc.sinistra + this.ecc.destra) * 0.35 : this.ecc[f.tifo];
      const esulta = !f.pigro && e > f.soglia;
      const salto = esulta
        ? Math.abs(Math.sin(t * f.freq * 1.4 + f.fase)) * 8 * f.s
        : (Math.sin(t * f.freq * 0.35 + f.fase) * 0.7 + 0.7) * f.s;
      const sp = esulta ? f.sprite.esulta : f.sprite.normale;
      ctx.drawImage(sp, f.x - (w / 2) * f.s, f.y - h * f.s - salto, w * f.s, h * f.s);
    }
    // bandiere sventolanti
    for (const b of this.bandiere) {
      const col = COLORI_SQUADRA[b.tifo];
      const e = this.ecc[b.tifo];
      const vel = 3 + e * 5;
      const ax = b.x, ay = b.y - 40 * b.s;
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 2 * b.s;
      ctx.beginPath();
      ctx.moveTo(ax, b.y + 30 * b.s);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      const lw = 58 * b.s, lh = 34 * b.s;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      for (let i = 0; i <= 10; i++) {
        const xx = ax + (lw * i) / 10;
        ctx.lineTo(xx, ay + Math.sin(t * vel + b.fase + i * 0.6) * 4 * b.s * (i / 10));
      }
      for (let i = 10; i >= 0; i--) {
        const xx = ax + (lw * i) / 10;
        ctx.lineTo(xx, ay + lh + Math.sin(t * vel + b.fase + i * 0.6) * 4 * b.s * (i / 10));
      }
      ctx.closePath();
      ctx.fillStyle = col.maglia;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(ax + lw / 3, ay - 10, lw / 3, lh + 20);
      ctx.restore();
    }
    // ombra sotto la copertura sulle file più lontane
    const ombra = ctx.createLinearGradient(0, 230, 0, 600);
    ombra.addColorStop(0, 'rgba(3,6,18,0.55)');
    ombra.addColorStop(0.6, 'rgba(3,6,18,0.12)');
    ombra.addColorStop(1, 'rgba(3,6,18,0)');
    ctx.fillStyle = ombra;
    ctx.fillRect(0, 230, W, 370);
    // flash delle fotocamere
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flash) {
      const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(f.x - f.r * 3, f.y - f.r * 3, f.r * 6, f.r * 6);
    }
    ctx.restore();
  }

  disegnaCartelloni(ctx, t) {
    const y = 556, h = 50;
    // nastro LED dell'anello superiore
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 216, W, 18);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 216, W, 18);
    ctx.clip();
    ctx.font = '700 13px Montserrat, sans-serif';
    ctx.fillStyle = '#f5c84b';
    ctx.textBaseline = 'middle';
    const nastro = 'SADAS  •  HEAD SOCCER  •  ';
    const lw = ctx.measureText(nastro).width;
    for (let x = -((t * 70) % lw); x < W; x += lw) ctx.fillText(nastro, x, 226);
    ctx.restore();

    // cartelloni a bordo campo
    const pannelli = 4;
    const pw = W / pannelli;
    const ciclo = Math.floor(t / 5);
    for (let i = 0; i < pannelli; i++) {
      const x = i * pw;
      const fondo = ctx.createLinearGradient(0, y, 0, y + h);
      fondo.addColorStop(0, '#0b1220');
      fondo.addColorStop(1, '#020409');
      ctx.fillStyle = fondo;
      ctx.fillRect(x + 2, y, pw - 4, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2, y, pw - 4, h);
      ctx.clip();
      const tipo = (i + ciclo) % 3;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      if (tipo === 0) {
        ctx.font = '200 34px Montserrat, sans-serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '12px';
        ctx.shadowColor = 'rgba(245,200,75,0.8)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#f5c84b';
        ctx.fillText('SADAS', x + pw / 2 + 6, y + h / 2 + 1);
      } else if (tipo === 1) {
        ctx.font = '900 italic 26px Montserrat, sans-serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.shadowColor = 'rgba(96,165,250,0.8)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        const testo = 'HEAD SOCCER  ★  ';
        const tw = ctx.measureText(testo).width;
        for (let xx = x - ((t * 90) % tw); xx < x + pw; xx += tw) ctx.fillText(testo, xx, y + h / 2 + 1);
      } else {
        ctx.font = '800 22px Montserrat, sans-serif';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
        ctx.shadowColor = 'rgba(251,113,133,0.8)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = (Math.floor(t * 2) % 2) ? '#fb7185' : '#ffffff';
        ctx.fillText('FORZA RAGAZZI!', x + pw / 2, y + h / 2 + 1);
      }
      ctx.restore();
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    // griglia di LED e riflesso
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let yy = y + 2; yy < y + h; yy += 3) ctx.fillRect(0, yy, W, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, y, W, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y + h, W, 6);
  }

  // rete e palo di fondo: va disegnata prima dei giocatori
  disegnaPortaDietro(ctx, lato) {
    ctx.save();
    if (lato === 'destra') {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    const F = GOAL_DEPTH;            // palo frontale (bocca della porta)
    const P = { x: -10, y: -12 };    // spostamento del telaio lontano (prospettiva)
    const sagoma = () => {
      // profilo laterale della rete: traversa, montante posteriore curvo, base a terra
      ctx.beginPath();
      ctx.moveTo(F, BAR_Y);
      ctx.lineTo(26, BAR_Y);
      ctx.quadraticCurveTo(4, BAR_Y + 8, 6, BAR_Y + 60);
      ctx.quadraticCurveTo(8, GROUND - 60, 2, GROUND);
      ctx.lineTo(F, GROUND);
      ctx.closePath();
    };

    // telaio lontano, più scuro e sottile
    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.strokeStyle = 'rgba(148,163,184,0.75)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(F, GROUND);
    ctx.lineTo(F, BAR_Y);
    ctx.lineTo(26, BAR_Y);
    ctx.quadraticCurveTo(4, BAR_Y + 8, 6, BAR_Y + 60);
    ctx.quadraticCurveTo(8, GROUND - 60, 2, GROUND);
    ctx.stroke();
    ctx.restore();

    // fondo della rete in ombra
    sagoma();
    const ombra = ctx.createLinearGradient(0, 0, F, 0);
    ombra.addColorStop(0, 'rgba(8,15,25,0.42)');
    ombra.addColorStop(1, 'rgba(8,15,25,0.12)');
    ctx.fillStyle = ombra;
    ctx.fill();

    // maglie della rete (rombi), leggermente cedevoli verso il basso
    ctx.save();
    sagoma();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const passo = 14;
    for (let d = -GOAL_H; d < F + GOAL_H; d += passo) {
      for (const verso of [1, -1]) {
        const xa = d, xb = d + verso * GOAL_H;
        ctx.moveTo(xa, BAR_Y);
        ctx.quadraticCurveTo((xa + xb) / 2 - 6, (BAR_Y + GROUND) / 2 + 10, xb, GROUND);
      }
    }
    ctx.stroke();
    // corde laterali tra telaio vicino e lontano
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    for (let y = BAR_Y + passo; y < GROUND; y += passo * 1.5) {
      ctx.moveTo(10, y);
      ctx.lineTo(F, y + 2);
    }
    ctx.stroke();
    ctx.restore();

    // base posteriore a terra e montante posteriore curvo (tubo bianco)
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(2, GROUND - 1);
    ctx.lineTo(F, GROUND - 1);
    ctx.stroke();
    const tubo = (lw, colore) => {
      ctx.strokeStyle = colore;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(26, BAR_Y);
      ctx.quadraticCurveTo(4, BAR_Y + 8, 6, BAR_Y + 60);
      ctx.quadraticCurveTo(8, GROUND - 60, 2, GROUND);
      ctx.stroke();
    };
    tubo(8, '#94a3b8');
    tubo(4, '#e2e8f0');
    ctx.restore();
  }

  // palo frontale e traversa: davanti a giocatori e pallone
  disegnaPortaDavanti(ctx, lato) {
    ctx.save();
    if (lato === 'destra') {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    const metallo = (x0, y0, x1, y1) => {
      const gr = ctx.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.5, '#e2e8f0');
      gr.addColorStop(1, '#94a3b8');
      return gr;
    };
    const F = GOAL_DEPTH;
    // ombra a terra
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(F / 2 + 4, GROUND + 4, F / 2 + 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // palo frontale: tubo tondo con riflesso
    ctx.fillStyle = metallo(F - 7, 0, F + 7, 0);
    pathRett(ctx, F - 7, BAR_Y - 2, 14, GROUND - BAR_Y + 2, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(F - 3.5, BAR_Y + 6, 2.5, GROUND - BAR_Y - 14);
    // traversa (collide con il pallone): dal palo fino al montante posteriore
    ctx.fillStyle = metallo(0, BAR_Y - BAR_R, 0, BAR_Y + BAR_R);
    pathRett(ctx, 18, BAR_Y - BAR_R, F - 18 + BAR_R, BAR_R * 2, BAR_R);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(24, BAR_Y - BAR_R + 3, F - 30, 2);
    // giunto arrotondato tra palo e traversa
    ctx.fillStyle = metallo(F - 9, BAR_Y - 9, F + 9, BAR_Y + 9);
    ctx.beginPath();
    ctx.arc(F, BAR_Y, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // corda frontale della rete lungo il palo
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = BAR_Y + 12; y < GROUND - 4; y += 14) {
      ctx.moveTo(F - 7, y);
      ctx.lineTo(F - 12, y + 7);
    }
    ctx.stroke();
    // piedino del palo
    ctx.fillStyle = '#64748b';
    pathRett(ctx, F - 10, GROUND - 4, 20, 6, 3);
    ctx.fill();
    ctx.restore();
  }
}
