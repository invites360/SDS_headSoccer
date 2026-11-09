'use strict';

const DT_FISICA = 1 / 240;
const GRAVITA_PALLONE = 1500;
const TEMPO_CARICA = 14;

const easeOutBack = (u) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
};

class Pallone {
  constructor() {
    this.topolino = null;
    this.incollatoA = null;
    this.mappamondo = false;
    this.reset();
  }
  get r() { return this.topolino ? 46 : 24; }
  reset() {
    this.x = W / 2;
    this.y = 90;
    this.vx = 0;
    this.vy = 0;
    this.rot = 0;
    this.fuoco = 0;
    this.fuga = 0;
    this.scia = [];
    this.inPancia = null;   // Pregnancy: portato nella pancia
    this.attiratoDa = null; // Pregnancy: sta volando verso la pancia
  }
}

// Proiettili di Veggy kick / Papà ginecologo / Damabook
const PROIETTILI = {
  pomodoro: { r: 13, colore: '#dc2626' },
  sacco: { r: 16, colore: '#92400e' },
  libro: { r: 15, colore: '#2563eb' },
  palla: { r: 12, colore: '#f8fafc' },
};

class Partita {
  // modo: 'cpu' (contro il computer), 'host' (online, simula la partita), 'ospite' (online, riceve lo stato)
  constructor({ canvas, stadio, umano, cpu, livello, personaggi, eventi, modo = 'cpu', nomi = null, controlloRemoto = null }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stadio = stadio;
    this.persUmano = umano;
    this.persCpu = cpu;
    this.livello = livello;
    this.personaggi = personaggi;
    this.eventi = eventi;
    this.modo = modo;
    this.nomi = nomi || { sinistra: 'TU', destra: 'CPU' };
    this.controlloRemoto = controlloRemoto;
    this.dopoAggiorna = null;
    this.registroParticelle = null;
    this.texPallone = creaTexturePallone(160);
    this.texTopolino = creaTextureTopolino(200);
    this.texMappamondo = creaTextureMappamondo(160);

    const hSoldi = GOAL_H * 0.5;
    this.traversaSx = {
      tipo: 'traversa', rimbalzo: 0.6, versoCampo: 1,
      spinta: (x, y, r) => spintaCerchioCapsula(x, y, r, 0, BAR_Y, GOAL_DEPTH, BAR_Y, BAR_R),
    };
    this.traversaDx = {
      tipo: 'traversa', rimbalzo: 0.6, versoCampo: -1,
      spinta: (x, y, r) => spintaCerchioCapsula(x, y, r, W - GOAL_DEPTH, BAR_Y, W, BAR_Y, BAR_R),
    };
    this.soldiSx = {
      tipo: 'banconote', rimbalzo: 0.3,
      spinta: (x, y, r) => spintaCerchioRett(x, y, r, 0, GROUND - hSoldi, GOAL_DEPTH - 4, hSoldi),
    };
    this.soldiDx = {
      tipo: 'banconote', rimbalzo: 0.3,
      spinta: (x, y, r) => spintaCerchioRett(x, y, r, W - GOAL_DEPTH + 4, GROUND - hSoldi, GOAL_DEPTH - 4, hSoldi),
    };

    this.ridimensiona = this.ridimensiona.bind(this);
    this.ciclo = this.ciclo.bind(this);
    window.addEventListener('resize', this.ridimensiona);
    this.ridimensiona();
    this.nuovaPartita();
    this.attiva = true;
    this.ultimo = performance.now();
    requestAnimationFrame(this.ciclo);
  }

  nuovaPartita() {
    this.t = 0;
    this.giocatori = [];
    this.controlli = new Map();
    this.umano = new Giocatore(this, this.persUmano, 'sinistra');
    this.cpu = new Giocatore(this, this.persCpu, 'destra');
    this.aggiungi(this.umano, this.modo === 'ospite' ? new ControlloFermo() : new ControlloUmano());
    if (this.modo === 'host') this.aggiungi(this.cpu, this.controlloRemoto);
    else if (this.modo === 'ospite') this.aggiungi(this.cpu, new ControlloFermo());
    else this.aggiungi(this.cpu, new IA(this, this.cpu, this.livello));
    // chi guarda questo schermo (decide chi vede la patina di "Prima donna" e le scritte "TU")
    this.locale = this.modo === 'ospite' ? this.cpu : this.umano;
    this.palloni = [new Pallone()]; // il primo è il pallone "vero", gli altri arrivano da Impazzisco
    this.proiettili = [];
    this.campoColore = null;
    this.congelato = null;
    this.glitch = 0;
    this.punteggio = { sinistra: 0, destra: 0 };
    this.tempo = DURATA_PARTITA;
    this.stato = 'via';
    this.timerStato = 3.2;
    this.timerFine = 0;
    this.effetti = [];
    this.banconote = { sinistra: false, destra: false };
    this.bandiere = [];
    this.particelle = [];
    this.msgGol = null;
    this.msgPotere = null;
    this.msgVia = 0;
    this.scossa = 0;
    this.inPausa = false;
    this.tempoGioco = 0;
    this.palloneFermo = 0;
    this.posFerma = { x: 0, y: 0 };
    Tasti.consuma();
    Suoni.bip(660);
  }

  get pallone() { return this.palloni[0]; }

  distruggi() {
    this.attiva = false;
    window.removeEventListener('resize', this.ridimensiona);
    Suoni.zittisciFolla();
  }

  ridimensiona() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const s = Math.min(cw / W, ch / H);
    this.scalaPx = s * dpr;
    this.offX = ((cw - W * s) / 2) * dpr;
    this.offY = ((ch - H * s) / 2) * dpr;
    this.stadio.prepara(this.scalaPx);
  }

  pausa() {
    if (this.inPausa || this.stato === 'fine') return;
    // online la partita non si ferma: si apre solo il pannello per abbandonare
    if (this.modo !== 'cpu') { this.eventi.pausa(); return; }
    this.inPausa = true;
    this.eventi.pausa();
  }

  riprendi() {
    this.inPausa = false;
    this.ultimo = performance.now();
  }

  // ---------- giocatori ----------

  aggiungi(g, controllo) {
    this.giocatori.push(g);
    this.controlli.set(g, controllo);
  }

  evoca(pers, owner, x, ruolo) {
    const a = new Giocatore(this, pers, owner.squadra, { aiutante: true });
    a.reset(x);
    a.y = GROUND - 380;
    a.aTerra = false;
    this.aggiungi(a, new IA(this, a, 'normale', ruolo));
    this.nuvola(x, GROUND - 330);
    Suoni.puff();
    return a;
  }

  congeda(a) {
    this.giocatori = this.giocatori.filter((g) => g !== a);
    this.controlli.delete(a);
    this.nuvola(a.x, a.y - 80);
    Suoni.puff();
  }

  avversarioDi(g) {
    return g.squadra === 'sinistra' ? this.cpu : this.umano;
  }

  // Veggy kick e simili: lancia un oggetto verso la porta avversaria
  lancia(g) {
    if (!g.lancio || g.lancio.cd > 0 || g.bloccato || g.sommerso) return;
    g.lancio.cd = 0.45;
    const s = g.scala;
    this.proiettili.push({
      tipo: g.lancio.tipo, squadra: g.squadra, x: g.x + g.dir * 34 * s, y: g.y - (g.alzo + 100) * s,
      vx: g.dir * 980 + g.vx * 0.3, vy: -360, rot: 0, vr: g.dir * 9, vita: 3,
    });
    Suoni.lancio();
  }

  aggiornaProiettili(h) {
    for (const p of this.proiettili) {
      p.vy += 900 * h;
      p.x += p.vx * h;
      p.y += p.vy * h;
      p.rot += p.vr * h;
      p.vita -= h;
      const r = (PROIETTILI[p.tipo] || PROIETTILI.palla).r;
      if (p.y + r >= GROUND || p.x < -40 || p.x > W + 40) {
        p.vita = 0;
        this.splat(p, p.x, Math.min(p.y, GROUND - 4));
        continue;
      }
      for (const g of this.giocatori) {
        if (g.squadra === p.squadra || g.invisibile || g.sommerso) continue;
        if (!g.collisori.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < c.r + r)) continue;
        // colpito: torna indietro verso la propria porta
        const verso = Math.sign(p.vx) || -g.dir;
        g.spinta = verso * 1150;
        if (g.aTerra && !g.immobile) { g.vy = -420; g.aTerra = false; }
        g.stordito = Math.max(g.stordito, 0.35);
        p.vita = 0;
        this.splat(p, p.x, p.y);
        this.scossa = 0.15;
        break;
      }
    }
    this.proiettili = this.proiettili.filter((p) => p.vita > 0);
  }

  splat(p, x, y) {
    Suoni.splat();
    const colori = { pomodoro: ['#dc2626', '#ef4444', '#16a34a'], sacco: ['#f5c84b', '#86b37a', '#92400e'], libro: ['#f8fafc', '#e5e7eb', '#2563eb'] }[p.tipo] || ['#f8fafc'];
    for (let i = 0; i < 14; i++) {
      this.particella(p.tipo === 'sacco' ? 'banconota' : 'splat', x, y, { vx: rand(-260, 260), vy: rand(-380, -60), vita: rand(0.4, 0.8), r: rand(3, 6), colore: pick(colori), vr: rand(-8, 8) });
    }
  }

  trovaPersonaggio(id) {
    if (!id) return null;
    const k = chiaveId(id);
    return this.personaggi.find((p) => p.chiave === k) || null;
  }

  ostacoli() {
    const o = [this.traversaSx, this.traversaDx];
    if (this.banconote.sinistra) o.push(this.soldiSx);
    if (this.banconote.destra) o.push(this.soldiDx);
    for (const e of this.effetti) if (e.ostacoli) o.push(...e.ostacoli);
    return o;
  }

  attivaPotere(g) {
    const e = creaEffetto(this, g);
    g.potere.attivo = e;
    g.potere.carica = 0;
    this.effetti.push(e);
    e.avvia();
    // con Forza Juve il fumetto mostra anche il potere rubato
    const nome = e.def === g.potere.def ? e.def.nome : `${g.potere.def.nome}: ${e.def.nome}`;
    this.msgPotere = { t: 0, nome: g.pers.nome, potere: nome, squadra: g.squadra };
    Suoni.potere();
    this.stadio.esulta(g.squadra, 0.7);
    for (let i = 0; i < 40; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(200, 600);
      this.particella('scintilla', g.x, g.y - 90, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vita: rand(0.4, 0.9) });
    }
  }

  piantaBandiera(owner, stordimento, effetto) {
    const f = { x: clamp(owner.x - owner.dir * 8, 30, W - 30), squadra: owner.squadra, stordimento, effetto, t: 0 };
    this.bandiere.push(f);
    Suoni.bip(520);
    return f;
  }

  rimuoviBandiera(f) {
    this.bandiere = this.bandiere.filter((b) => b !== f);
  }

  spruzzo(x) {
    Suoni.splash();
    for (let i = 0; i < 26; i++) {
      this.particella('goccia', x + rand(-26, 26), GROUND - 4, { vx: rand(-260, 260), vy: rand(-620, -220), vita: rand(0.4, 0.8), r: rand(2.5, 5) });
    }
  }

  pioggiaBanconote(squadra) {
    const x0 = squadra === 'sinistra' ? 0 : W - GOAL_DEPTH;
    for (let i = 0; i < 40; i++) {
      this.particella('banconota', x0 + rand(0, GOAL_DEPTH), BAR_Y - rand(0, 200), {
        vx: rand(-40, 40), vy: rand(0, 120), vita: rand(1, 1.8), vr: rand(-6, 6),
      });
    }
  }

  // ---------- ciclo ----------

  ciclo(ora) {
    if (!this.attiva) return;
    const dt = Math.min(0.05, (ora - this.ultimo) / 1000);
    this.ultimo = ora;
    if (Tasti.premuto('KeyM')) Suoni.alternaMuto();
    if (this.stato === 'fine') {
      if (this.timerFine <= 0) {
        if (Tasti.premuto('Enter')) this.eventi.rivincita();
        else if (Tasti.premuto('KeyC')) this.eventi.esci();
      }
    } else if (Tasti.premuto('KeyP')) {
      if (this.inPausa) this.eventi.riprendi();
      else this.pausa();
    }
    if (!this.attiva) return;
    if (this.modo === 'ospite') this.aggiornaOspite(dt);
    else if (!this.inPausa) this.aggiorna(dt);
    if (this.dopoAggiorna) this.dopoAggiorna(dt);
    if (!this.attiva) return;
    this.disegna();
    Tasti.consuma();
    requestAnimationFrame(this.ciclo);
  }

  aggiorna(dt) {
    this.t += dt;
    this.stadio.aggiorna(dt);
    if (this.scossa > 0) this.scossa = Math.max(0, this.scossa - dt);
    if (this.msgVia > 0) this.msgVia -= dt;
    if (this.msgGol) this.msgGol.t += dt;
    if (this.msgPotere) this.msgPotere.t += dt;

    if (this.stato === 'via') {
      const prima = Math.ceil(this.timerStato);
      this.timerStato -= dt;
      const dopo = Math.ceil(this.timerStato);
      if (dopo !== prima && dopo > 0) Suoni.bip(660);
      if (this.timerStato <= 0) {
        this.stato = 'gioco';
        this.msgVia = 0.9;
        Suoni.fischio(1);
      }
    } else if (this.stato === 'gioco') {
      if (!this.congelato) this.tempo -= dt; // SadasBI ferma anche il cronometro
      this.tempoGioco += dt;
      if (this.tempo <= 0) {
        this.tempo = 0;
        this.fischioFinale();
      }
    } else if (this.stato === 'gol') {
      this.timerStato -= dt;
      if (this.timerStato <= 0) this.calcioDInizio();
    } else if (this.stato === 'fine' && this.timerFine > 0) {
      this.timerFine -= dt;
      if (this.timerFine <= 0) this.eventi.fine(this.punteggio);
    }

    this.leggiIntenti(dt);

    if (this.glitch > 0) this.glitch = Math.max(0, this.glitch - dt);
    if (this.stato === 'gioco') {
      for (const g of this.giocatori) {
        if (g.potere && !g.potere.attivo && !g.congelato) g.potere.carica = Math.min(1, g.potere.carica + dt / TEMPO_CARICA);
      }
      // con SadasBI attivo si fermano anche gli effetti della squadra bloccata
      for (const e of [...this.effetti]) {
        if (this.congelato && e.owner.squadra !== this.congelato && !(e instanceof EffettoCongela)) continue;
        e.aggiorna(dt);
      }
      this.pulisciEffetti();
      const b = this.pallone;
      if (b.x < 420 && b.vx < -350) this.stadio.esulta('destra', 0.55);
      if (b.x > W - 420 && b.vx > 350) this.stadio.esulta('sinistra', 0.55);
      // sicurezza: una palla immobile per troppo tempo viene rimessa in gioco con un rimbalzo
      const trattenuta = b.incollatoA || b.inPancia || b.attiratoDa || this.congelato;
      if (!trattenuta && Math.hypot(b.x - this.posFerma.x, b.y - this.posFerma.y) < 2) {
        this.palloneFermo += dt;
        if (this.palloneFermo > 3) {
          b.vy = -950;
          b.vx = Math.sign(W / 2 - b.x) * 320;
          this.palloneFermo = 0;
          Suoni.rimbalzo(900);
        }
      } else {
        this.palloneFermo = 0;
        this.posFerma = { x: b.x, y: b.y };
      }
    }

    const n = Math.ceil(dt / DT_FISICA);
    const h = dt / n;
    for (let k = 0; k < n; k++) this.passo(h);

    for (const b of this.palloni) {
      if (b.fuoco > 0) b.fuoco -= dt;
      b.scia.push({ x: b.x, y: b.y });
      if (b.scia.length > 10) b.scia.shift();
      if (b.fuoco > 0) {
        this.particella('fuoco', b.x + rand(-8, 8), b.y + rand(-8, 8), { vx: rand(-40, 40), vy: rand(-120, -40), vita: rand(0.2, 0.45) });
      }
    }
    this.aggiornaParticelle(dt);
  }

  pulisciEffetti() {
    for (const e of this.effetti) {
      if (e.finito && e.owner.potere && e.owner.potere.attivo === e) e.owner.potere.attivo = null;
    }
    this.effetti = this.effetti.filter((e) => !e.finito);
  }

  leggiIntenti(dt) {
    const grezzi = new Map();
    for (const g of this.giocatori) {
      const c = this.controlli.get(g);
      grezzi.set(g, this.stato === 'fine' || !c ? INTENTO_VUOTO : c.pensa(dt));
    }
    for (const g of [...this.giocatori]) {
      let i = grezzi.get(g);
      if (g.replicaDi && grezzi.has(g.replicaDi)) {
        // l'avversario rifà le stesse mosse, rivolto verso l'altra porta
        const s = grezzi.get(g.replicaDi);
        i = { ...s, muovi: -s.muovi, dashX: -(s.dashX || 0), potere: false, bandiera: false, lancia: false };
      }
      if (g.confuso) i = { ...i, muovi: -i.muovi, salta: i.giu, giu: i.salta, dashX: -(i.dashX || 0) };
      if (g.singhiozzo) i = filtraSinghiozzo(g.singhiozzo, i);
      if (g.soloSaltoCalcio) i = { ...i, muovi: 0, dashX: 0, dashY: 0, lancia: false };
      if (g.congelato || g.invisibile) i = INTENTO_VUOTO;
      if (this.stato === 'gioco') {
        if (i.potere && g.potereProno) this.attivaPotere(g);
        if (i.bandiera && g.effettoBandiera) g.effettoBandiera.pianta();
        if (i.lancia && g.lancio) this.lancia(g);
      }
      g.applicaIntento(i);
    }
  }

  passo(h) {
    this.aggiornaBraccati();
    for (const g of this.giocatori) {
      if (!g.congelato) g.aggiorna(h);
    }
    this.separaGiocatori();
    if (this.stato !== 'via') this.aggiornaProiettili(h);
    const b = this.pallone;
    if (this.stato === 'via') {
      b.x = W / 2;
      b.y = 90;
      b.vx = 0;
      b.vy = 0;
    } else {
      for (const p of this.palloni) this.muoviPallone(h, p);
      if (this.palloni.length > 1) this.urtiPalloni();
    }
    if (this.stato === 'gioco') {
      this.controllaCalci();
      this.controllaBandiere(h);
      this.controllaGol();
    }
  }

  // chi ha addosso un aiutante "braccatore" avversario quasi non riesce a muoversi
  aggiornaBraccati() {
    const braccatori = this.giocatori.filter((g) => g.braccatore);
    for (const g of this.giocatori) {
      g.braccato = !g.braccatore && !g.sommerso && !g.invisibile && braccatori.some((b) =>
        b.squadra !== g.squadra && Math.abs(b.x - g.x) < 100 * Math.max(b.scala, g.scala) && Math.abs(b.y - g.y) < 120);
    }
  }

  // urti tra palloni quando ce n'è più di uno
  urtiPalloni() {
    const ps = this.palloni;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const R = a.r + b.r;
        if (d >= R || d === 0) continue;
        const nx = dx / d, ny = dy / d;
        const ov = (R - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov;
        b.x += nx * ov; b.y += ny * ov;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const imp = (-(1 + 0.8) * vn) / 2;
          a.vx -= imp * nx; a.vy -= imp * ny;
          b.vx += imp * nx; b.vy += imp * ny;
        }
      }
    }
  }

  separaGiocatori() {
    const gs = this.giocatori;
    for (let i = 0; i < gs.length; i++) {
      for (let j = i + 1; j < gs.length; j++) {
        const a = gs[i], b = gs[j];
        if (a.squadra === b.squadra) continue;
        for (const ca of a.collisori) {
          for (const cb of b.collisori) {
            const dx = cb.x - ca.x, dy = cb.y - ca.y;
            const d = Math.hypot(dx, dy);
            const R = ca.r + cb.r;
            if (d >= R || d === 0) continue;
            const ov = R - d;
            const ny = dy / d;
            if (ny > 0.6) {
              a.y -= ov;
              if (a.vy > 0) a.vy = 0;
              a.aTerra = true;
            } else if (ny < -0.6) {
              b.y -= ov;
              if (b.vy > 0) b.vy = 0;
              b.aTerra = true;
            } else {
              const nx = dx / d;
              a.x -= (nx * ov) / 2;
              b.x += (nx * ov) / 2;
            }
          }
        }
      }
    }
    for (const g of gs) {
      const m = 34 * g.scala * g.largo;
      g.x = clamp(g.x, m, W - m);
    }
  }

  // punto della pancia dove viene tenuto il pallone (Pregnancy)
  puntoPancia(g) {
    const s = g.scala;
    return { x: g.x + g.versoDisegno * 12 * s * g.largo, y: g.y - (g.alzo + 62) * s };
  }

  muoviPallone(h, b) {
    const r = b.r;
    if (b.attiratoDa) {
      // risucchiato verso la pancia
      // volo a velocità costante: così raggiunge la pancia anche se chi la chiama sta correndo
      const q = this.puntoPancia(b.attiratoDa);
      const dx = q.x - b.x, dy = q.y - b.y;
      const d = Math.hypot(dx, dy);
      const passo = 1700 * h;
      b.rot += 20 * h;
      if (d <= passo + 6) {
        b.x = q.x;
        b.y = q.y;
        b.inPancia = b.attiratoDa;
        b.attiratoDa = null;
        return;
      }
      b.vx = (dx / d) * 1700;
      b.vy = (dy / d) * 1700;
      b.x += (dx / d) * passo;
      b.y += (dy / d) * passo;
      return;
    }
    if (b.inPancia) {
      const g = b.inPancia;
      const q = this.puntoPancia(g);
      b.x = clamp(q.x, r, W - r);
      b.y = Math.min(q.y, GROUND - r);
      b.vx = g.vx;
      b.vy = g.vy;
      b.rot += (g.vx * h) / r;
      return;
    }
    if (b.incollatoA) {
      const g = b.incollatoA;
      b.x = clamp(g.x - g.dir * (g.scala * 44 + r), r, W - r);
      b.y = GROUND - r;
      b.vx = g.vx;
      b.vy = 0;
      b.rot += (b.vx * h) / r;
      return;
    }

    if (b.dolce > 0) b.dolce -= h; // appena comparso sulla traversa: rotola piano invece di schizzare via
    if (this.congelato) {
      // SadasBI: niente gravità, la palla si sposta solo di quanto viene toccata
      const freno = Math.exp(-2.6 * h);
      b.vx *= freno;
      b.vy *= freno;
    } else {
      b.vy += GRAVITA_PALLONE * (b.mappamondo ? 1.3 : 1) * h; // il mappamondo è più pesante
      const aria = Math.exp(-0.12 * h);
      b.vx *= aria;
      b.vy *= aria;
    }
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.rot += (b.vx * h) / r;

    const contatti = [];
    for (const o of this.ostacoli()) {
      const s = o.spinta(b.x, b.y, r);
      if (!s) continue;
      b.x += s.x;
      b.y += s.y;
      const vn = b.vx * s.nx + b.vy * s.ny;
      if (vn < 0) {
        b.vx -= (1 + o.rimbalzo) * vn * s.nx;
        b.vy -= (1 + o.rimbalzo) * vn * s.ny;
        if (o.tipo === 'traversa' && vn < -150) {
          Suoni.traversa();
          this.stadio.esulta(null, 0.45);
        }
        if (o.tipo === 'traversa' && s.ny < -0.7 && !(b.dolce > 0)) b.vx += o.versoCampo * 140;
      }
      // in cima alla traversa la palla rotola verso il campo
      if (o.tipo === 'traversa' && s.ny < -0.7) b.vx += o.versoCampo * 600 * h;
      contatti.push({ nx: s.nx, ny: s.ny, tipo: o.tipo });
    }

    if (b.fuga > 0) b.fuga -= h;
    for (const g of this.giocatori) {
      const pvx = g.vx + g.spinta;
      const pvy = g.vy;
      for (const c of g.collisori) {
        const dx = b.x - c.x, dy = b.y - c.y;
        const d = Math.hypot(dx, dy);
        const R = r + c.r;
        if (d === 0 || d >= R + 3) continue;
        const nx = dx / d, ny = dy / d;
        if (d >= R) {
          // appena sfiorata: conta solo per capire se la palla è stretta tra due corpi
          contatti.push({ nx, ny, tipo: 'giocatore', g, sfiorato: true });
          continue;
        }
        if (b.fuga > 0 && ny > -0.3) {
          // la palla risale tra i due corpi rimbalzando dall'uno all'altro, i giocatori cedono
          const lato = Math.sign(dx) || 1;
          const ov = R - d;
          g.x -= lato * ov * 0.7;
          b.x += lato * ov * 0.3;
          b.vx = lato * 240;
          b.vy = Math.min(b.vy, -650);
          continue;
        }
        b.x += nx * (R - d);
        b.y += ny * (R - d);
        const vn = (b.vx - pvx) * nx + (b.vy - pvy) * ny;
        if (vn < 0) {
          const e = (c.parte === 'testa' ? 0.62 : 0.45) * (b.mappamondo ? 0.6 : 1);
          b.vx -= (1 + e) * vn * nx;
          b.vy -= (1 + e) * vn * ny;
          if (vn < -260) {
            if (c.parte === 'testa') Suoni.testa(); else Suoni.rimbalzo(-vn);
          }
          if (vn < -120) g.tocco();
        }
        contatti.push({ nx, ny, tipo: 'giocatore', g });
        if (b.topolino && g.squadra !== b.topolino.squadra && g.scalaRid !== 0.5) {
          g.scalaRid = 0.5;
          Suoni.restringi();
          this.nuvola(g.x, g.y - 80);
        }
      }
    }

    // limiti del campo per ultimi: la palla non può uscire, al massimo viene schiacciata
    if (b.y - r < 0) {
      b.y = r;
      b.vy = Math.abs(b.vy) * 0.7;
    }
    if (b.y + r > GROUND) {
      b.y = GROUND - r;
      if (b.vy > 0) {
        if (b.vy > 160) Suoni.rimbalzo(b.vy);
        b.vy = -b.vy * (b.mappamondo ? 0.42 : 0.7);
        if (b.vy > -50) b.vy = 0;
      }
      b.vx *= Math.exp(-1.6 * h);
      contatti.push({ nx: 0, ny: -1, tipo: 'terra' });
    }
    const inPorta = b.y > BAR_Y;
    if (b.x - r < 0) {
      b.x = r;
      if (b.vx < 0) b.vx = -b.vx * (inPorta ? 0.25 : 0.75);
      contatti.push({ nx: 1, ny: 0, tipo: 'muro' });
    }
    if (b.x + r > W) {
      b.x = W - r;
      if (b.vx > 0) b.vx = -b.vx * (inPorta ? 0.25 : 0.75);
      contatti.push({ nx: -1, ny: 0, tipo: 'muro' });
    }
    if (inPorta && (b.x < GOAL_DEPTH || b.x > W - GOAL_DEPTH)) b.vx *= Math.exp(-2.5 * h);

    this.schiacciamento(contatti, b);

    const v = Math.hypot(b.vx, b.vy);
    const vmax = b.fuoco > 0 ? 2600 : 1900;
    if (v > vmax) {
      b.vx *= vmax / v;
      b.vy *= vmax / v;
    }
  }

  // Palla stretta tra un giocatore e il terreno, un muro o un altro giocatore: schizza verso l'alto.
  schiacciamento(contatti, b) {
    for (const a of contatti) {
      if (a.tipo !== 'giocatore') continue;
      for (const c of contatti) {
        if (c === a || c.g === a.g) continue;
        if (a.nx * c.nx + a.ny * c.ny > -0.45) continue;
        const spinta = rand(820, 1000);
        b.vy = Math.min(b.vy, -spinta);
        if (c.tipo === 'terra') {
          const lato = Math.sign(b.x - a.g.x) || (Math.random() < 0.5 ? -1 : 1);
          b.vx = lato * 260;
          a.g.vy = Math.min(a.g.vy, -380);
          a.g.y -= 3;
          a.g.aTerra = false;
        } else if (c.tipo === 'giocatore') {
          // rimbalza avanti e indietro tra i due corpi mentre sale
          const verso = Math.abs(b.vx) > 30 ? -Math.sign(b.vx) : (Math.random() < 0.5 ? -1 : 1);
          b.vx = verso * 220;
          b.y -= 4;
          b.fuga = 0.3;
        } else {
          b.vx = c.nx * 280;
        }
        this.cediGiocatore(a.g, b);
        Suoni.rimbalzo(900);
        return;
      }
    }
  }

  // il giocatore che schiaccia la palla viene spostato quel tanto che basta a liberarla
  cediGiocatore(g, b) {
    for (const c of g.collisori) {
      const dx = c.x - b.x, dy = c.y - b.y;
      const d = Math.hypot(dx, dy);
      const R = b.r + c.r;
      if (d === 0 || d >= R) continue;
      g.x += (dx / d) * (R - d);
      g.y = Math.min(GROUND, g.y + (dy / d) * (R - d));
    }
  }

  controllaCalci() {
    for (const g of this.giocatori) {
      const k = g.calcio;
      if (!k || k.t < CALCIO.inizioColpo || k.t > CALCIO.fineColpo) continue;
      for (const b of this.palloni) {
        if (k.palla) break;
        this.calciaPallone(g, k, b);
      }
      if (g.muscoli && !k.avversario) this.calciaAvversari(g, k);
    }
  }

  calciaPallone(g, k, b) {
    const s = g.scala;
    const dir = g.dir;
    if (b.attiratoDa) return;
    if (b.inPancia) {
      // Pregnancy: il calcio "sputa" il pallone dalla pancia
      if (b.inPancia !== g) return;
      b.inPancia = null;
      b.x = clamp(g.x + dir * (40 * s * g.largo + b.r), b.r, W - b.r);
      b.y = Math.min(b.y, GROUND - b.r - 1);
      k.palla = true;
      b.vx = dir * (k.tipo === 'alto' ? 900 : 1300) * g.tiroMult;
      b.vy = k.tipo === 'alto' ? -1080 : -200;
      Suoni.calcio(1);
      return;
    }
    const piedi = g.y - g.alzo * s;
    const lx = (b.x - g.x) * dir;
    const alt = piedi - b.y;
    const extra = (g.largo - 1) * 26 * s; // Gigantutone arriva più lontano
    const portata = (k.tipo === 'alto' ? 100 : 108) * s + b.r + extra;
    const altMax = (k.tipo === 'alto' ? 150 : 100) * s + b.r * 0.5;
    if (b.incollatoA || lx <= -12 * s - extra || lx >= portata || alt <= -b.r || alt >= altMax) return;

    k.palla = true;
    const vicino = lx < 32 * s + b.r + 4 + extra;
    const m = (g.muscoli ? 1.5 : 1) * g.tiroMult * (b.mappamondo ? 0.72 : 1);
    let vx, vy;
    if (vicino) {
      // tocco sotto: la palla si alza appena
      vx = dir * (k.tipo === 'alto' ? 300 : 380);
      vy = k.tipo === 'alto' ? -820 : -640;
    } else if (k.tipo === 'alto') {
      vx = dir * 900 * m;
      vy = -1080 * Math.sqrt(m);
    } else {
      vx = dir * 1300 * m;
      vy = -150 - Math.random() * 80;
    }
    if (g.supertiro && !vicino) {
      vx *= 1.7;
      vy *= 1.1;
      b.fuoco = 1.6;
      g.supertiro.termina();
      this.scossa = 0.25;
    }
    b.vx = vx;
    b.vy = vy;
    b.y = Math.min(b.y, GROUND - b.r - 1);
    Suoni.calcio(vicino ? 0.6 : m);
    g.tocco(0.05);
    for (let i = 0; i < 6; i++) {
      this.particella('polvere', b.x, b.y + b.r * 0.5, { vx: rand(-120, 120), vy: rand(-160, -40), vita: rand(0.25, 0.5) });
    }
  }

  // con Muscoli / Furia Cieca il calcio scaraventa in aria l'avversario
  calciaAvversari(g, k) {
    const s = g.scala;
    const dir = g.dir;
    for (const o of this.giocatori) {
      if (o.squadra === g.squadra || o.sommerso || o.invisibile) continue;
      const ox = (o.x - g.x) * dir;
      if (ox > 0 && ox < 125 * s && Math.abs(o.y - g.y) < 90) {
        k.avversario = true;
        o.vy = -1150;
        o.y -= 2;
        o.aTerra = false;
        o.spinta = dir * 520;
        o.stordito = Math.max(o.stordito, 0.9);
        o.giravolta = 0.9;
        Suoni.pugno();
        this.scossa = 0.3;
        for (let i = 0; i < 12; i++) {
          this.particella('scintilla', o.x, o.y - 70, { vx: rand(-300, 300), vy: rand(-300, 100), vita: 0.4 });
        }
      }
    }
  }

  controllaBandiere(h) {
    for (const f of [...this.bandiere]) {
      f.t += h;
      if (f.t < 0.4) continue;
      for (const g of this.giocatori) {
        if (g.squadra === f.squadra || g.sommerso || g.invisibile) continue;
        if (Math.abs(g.x - f.x) < 26 * g.scala + 10 && g.y > GROUND - 70) {
          this.esplodiBandiera(f, g);
          break;
        }
      }
    }
  }

  esplodiBandiera(f, g) {
    this.rimuoviBandiera(f);
    g.stordito = f.stordimento;
    g.vy = -650;
    g.aTerra = false;
    g.spinta = segno(g.x - f.x) * 260;
    Suoni.esplosione();
    this.scossa = 0.5;
    for (let i = 0; i < 45; i++) {
      const a = rand(Math.PI, Math.PI * 2);
      const v = rand(150, 650);
      this.particella(i % 3 ? 'fuoco' : 'fumo', f.x, GROUND - 30, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vita: rand(0.4, 1) });
    }
    f.effetto.esplosa();
  }

  controllaGol() {
    for (const b of this.palloni) {
      if (b.y <= BAR_Y + 4) continue;
      if (b.x + b.r < GOAL_DEPTH) { this.gol('destra'); return; }
      if (b.x - b.r > W - GOAL_DEPTH) { this.gol('sinistra'); return; }
    }
  }

  gol(squadra) {
    this.punteggio[squadra]++;
    this.stato = 'gol';
    this.timerStato = 2.8;
    this.msgGol = { t: 0, squadra };
    this.msgPotere = null;
    this.stadio.esulta(squadra, 1);
    Suoni.gol();
    this.effetti.forEach((e) => e.suGol());
    this.pulisciEffetti();
    this.pallone.incollatoA = null;
    this.pallone.inPancia = null;
    this.pallone.attiratoDa = null;
    const x = squadra === 'sinistra' ? W - GOAL_DEPTH / 2 : GOAL_DEPTH / 2;
    const colori = ['#f5c84b', '#ffffff', COLORI_SQUADRA[squadra].maglia, COLORI_SQUADRA[squadra].chiaro];
    for (let i = 0; i < 120; i++) {
      this.particella('coriandolo', x + rand(-60, 60), BAR_Y - rand(0, 120), {
        vx: rand(-500, 500), vy: rand(-900, -200), vita: rand(1.4, 2.6), colore: pick(colori), vr: rand(-12, 12),
      });
    }
  }

  calcioDInizio() {
    this.stato = 'gioco';
    this.palloni = [this.pallone];
    this.pallone.reset();
    this.proiettili = [];
    this.umano.reset(400);
    this.cpu.reset(W - 400);
    for (const g of this.giocatori) {
      if (!g.aiutante) continue;
      const base = g.squadra === 'sinistra' ? 230 : W - 230;
      g.reset(base + rand(-60, 60));
    }
    Suoni.fischio(1);
  }

  fischioFinale() {
    this.stato = 'fine';
    this.timerFine = 1.6;
    Suoni.fischio(3);
    this.effetti.forEach((e) => e.termina());
    this.pulisciEffetti();
    const { sinistra, destra } = this.punteggio;
    if (sinistra !== destra) this.stadio.esulta(sinistra > destra ? 'sinistra' : 'destra', 1);
  }

  // traiettoria della palla ignorando i giocatori (usata dalla CPU)
  prevedi(b = this.pallone) {
    if (b.previsione && b.previsioneT === this.t) return b.previsione;
    const r = b.r;
    let { x, y, vx, vy } = b;
    const passo = 1 / 60;
    const out = [];
    for (let k = 1; k <= 72; k++) {
      vy += GRAVITA_PALLONE * passo;
      x += vx * passo;
      y += vy * passo;
      if (y + r > GROUND) { y = GROUND - r; vy = -vy * 0.7; vx *= 0.98; }
      if (y - r < 0) { y = r; vy = Math.abs(vy) * 0.7; }
      if (x - r < 0) { x = r; vx = Math.abs(vx) * 0.75; }
      if (x + r > W) { x = W - r; vx = -Math.abs(vx) * 0.75; }
      out.push({ x, y, t: k * passo });
    }
    b.previsione = out;
    b.previsioneT = this.t;
    return out;
  }

  // ---------- particelle ----------

  particella(tipo, x, y, o = {}) {
    if (this.particelle.length > 700) return;
    // online: l'host annota le particelle nuove per farle comparire anche sullo schermo dell'ospite
    if (this.registroParticelle && this.registroParticelle.length < 300) {
      const q = (v) => Math.round(v || 0);
      this.registroParticelle.push([tipo, q(x), q(y), q(o.vx), q(o.vy), +(o.vita || 0.6).toFixed(2), +(o.r || 0).toFixed(1), o.colore || 0, +(o.vr || 0).toFixed(1)]);
    }
    this.particelle.push({
      tipo, x, y,
      vx: o.vx || 0,
      vy: o.vy || 0,
      vita: o.vita || 0.6,
      durata: o.vita || 0.6,
      colore: o.colore || null,
      rot: rand(0, Math.PI * 2),
      vr: o.vr || 0,
      r: o.r || rand(3, 7),
    });
  }

  nuvola(x, y) {
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(60, 220);
      this.particella('nuvola', x + Math.cos(a) * 20, y + Math.sin(a) * 30, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vita: rand(0.4, 0.8), r: rand(14, 26) });
    }
  }

  aggiornaParticelle(dt) {
    const gravita = {
      polvere: 500, scintilla: 400, coriandolo: 380, fuoco: -150, fumo: -120, banconota: 220, nuvola: -40,
      piscio: 900, goccia: 1400, ghiaccio: 60, bolla: -120, nota: -20, scarpa: 260, microbo: -30, miele: 500,
      risata: -10, splat: 1100,
    };
    for (const p of this.particelle) {
      p.vita -= dt;
      p.vy += (gravita[p.tipo] || 0) * dt;
      if (p.tipo === 'coriandolo' || p.tipo === 'banconota') {
        p.vx *= Math.exp(-1.8 * dt);
        p.vy = Math.min(p.vy, p.tipo === 'banconota' ? 200 : 260);
      }
      if (p.tipo === 'nuvola' || p.tipo === 'fumo') {
        p.vx *= Math.exp(-3 * dt);
        p.vy *= Math.exp(-2 * dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particelle = this.particelle.filter((p) => p.vita > 0);
  }

  disegnaParticelle(ctx) {
    for (const p of this.particelle) {
      const u = clamp(p.vita / p.durata, 0, 1);
      ctx.save();
      switch (p.tipo) {
        case 'polvere':
          ctx.globalAlpha = u * 0.6;
          ctx.fillStyle = '#d9f99d';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1.5 - u * 0.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'scintilla':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = u;
          ctx.fillStyle = '#ffd75a';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2 + u * 3, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'fuoco': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = u;
          const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.4);
          gr.addColorStop(0, '#fff3b0');
          gr.addColorStop(0.4, '#ff8a00');
          gr.addColorStop(1, 'rgba(200,30,0,0)');
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2.4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'fumo':
        case 'nuvola':
          ctx.globalAlpha = u * (p.tipo === 'fumo' ? 0.5 : 0.85);
          ctx.fillStyle = p.tipo === 'fumo' ? '#4b5563' : '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1.6 - u * 0.6), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'coriandolo':
          ctx.globalAlpha = Math.min(1, u * 2);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.colore;
          ctx.fillRect(-4, -2.5 * Math.abs(Math.cos(p.rot * 2)) - 0.5, 8, 5 * Math.abs(Math.cos(p.rot * 2)) + 1);
          break;
        case 'nota':
        case 'risata':
          ctx.globalAlpha = Math.min(1, u * 2);
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.rot) * 0.3);
          ctx.font = p.tipo === 'nota' ? '30px "Segoe UI Symbol", sans-serif' : '30px Bangers, Impact, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#111';
          ctx.fillStyle = p.colore || '#fde047';
          {
            const s = p.tipo === 'nota' ? (p.rot % 2 > 1 ? '♪' : '♫') : 'AH';
            ctx.strokeText(s, 0, 0);
            ctx.fillText(s, 0, 0);
          }
          break;
        case 'scarpa':
          ctx.globalAlpha = Math.min(1, u * 3);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.colore || '#ec4899';
          pathRett(ctx, -14, -6, 28, 10, 4);
          ctx.fill();
          ctx.fillRect(-14, -16, 9, 12); // tacco alto
          ctx.fillStyle = '#f5c84b';
          ctx.fillRect(-2, -4, 10, 2);
          break;
        case 'microbo':
          ctx.globalAlpha = u * 0.9;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = '#4ade80';
          ctx.strokeStyle = '#166534';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            ctx.moveTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
            ctx.lineTo(Math.cos(a) * p.r * 1.6, Math.sin(a) * p.r * 1.6);
          }
          ctx.stroke();
          break;
        case 'miele':
        case 'splat':
          ctx.globalAlpha = Math.min(1, u * 3) * 0.95;
          ctx.fillStyle = p.tipo === 'miele' ? '#f59e0b' : p.colore || '#dc2626';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r, p.r * 1.25, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'piscio':
        case 'goccia':
          ctx.globalAlpha = Math.min(1, u * 3) * 0.9;
          ctx.fillStyle = p.tipo === 'piscio' ? '#facc15' : p.colore || '#7dd3fc';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r, p.r * 1.3, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'bolla':
          ctx.globalAlpha = u * 0.8;
          ctx.strokeStyle = '#bae6fd';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'ghiaccio':
          ctx.globalAlpha = u;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.strokeStyle = '#e0f7ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) {
            const a = (k * Math.PI) / 3;
            ctx.moveTo(Math.cos(a) * p.r * 1.4, Math.sin(a) * p.r * 1.4);
            ctx.lineTo(-Math.cos(a) * p.r * 1.4, -Math.sin(a) * p.r * 1.4);
          }
          ctx.stroke();
          break;
        case 'banconota':
          ctx.globalAlpha = Math.min(1, u * 2);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = '#86b37a';
          ctx.fillRect(-11, -5, 22, 10);
          ctx.strokeStyle = '#3f6b35';
          ctx.lineWidth = 1;
          ctx.strokeRect(-9, -3.5, 18, 7);
          ctx.fillStyle = '#3f6b35';
          ctx.beginPath();
          ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
      ctx.restore();
    }
  }

  // ---------- disegno ----------

  disegna() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04060d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.scalaPx;
    let ox = this.offX, oy = this.offY;
    if (this.scossa > 0 && !this.inPausa) {
      ox += rand(-1, 1) * this.scossa * 16 * k;
      oy += rand(-1, 1) * this.scossa * 16 * k;
    }
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    const t = this.t;
    this.stadio.disegnaSfondo(ctx);
    if (this.campoColore) this.disegnaCampoColorato(ctx);
    this.stadio.disegnaTifosi(ctx, t);
    this.stadio.disegnaCartelloni(ctx, t);
    this.stadio.disegnaPortaDietro(ctx, 'sinistra');
    this.stadio.disegnaPortaDietro(ctx, 'destra');
    this.disegnaBanconote(ctx);

    for (const g of this.giocatori) g.disegnaOmbra(ctx);
    for (const b of this.palloni) this.disegnaOmbraPallone(ctx, b);
    this.disegnaBandiere(ctx);
    for (const e of this.effetti) e.disegnaSotto(ctx, t);

    const ordine = [...this.giocatori.filter((g) => g.aiutante), this.cpu, this.umano].filter(Boolean);
    for (const g of ordine) g.disegnaAura(ctx, t);
    for (const g of ordine) g.disegna(ctx, t);

    for (const b of this.palloni) this.disegnaPallone(ctx, b);
    this.disegnaProiettili(ctx);
    for (const e of this.effetti) e.disegnaSopra(ctx, t);
    this.stadio.disegnaPortaDavanti(ctx, 'sinistra');
    this.stadio.disegnaPortaDavanti(ctx, 'destra');
    this.disegnaParticelle(ctx);
    for (const e of this.effetti) e.disegnaSchermo(ctx, t);

    this.disegnaTabellone(ctx);
    this.disegnaSuggerimenti(ctx);
    this.disegnaMessaggi(ctx);

    if (this.inPausa) {
      ctx.fillStyle = 'rgba(2,6,23,0.55)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // Dr Slide: il terreno di gioco diventa arancione
  disegnaCampoColorato(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = this.campoColore;
    ctx.fillRect(0, 600, W, H - 600);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillRect(0, 600, W, H - 600);
    ctx.restore();
  }

  disegnaProiettili(ctx) {
    for (const p of this.proiettili) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.tipo === 'pomodoro') {
        const gr = ctx.createRadialGradient(-4, -4, 2, 0, 0, 14);
        gr.addColorStop(0, '#fca5a5');
        gr.addColorStop(1, '#b91c1c');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#16a34a';
        for (let k = 0; k < 5; k++) {
          ctx.rotate((Math.PI * 2) / 5);
          ctx.beginPath();
          ctx.ellipse(0, -10, 2.2, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.tipo === 'sacco') {
        ctx.fillStyle = '#92400e';
        ctx.beginPath();
        ctx.moveTo(-14, 14);
        ctx.quadraticCurveTo(-18, -6, -6, -10);
        ctx.lineTo(6, -10);
        ctx.quadraticCurveTo(18, -6, 14, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-7, -15, 14, 6);
        ctx.fillStyle = '#f5c84b';
        ctx.font = '900 16px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('€', 0, 3);
      } else if (p.tipo === 'libro') {
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(-16, -11, 32, 22);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-14, -9, 28, 3);
        ctx.fillRect(12, -11, 4, 22);
        ctx.fillStyle = '#f5c84b';
        ctx.fillRect(-10, -2, 16, 2.5);
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  disegnaOmbraPallone(ctx, b) {
    const k = clamp(1 - (GROUND - b.y) / 500, 0.2, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.3 * k})`;
    ctx.beginPath();
    ctx.ellipse(b.x, GROUND + 3, b.r * 1.1 * k, 6 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  disegnaPallone(ctx, b) {
    const r = b.r;
    const veloce = Math.hypot(b.vx, b.vy) > 1000 || b.fuoco > 0;
    if (veloce && this.stato !== 'via') {
      b.scia.forEach((p, i) => {
        const u = i / b.scia.length;
        ctx.globalAlpha = u * 0.3;
        ctx.fillStyle = b.fuoco > 0 ? '#ff7a00' : '#ffd8a8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * (0.4 + u * 0.55), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.fuoco > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2);
      gl.addColorStop(0, 'rgba(255,160,40,0.8)');
      gl.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.rotate(b.rot);
    ctx.drawImage(b.topolino ? this.texTopolino : b.mappamondo ? this.texMappamondo : this.texPallone, -r, -r, r * 2, r * 2);
    ctx.restore();
    const luce = ctx.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.04, 0, 0, r);
    luce.addColorStop(0, 'rgba(255,255,255,0.6)');
    luce.addColorStop(0.28, 'rgba(255,255,255,0.08)');
    luce.addColorStop(0.7, 'rgba(0,0,0,0)');
    luce.addColorStop(1, 'rgba(40,10,0,0.42)');
    ctx.fillStyle = luce;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(90,30,0,0.6)';
    ctx.stroke();
    ctx.restore();
  }

  disegnaBanconote(ctx) {
    const img = Risorse.img['money.png'];
    const hSoldi = GOAL_H * 0.5;
    ['sinistra', 'destra'].forEach((lato) => {
      if (!this.banconote[lato]) return;
      const x = lato === 'sinistra' ? 0 : W - GOAL_DEPTH + 4;
      const w = GOAL_DEPTH - 4;
      if (img) {
        const h1 = (img.height / img.width) * w;
        for (let y = GROUND - h1 * 0.95; y > GROUND - hSoldi - h1 * 0.5; y -= h1 * 0.55) {
          ctx.drawImage(img, x - 6, y, w + 12, h1);
        }
      } else {
        ctx.fillStyle = '#86b37a';
        ctx.fillRect(x, GROUND - hSoldi, w, hSoldi);
      }
    });
  }

  disegnaBandiere(ctx) {
    for (const f of this.bandiere) {
      const s = clamp(f.t / 0.25, 0, 1);
      const altezza = 74 * s;
      const top = GROUND - altezza;
      ctx.save();
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(f.x, GROUND + 2);
      ctx.lineTo(f.x, top);
      ctx.stroke();
      if (s >= 1) {
        const lw = 46, lh = 30;
        ctx.beginPath();
        ctx.moveTo(f.x, top);
        for (let i = 0; i <= 8; i++) {
          ctx.lineTo(f.x + (lw * i) / 8, top + Math.sin(this.t * 6 + i * 0.7) * 2.5 * (i / 8));
        }
        for (let i = 8; i >= 0; i--) {
          ctx.lineTo(f.x + (lw * i) / 8, top + lh + Math.sin(this.t * 6 + i * 0.7) * 2.5 * (i / 8));
        }
        ctx.closePath();
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        const cx = f.x + lw / 2, cy = top + lh / 2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
        ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
        ctx.stroke();
        // spia lampeggiante: la bandierina è innescata
        if (Math.floor(this.t * 4) % 2) {
          ctx.fillStyle = '#ff3b3b';
          ctx.shadowColor = '#ff3b3b';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(f.x, top - 4, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  disegnaTabellone(ctx) {
    const cx = W / 2, y0 = 10, w = 800, h = 94;
    ctx.save();
    const fondo = ctx.createLinearGradient(0, y0, 0, y0 + h);
    fondo.addColorStop(0, 'rgba(15,23,42,0.94)');
    fondo.addColorStop(1, 'rgba(2,6,23,0.94)');
    ctx.fillStyle = fondo;
    pathRett(ctx, cx - w / 2, y0, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    pathRett(ctx, cx - w / 2, y0, w, h, 18);
    ctx.clip();
    ctx.fillStyle = COLORI_SQUADRA.sinistra.maglia;
    ctx.fillRect(cx - w / 2, y0, 7, h);
    ctx.fillStyle = COLORI_SQUADRA.destra.maglia;
    ctx.fillRect(cx + w / 2 - 7, y0, 7, h);
    ctx.restore();

    const etichetta = (g) => (g === this.locale ? 'TU' : this.nomi[g.squadra] || 'AVVERSARIO');
    this.disegnaLatoTabellone(ctx, this.umano, cx - w / 2 + 58, y0, 1, etichetta(this.umano));
    this.disegnaLatoTabellone(ctx, this.cpu, cx + w / 2 - 58, y0, -1, etichetta(this.cpu));

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [['sinistra', cx - 118], ['destra', cx + 118]].forEach(([lato, x]) => {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      pathRett(ctx, x - 40, y0 + 12, 80, 70, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 56px Montserrat, sans-serif';
      if (this.glitch > 0) {
        // Massimo Scalo: tabellone hackerato
        const cifra = Math.random() < this.glitch * 0.5 ? String(randi(0, 9)) : String(this.punteggio[lato]);
        ctx.fillStyle = '#ff2bd6';
        ctx.fillText(cifra, x + rand(-6, 6), y0 + 50 + rand(-3, 3));
        ctx.fillStyle = '#22d3ee';
        ctx.fillText(cifra, x + rand(-6, 6), y0 + 50 + rand(-3, 3));
        ctx.fillStyle = '#4ade80';
        ctx.fillText(cifra, x, y0 + 50);
        return;
      }
      ctx.fillText(String(this.punteggio[lato]), x, y0 + 50);
    });

    const sec = Math.ceil(this.tempo);
    const allarme = sec <= 10 && this.stato === 'gioco';
    ctx.fillStyle = allarme && Math.floor(this.t * 4) % 2 ? '#fb7185' : '#f5c84b';
    ctx.font = '800 46px Montserrat, sans-serif';
    ctx.fillText(String(sec), cx, y0 + 44);
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.fillStyle = '#94a3b8';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.fillText('TEMPO', cx + 1.5, y0 + 80);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }

  disegnaLatoTabellone(ctx, g, ax, y0, verso, etichetta) {
    const ay = y0 + 47;
    const col = COLORI_SQUADRA[g.squadra];
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(ax, ay, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = col.maglia;
    ctx.stroke();
    ctx.drawImage(g.testa, ax - 40, ay - 40, 80, 80);
    ctx.restore();

    const tx = ax + verso * 52;
    const larg = 170;
    ctx.save();
    ctx.textAlign = verso > 0 ? 'left' : 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.fillStyle = col.chiaro;
    ctx.fillText(etichetta, tx, y0 + 24);
    ctx.font = '800 20px Montserrat, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tronca(ctx, partiNome(g.pers.id).cognome.toUpperCase(), larg), tx, y0 + 46);

    const bx = verso > 0 ? tx : tx - larg;
    if (g.potere) {
      ctx.font = '600 11px Montserrat, sans-serif';
      ctx.fillStyle = '#f5c84b';
      ctx.fillText(tronca(ctx, g.potere.def.nome, larg), tx, y0 + 63);
      const by = y0 + 70, bh = 12;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      pathRett(ctx, bx, by, larg, bh, 6);
      ctx.fill();
      const attivo = g.potere.attivo;
      // un potere "fino al prossimo gol" mostra la barra piena
      const frazione = attivo ? (Number.isFinite(attivo.durata) ? clamp(attivo.t / attivo.durata, 0, 1) : 1) : g.potere.carica;
      if (frazione > 0.01) {
        const gr = ctx.createLinearGradient(bx, 0, bx + larg, 0);
        if (attivo) {
          gr.addColorStop(0, col.scuro);
          gr.addColorStop(1, col.chiaro);
        } else {
          gr.addColorStop(0, '#b8860b');
          gr.addColorStop(1, '#ffe58a');
        }
        ctx.fillStyle = gr;
        const fw = larg * frazione;
        pathRett(ctx, verso > 0 ? bx : bx + larg - fw, by, fw, bh, 6);
        ctx.fill();
      }
      if (g.potereProno) {
        const pulsa = 0.5 + 0.5 * Math.sin(this.t * 8);
        ctx.shadowColor = '#ffd75a';
        ctx.shadowBlur = 8 + pulsa * 10;
        ctx.strokeStyle = '#fff3b0';
        ctx.lineWidth = 2;
        pathRett(ctx, bx, by, larg, bh, 6);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center';
        ctx.font = '900 10px Montserrat, sans-serif';
        ctx.fillStyle = '#1a1300';
        ctx.fillText(g === this.locale ? 'PREMI SPAZIO' : 'PRONTA', bx + larg / 2, by + 10);
      }
    } else {
      ctx.font = 'italic 500 11px Montserrat, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('nessuna mossa finale', tx, y0 + 68);
    }
    ctx.restore();
  }

  disegnaSuggerimenti(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const io = this.locale || this.umano;
    const inGioco = this.stato === 'gioco';
    if (io.bandiereDisponibili > 0 && inGioco) {
      const pulsa = 0.6 + 0.4 * Math.sin(this.t * 8);
      ctx.globalAlpha = pulsa;
      pillola(ctx, W / 2, 836, 'Premi F per piantare la bandierina!', '#dc2626');
      ctx.globalAlpha = 1;
    } else if (io.tritone && inGioco) {
      pillola(ctx, W / 2, 836, io.sommerso ? '↑ per riemergere saltando' : '↓ per immergerti sotto il campo', '#0e7490');
    } else if (io.lancio && inGioco) {
      pillola(ctx, W / 2, 836, 'Premi C per lanciare!', '#b45309');
    } else if (io.dash && inGioco) {
      pillola(ctx, W / 2, 836, io.dash.verticale ? 'Doppio tocco su ← → ↑ ↓ per lo scatto' : 'Doppio tocco su ← → per lo scatto', '#7c3aed');
    } else if (this.pallone.inPancia === io && inGioco) {
      pillola(ctx, W / 2, 836, 'Z o X per sputare il pallone', '#db2777');
    } else if (this.tempoGioco < 7 && this.stato !== 'fine') {
      ctx.globalAlpha = clamp(7 - this.tempoGioco, 0, 1);
      pillola(ctx, W / 2, 862, '← → muovi   ↑ salta   ↓ scendi   Z calcio alto   X rasoterra   SPAZIO mossa finale   P pausa', 'rgba(2,6,23,0.75)');
      ctx.globalAlpha = 1;
    }
    ctx.font = '600 12px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const extra = this.infoRete ? `${this.infoRete}  ·  ` : '';
    ctx.fillText(`${extra}P ${this.modo === 'cpu' ? 'pausa' : 'menu'}  ·  M audio ${Suoni.muto ? 'OFF' : 'ON'}`, W - 16, H - 14);
    ctx.restore();
  }

  // ---------- ospite online: lo stato arriva dall'host, qui si anima soltanto ----------

  aggiornaOspite(dt) {
    this.t += dt;
    this.stadio.aggiorna(dt);
    if (this.msgGol) this.msgGol.t += dt;
    if (this.msgPotere) this.msgPotere.t += dt;
    if (this.msgVia > 0) this.msgVia -= dt;
    if (this.glitch > 0) this.glitch = Math.max(0, this.glitch - dt);
    // tra un aggiornamento e l'altro i corpi proseguono con la loro velocità
    for (const g of this.giocatori) {
      if (g.invisibile || g.congelato) continue;
      g.x = clamp(g.x + (g.vx + (g.immobile ? 0 : g.spinta)) * dt, 0, W);
      if (!g.aTerra) {
        g.vy += FISICA.gravita * dt;
        g.y = Math.min(GROUND, g.y + g.vy * dt);
      }
      if (g.calcio) g.calcio.t = Math.min(CALCIO.durata, g.calcio.t + dt);
      if (g.aTerra && Math.abs(g.vx) > 25) g.fase += Math.abs(g.vx) * dt * 0.042;
      for (const s of g.scie) s.a -= dt * 3.5;
    }
    for (const b of this.palloni) {
      if (!b.inPancia && !b.attiratoDa && !b.incollatoA) {
        if (!this.congelato) b.vy += GRAVITA_PALLONE * dt;
        b.x = clamp(b.x + b.vx * dt, b.r, W - b.r);
        b.y = Math.min(GROUND - b.r, b.y + b.vy * dt);
      }
      b.rot += (b.vx * dt) / b.r;
      if (b.fuoco > 0) b.fuoco -= dt;
      b.scia.push({ x: b.x, y: b.y });
      if (b.scia.length > 10) b.scia.shift();
      if (b.fuoco > 0) this.particella('fuoco', b.x + rand(-8, 8), b.y + rand(-8, 8), { vx: rand(-40, 40), vy: rand(-120, -40), vita: rand(0.2, 0.45) });
    }
    for (const p of this.proiettili) {
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.aggiornaParticelle(dt);
    if (this.stato === 'fine' && this.timerFine > 0) {
      this.timerFine -= dt;
      if (this.timerFine <= 0) this.eventi.fine(this.punteggio);
    }
  }

  disegnaMessaggi(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.stato === 'via') {
      const n = Math.ceil(this.timerStato);
      const u = 1 - (this.timerStato - Math.floor(this.timerStato));
      if (n > 0 && n <= 3) testoGrande(ctx, String(n), W / 2, 330, 170, easeOutBack(clamp(u * 3, 0, 1)), 1);
    }
    if (this.msgVia > 0) {
      const u = 1 - this.msgVia / 0.9;
      testoGrande(ctx, 'VIA!', W / 2, 330, 170, easeOutBack(clamp(u * 4, 0, 1)), clamp(this.msgVia * 3, 0, 1));
    }
    if (this.msgGol) this.disegnaMsgGol(ctx);
    if (this.msgPotere) this.disegnaMsgPotere(ctx);
    if (this.stato === 'fine') {
      testoGrande(ctx, 'FINE!', W / 2, 360, 150, 1, clamp(this.timerFine * 2, 0, 1));
    }
    ctx.restore();
  }

  disegnaMsgGol(ctx) {
    const m = this.msgGol;
    const d = 2.7;
    if (m.t > d) { this.msgGol = null; return; }
    const alpha = m.t > d - 0.4 ? (d - m.t) / 0.4 : 1;
    const scala = easeOutBack(clamp(m.t / 0.35, 0, 1)) * (1 + Math.sin(m.t * 10) * 0.02);
    const col = COLORI_SQUADRA[m.squadra];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, 330);
    // raggi di luce
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(m.t * 0.6);
    for (let i = 0; i < 14; i++) {
      ctx.rotate((Math.PI * 2) / 14);
      const gr = ctx.createLinearGradient(0, 0, 520, 0);
      gr.addColorStop(0, `${col.chiaro}88`);
      gr.addColorStop(1, `${col.chiaro}00`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(520, -36);
      ctx.lineTo(520, 36);
      ctx.fill();
    }
    ctx.restore();
    ctx.scale(scala, scala);
    ctx.rotate(-0.04);
    ctx.font = 'italic 900 180px Montserrat, Impact, sans-serif';
    const oro = ctx.createLinearGradient(0, -80, 0, 80);
    oro.addColorStop(0, '#fff6c8');
    oro.addColorStop(0.5, '#f5c84b');
    oro.addColorStop(1, '#b8860b');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#0b1020';
    ctx.strokeText('GOOOL!', 0, 0);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText('GOOOL!', 0, 0);
    ctx.fillStyle = oro;
    ctx.fillText('GOOOL!', 0, 0);
    const chi = m.squadra === 'sinistra' ? this.umano : this.cpu;
    ctx.font = '800 34px Montserrat, sans-serif';
    pillola(ctx, 0, 118, chi.pers.nome.toUpperCase(), col.maglia, '800 34px Montserrat, sans-serif');
    ctx.restore();
  }

  // fumetto "<personaggio> usa <abilità>"
  disegnaMsgPotere(ctx) {
    const m = this.msgPotere;
    const d = 2.6;
    if (m.t > d) { this.msgPotere = null; return; }
    const alpha = m.t > d - 0.35 ? (d - m.t) / 0.35 : 1;
    const scala = easeOutBack(clamp(m.t / 0.22, 0, 1));
    const riga1 = `${m.nome} usa`;
    const riga2 = `${m.potere}!`;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, 330);
    ctx.rotate(-0.06);
    ctx.scale(scala, scala);

    let f2 = 104;
    ctx.font = `${f2}px Bangers, "Comic Sans MS", Impact, sans-serif`;
    let w2 = ctx.measureText(riga2).width;
    if (w2 > 1150) { f2 *= 1150 / w2; w2 = 1150; }
    ctx.font = `56px Bangers, "Comic Sans MS", Impact, sans-serif`;
    const w1 = Math.min(ctx.measureText(riga1).width, 1100);
    const rx = Math.max(w1, w2) / 2 + 110;
    const ry = 165;

    // esplosione stile fumetto
    ctx.beginPath();
    const punte = 26;
    for (let i = 0; i < punte * 2; i++) {
      const a = (i / (punte * 2)) * Math.PI * 2;
      const k = i % 2 ? 0.8 : 1 + ((i * 37) % 7) / 40;
      ctx.lineTo(Math.cos(a) * rx * k, Math.sin(a) * ry * k);
    }
    ctx.closePath();
    const gr = ctx.createRadialGradient(0, 0, 10, 0, 0, rx);
    gr.addColorStop(0, '#fffbe0');
    gr.addColorStop(0.45, '#ffd400');
    gr.addColorStop(1, '#ff6a00');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(200,40,0,0.18)';
    for (let y = -ry; y < ry; y += 14) {
      for (let x = -rx; x < rx; x += 14) {
        const dd = Math.hypot(x / rx, y / ry);
        ctx.beginPath();
        ctx.arc(x + ((y / 14) % 2 ? 7 : 0), y, 1 + dd * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.lineJoin = 'round';
    ctx.font = `56px Bangers, "Comic Sans MS", Impact, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#111';
    ctx.strokeText(riga1, 0, -58, 1100);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(riga1, 0, -58, 1100);
    ctx.font = `${f2}px Bangers, "Comic Sans MS", Impact, sans-serif`;
    ctx.fillStyle = '#b91c1c';
    ctx.fillText(riga2, 6, 34);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#111';
    ctx.strokeText(riga2, 0, 28);
    const g2 = ctx.createLinearGradient(0, -20, 0, 70);
    g2.addColorStop(0, '#ffffff');
    g2.addColorStop(0.5, '#fff176');
    g2.addColorStop(1, '#ffb300');
    ctx.fillStyle = g2;
    ctx.fillText(riga2, 0, 28);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }
}

function tronca(ctx, testo, max) {
  if (ctx.measureText(testo).width <= max) return testo;
  let t = testo;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

function pillola(ctx, x, y, testo, fondo, font = '700 15px Montserrat, sans-serif') {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const dim = parseInt(font.match(/(\d+)px/)[1], 10);
  const w = ctx.measureText(testo).width + dim * 1.6;
  const h = dim * 2;
  ctx.fillStyle = fondo;
  pathRett(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(testo, x, y + 1);
  ctx.restore();
}

function testoGrande(ctx, testo, x, y, dim, scala, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scala, scala);
  ctx.font = `italic 900 ${dim}px Montserrat, Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#0b1020';
  ctx.strokeText(testo, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(testo, 0, 0);
  ctx.restore();
}
