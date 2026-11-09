'use strict';

const LIVELLI_IA = {
  facile: { reazione: 0.28, errore: 70, salto: 0.45, aggressivita: 0.45, velocita: 0.72 },
  normale: { reazione: 0.15, errore: 32, salto: 0.75, aggressivita: 0.75, velocita: 0.9 },
  difficile: { reazione: 0.07, errore: 10, salto: 0.95, aggressivita: 1, velocita: 1 },
};

class ControlloUmano {
  pensa() {
    return {
      muovi: (Tasti.tenuto('ArrowRight') ? 1 : 0) - (Tasti.tenuto('ArrowLeft') ? 1 : 0),
      salta: Tasti.tenuto('ArrowUp'),
      giu: Tasti.tenuto('ArrowDown'),
      calcioAlto: Tasti.premuto('KeyZ'),
      calcioBasso: Tasti.premuto('KeyX'),
      potere: Tasti.premuto('Space'),
      bandiera: Tasti.premuto('KeyF'),
      lancia: Tasti.premuto('KeyC'),
      // doppio tocco: scatto (usato solo con K-POP e Japan)
      dashX: (Tasti.doppio('ArrowRight') ? 1 : 0) - (Tasti.doppio('ArrowLeft') ? 1 : 0),
      dashY: (Tasti.doppio('ArrowDown') ? 1 : 0) - (Tasti.doppio('ArrowUp') ? 1 : 0),
    };
  }
}

// giocatore mosso da altri (sullo schermo dell'ospite lo stato arriva dalla rete)
class ControlloFermo {
  pensa() { return INTENTO_VUOTO; }
}

class IA {
  constructor(partita, giocatore, livello = 'normale', ruolo = 'attacco') {
    this.partita = partita;
    this.g = giocatore;
    this.L = LIVELLI_IA[livello] || LIVELLI_IA.normale;
    this.ruolo = ruolo;
    this.timer = 0;
    this.bersaglioX = giocatore.x;
    this.saltaSopra = false;
    this.attesaPotere = rand(1.5, 4);
    this.attesaBandiera = rand(0.4, 1.5);
  }

  get portaMia() { return this.g.dir === 1 ? 0 : W; }
  get portaAvversaria() { return this.g.dir === 1 ? W : 0; }

  // con più palloni in campo (Impazzisco) segue quello più pericoloso per la propria porta
  scegliPalla() {
    const palloni = this.partita.palloni;
    if (palloni.length === 1) return palloni[0];
    let migliore = palloni[0], punti = Infinity;
    if (migliore.inPancia || migliore.attiratoDa) return migliore;
    for (const b of palloni) {
      const s = Math.abs(b.x - this.portaMia) + 0.6 * Math.abs(b.x - this.g.x);
      if (s < punti) { punti = s; migliore = b; }
    }
    return migliore;
  }

  decidi(b) {
    const g = this.g;
    const dir = g.dir;
    const vel = FISICA.velocita * g.velMult * g.lentezza;

    // primo punto della traiettoria in cui la palla sarà giocabile e raggiungibile
    const traiettoria = this.partita.prevedi(b);
    let punto = null;
    for (const q of traiettoria) {
      if (q.y < GROUND - 210) continue;
      if (Math.abs(q.x - g.x) / vel <= q.t + 0.12) { punto = q; break; }
    }
    if (!punto) punto = traiettoria[traiettoria.length - 1] || b;
    if (b.inPancia) punto = b; // la porta a spasso qualcuno: si insegue chi la ha
    // Prima donna: chi è accecato sbaglia molto di più
    const bx = punto.x + rand(-1, 1) * this.L.errore * (g.accecato ? 4 : 1);

    let bersaglio = bx - dir * (46 + b.r);
    const dietro = (b.x - g.x) * dir < -8;
    this.saltaSopra = false;
    if (dietro) {
      bersaglio = b.x - dir * (80 + b.r);
      // palla bassa alle spalle: la scavalca invece di spingerla verso la propria porta
      if (Math.abs(b.x - g.x) < 120 && b.y > GROUND - 90 && Math.abs(g.x - this.portaMia) > 160) this.saltaSopra = true;
    }

    if (this.ruolo === 'difesa') {
      const linea = this.portaMia + dir * 260;
      if ((b.x - linea) * dir > 320) bersaglio = linea;
    } else if (this.ruolo === 'centro') {
      if (Math.abs(b.x - g.x) > 250) bersaglio -= dir * 140;
    }

    // non entrare in porta se non serve
    const limite = this.portaMia + dir * 70;
    if ((bersaglio - limite) * dir < 0 && (b.x - limite) * dir > 0) bersaglio = limite;
    this.bersaglioX = clamp(bersaglio, 40, W - 40);
  }

  pensa(dt) {
    const i = { ...INTENTO_VUOTO };
    const g = this.g;
    const p = this.partita;
    if (p.stato !== 'gioco') {
      const dx = this.g.dir === 1 ? 400 : W - 400;
      if (!g.aiutante && Math.abs(dx - g.x) > 12) i.muovi = Math.sign(dx - g.x);
      return i;
    }
    if (this.ruolo === 'bracca') return this.bracca(i);
    const b = this.scegliPalla();
    const dir = g.dir;
    if (b.inPancia === g) {
      // Pregnancy: corre verso la porta avversaria e sputa il pallone da vicino
      i.muovi = Math.sign(this.portaAvversaria - g.x);
      if (Math.abs(this.portaAvversaria - g.x) < 330 && Math.random() < dt * 4) i.calcioBasso = true;
      return i;
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.L.reazione * rand(0.7, 1.3) * (g.accecato ? 2.2 : 1);
      this.decidi(b);
    }

    const dx = this.bersaglioX - g.x;
    if (Math.abs(dx) > 10 && Math.random() < this.L.velocita + 0.08) i.muovi = Math.sign(dx);

    const relX = (b.x - g.x) * dir;
    const sopra = g.y - b.y;
    const vicino = Math.abs(b.x - g.x);

    // colpo di testa
    if (g.aTerra && vicino < 75 && sopra > 150 && sopra < 340 && b.vy > -250 && Math.random() < this.L.salto * dt * 12) {
      i.salta = true;
    }
    // palla alta che sta per entrare nella mia porta
    if (g.aTerra && Math.abs(b.x - this.portaMia) < 260 && b.vx * dir < -200 && sopra > 150 && vicino < 160 && Math.random() < this.L.salto * dt * 10) {
      i.salta = true;
    }
    if (this.saltaSopra && g.aTerra) i.salta = true;

    // calci
    if (!g.calcio && relX > 18 && relX < 120 + b.r * 0.5 && sopra > -10 && sopra < 165 && Math.random() < this.L.aggressivita * dt * 14) {
      const avv = p.avversarioDi(g);
      const avvDavanti = avv && (avv.x - g.x) * dir > 0 && (avv.x - g.x) * dir < 280;
      const vicinoPorta = Math.abs(this.portaAvversaria - g.x) < 520;
      if (sopra > 80) i.calcioAlto = true;
      else if (avvDavanti && Math.random() < 0.65) i.calcioAlto = true;
      else if (vicinoPorta) {
        if (Math.random() < 0.7) i.calcioBasso = true; else i.calcioAlto = true;
      } else if (Math.random() < 0.5) i.calcioBasso = true;
      else i.calcioAlto = true;
    }

    if (!g.aTerra && g.vy > 0 && b.y > g.y - 60 && Math.random() < 0.25) i.giu = true;

    if (g.potereProno) {
      this.attesaPotere -= dt;
      if (this.attesaPotere <= 0) {
        i.potere = true;
        this.attesaPotere = rand(1.5, 5);
      }
    }
    if (g.bandiereDisponibili > 0) {
      this.attesaBandiera -= dt;
      if (this.attesaBandiera <= 0) {
        i.bandiera = true;
        this.attesaBandiera = rand(0.4, 1.5);
      }
    }
    if (g.tritone) {
      // nuota sotto il campo per gli spostamenti lunghi e riemerge sotto la palla
      if (g.sommerso) i.salta = vicino < 95 && sopra < 300;
      else if (g.aTerra && vicino > 350 && Math.random() < dt * 3) i.giu = true;
    }
    if (g.lancio && g.lancio.cd <= 0) {
      // lancia quando l'avversario è davanti, a distanza utile
      const avv = p.avversarioDi(g);
      const d = avv ? (avv.x - g.x) * dir : -1;
      if (d > 120 && d < 760 && !avv.invisibile && Math.random() < dt * 3 * this.L.aggressivita) i.lancia = true;
    }
    if (g.dash && vicino > 260 && Math.random() < dt * 1.5) {
      i.dashX = Math.sign(this.bersaglioX - g.x);
    }
    return i;
  }

  // aiutante di "Amministrazione power": sta addosso all'avversario, uno per lato
  bracca(i) {
    const g = this.g;
    const v = this.partita.avversarioDi(g);
    if (!v) return i;
    const lato = g.lato || -1;
    const bersaglio = clamp(v.x + lato * 62, 40, W - 40);
    const dx = bersaglio - g.x;
    if (Math.abs(dx) > 8) i.muovi = Math.sign(dx);
    // se l'avversario è in mezzo lo scavalca per andare dall'altro lato
    const inMezzo = Math.sign(v.x - g.x) === Math.sign(dx) && Math.abs(v.x - g.x) < Math.abs(dx);
    if (g.aTerra && inMezzo && Math.abs(v.x - g.x) < 150) i.salta = true;
    // lo segue quando salta
    if (g.aTerra && !v.aTerra && v.vy < 0 && Math.abs(v.x - g.x) < 140) i.salta = true;
    return i;
  }
}
