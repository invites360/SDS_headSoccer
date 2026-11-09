'use strict';

function caricaImmagine(src) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

const Risorse = {
  img: {},
  teste: {},

  // nomi file delle grafiche in assets/ (es. "moto.png")
  async precarica(nomiFile) {
    await Promise.all(nomiFile.map(async (f) => {
      if (!(f in this.img)) this.img[f] = await caricaImmagine(`assets/${f}`);
    }));
  },

  async caricaTeste(personaggi) {
    await Promise.all(personaggi.map(async (p) => {
      const img = p.testa ? await caricaImmagine(p.testa) : null;
      this.teste[p.id] = img || testaSegnaposto(p.id);
    }));
  },

  testa(id) {
    if (!this.teste[id]) this.teste[id] = testaSegnaposto(id);
    return this.teste[id];
  },

  srcTesta(id) {
    const t = this.testa(id);
    return t instanceof HTMLImageElement ? t.src : t.toDataURL();
  },
};

// Testa disegnata con le iniziali, per chi non ha una foto utilizzabile.
function testaSegnaposto(id) {
  const n = 320;
  const c = creaCanvas(n, n);
  const g = c.getContext('2d');
  const h = hashStringa(id) % 360;
  const grad = g.createRadialGradient(n * 0.38, n * 0.32, n * 0.05, n / 2, n / 2, n * 0.48);
  grad.addColorStop(0, `hsl(${h}, 55%, 62%)`);
  grad.addColorStop(1, `hsl(${h}, 60%, 30%)`);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(n / 2, n / 2, n * 0.46, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.stroke();
  const p = partiNome(id);
  const iniziali = ((p.nome[0] || '') + (p.cognome[0] || '')).toUpperCase();
  g.fillStyle = '#fff';
  g.font = '900 120px Montserrat, "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 10;
  g.fillText(iniziali, n / 2, n / 2 + 6);
  return c;
}

// Parte rotante del pallone (arancione moderno con scritta SADAS dorata).
function creaTexturePallone(lato) {
  const c = creaCanvas(lato, lato);
  const g = c.getContext('2d');
  const r = lato / 2;
  g.translate(r, r);
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.clip();

  const base = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  base.addColorStop(0, '#ffb057');
  base.addColorStop(0.55, '#ff7a0f');
  base.addColorStop(1, '#c2410c');
  g.fillStyle = base;
  g.fillRect(-r, -r, lato, lato);

  // pannelli "swoosh" moderni con bordo dorato
  const swoosh = (verso) => {
    g.save();
    g.rotate(verso);
    g.beginPath();
    g.moveTo(-r * 1.05, -r * 0.2);
    g.bezierCurveTo(-r * 0.5, -r * 0.95, r * 0.55, -r * 0.95, r * 1.05, -r * 0.42);
    g.lineTo(r * 1.05, -r * 0.62);
    g.bezierCurveTo(r * 0.45, -r * 1.2, -r * 0.6, -r * 1.15, -r * 1.05, -r * 0.42);
    g.closePath();
    g.fillStyle = 'rgba(255, 244, 230, 0.22)';
    g.fill();
    g.beginPath();
    g.moveTo(-r * 1.05, -r * 0.2);
    g.bezierCurveTo(-r * 0.5, -r * 0.95, r * 0.55, -r * 0.95, r * 1.05, -r * 0.42);
    g.strokeStyle = 'rgba(245, 200, 75, 0.9)';
    g.lineWidth = lato * 0.012;
    g.stroke();
    g.restore();
  };
  swoosh(0);
  swoosh(Math.PI);

  // fascia centrale leggermente più scura per far risaltare la scritta
  g.fillStyle = 'rgba(124, 45, 18, 0.28)';
  g.fillRect(-r, -r * 0.2, lato, r * 0.4);

  // scritta SADAS: dorata, sottile, spaziata
  const oro = g.createLinearGradient(0, -r * 0.16, 0, r * 0.16);
  oro.addColorStop(0, '#fffbe6');
  oro.addColorStop(0.5, '#ffd75a');
  oro.addColorStop(1, '#d69e12');
  g.font = `400 ${Math.round(lato * 0.21)}px Montserrat, "Segoe UI", "Helvetica Neue", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(lato * 0.028)}px`;
  g.lineJoin = 'round';
  g.lineWidth = lato * 0.014;
  g.strokeStyle = 'rgba(90, 30, 0, 0.55)';
  g.strokeText('SADAS', lato * 0.012, lato * 0.008);
  g.fillStyle = oro;
  g.fillText('SADAS', lato * 0.012, lato * 0.008);
  return c;
}

// Testa di leopardo (Leopardi Calcio), disegnata una volta sola.
let cacheLeopardo = null;
function testaLeopardo() {
  if (cacheLeopardo) return cacheLeopardo;
  const n = 320;
  const c = creaCanvas(n, n);
  const g = c.getContext('2d');
  g.translate(n / 2, n / 2);
  const pelo = '#e8a93c';
  // orecchie
  for (const sx of [-1, 1]) {
    g.fillStyle = pelo;
    g.beginPath();
    g.arc(sx * 92, -92, 38, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3f2a10';
    g.beginPath();
    g.arc(sx * 92, -92, 20, 0, Math.PI * 2);
    g.fill();
  }
  const gr = g.createRadialGradient(-30, -40, 20, 0, 0, 150);
  gr.addColorStop(0, '#f6c35e');
  gr.addColorStop(1, '#c98a24');
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(0, 6, 128, 120, 0, 0, Math.PI * 2);
  g.fill();
  // macchie
  g.fillStyle = '#3f2a10';
  for (const [x, y, r] of [[-70, -60, 10], [-40, -86, 8], [30, -90, 9], [72, -56, 11], [-96, 0, 9], [96, 4, 10], [-84, 56, 8], [84, 60, 9], [-20, -60, 6], [52, -30, 6]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c98a24';
    g.beginPath();
    g.arc(x + 2, y + 1, r * 0.45, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3f2a10';
  }
  // muso
  g.fillStyle = '#fdf1d6';
  g.beginPath();
  g.ellipse(0, 52, 70, 52, 0, 0, Math.PI * 2);
  g.fill();
  // occhi
  for (const sx of [-1, 1]) {
    g.fillStyle = '#fef9c3';
    g.beginPath();
    g.ellipse(sx * 46, -12, 22, 16, sx * 0.15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#65a30d';
    g.beginPath();
    g.arc(sx * 46, -12, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#111';
    g.beginPath();
    g.ellipse(sx * 46, -12, 4, 11, 0, 0, Math.PI * 2);
    g.fill();
  }
  // naso e bocca
  g.fillStyle = '#7c2d12';
  g.beginPath();
  g.moveTo(-18, 22);
  g.lineTo(18, 22);
  g.lineTo(0, 42);
  g.closePath();
  g.fill();
  g.strokeStyle = '#3f2a10';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, 42);
  g.lineTo(0, 58);
  g.moveTo(0, 58);
  g.quadraticCurveTo(-20, 74, -34, 62);
  g.moveTo(0, 58);
  g.quadraticCurveTo(20, 74, 34, 62);
  g.stroke();
  // baffi
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 2;
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(sx * 30, 48 + k * 8);
      g.lineTo(sx * 110, 36 + k * 16);
      g.stroke();
    }
  }
  cacheLeopardo = c;
  return c;
}

// Pallone "mappamondo" di Dentone Viaggiatore.
function creaTextureMappamondo(lato) {
  const c = creaCanvas(lato, lato);
  const g = c.getContext('2d');
  const r = lato / 2;
  g.translate(r, r);
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.clip();
  const mare = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  mare.addColorStop(0, '#60a5fa');
  mare.addColorStop(1, '#1e3a8a');
  g.fillStyle = mare;
  g.fillRect(-r, -r, lato, lato);
  // continenti stilizzati
  g.fillStyle = '#4d7c0f';
  const blob = (pts) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * r, y * r) : g.moveTo(x * r, y * r)));
    g.closePath();
    g.fill();
  };
  blob([[-0.75, -0.55], [-0.35, -0.7], [-0.15, -0.45], [-0.3, -0.2], [-0.45, 0.05], [-0.6, -0.1], [-0.8, -0.3]]);
  blob([[-0.4, 0.1], [-0.2, 0.15], [-0.15, 0.45], [-0.3, 0.8], [-0.45, 0.55]]);
  blob([[0.05, -0.65], [0.45, -0.7], [0.75, -0.45], [0.6, -0.15], [0.3, -0.25], [0.1, -0.35]]);
  blob([[0.05, -0.2], [0.3, -0.1], [0.32, 0.25], [0.15, 0.5], [0, 0.2]]);
  blob([[0.5, 0.35], [0.8, 0.3], [0.78, 0.55], [0.55, 0.6]]);
  g.fillStyle = '#f1f5f9';
  g.fillRect(-r, -r, lato, r * 0.14);
  g.fillRect(-r, r * 0.88, lato, r * 0.14);
  // meridiani e paralleli
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = lato * 0.008;
  for (let k = -2; k <= 2; k++) {
    g.beginPath();
    g.ellipse(0, 0, Math.abs(k) * r * 0.32 + 0.01, r, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(-r, k * r * 0.38);
    g.lineTo(r, k * r * 0.38);
    g.stroke();
  }
  return c;
}

// Pallone "Topolino" del potere Hackerino.
function creaTextureTopolino(lato) {
  const c = creaCanvas(lato, lato);
  const g = c.getContext('2d');
  const r = lato / 2;
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#222';
  g.fillRect(0, 0, lato, lato);
  const img = Risorse.img['hackerino.png'];
  if (img) {
    const s = Math.max(lato / img.width, lato / img.height) * 1.05;
    g.drawImage(img, r - (img.width * s) / 2, r - (img.height * s) / 2 + lato * 0.05, img.width * s, img.height * s);
  }
  g.lineWidth = lato * 0.05;
  g.strokeStyle = '#ff7a0f';
  g.beginPath();
  g.arc(r, r, r - lato * 0.025, 0, Math.PI * 2);
  g.stroke();
  return c;
}
