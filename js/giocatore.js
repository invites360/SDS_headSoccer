'use strict';

const FISICA = {
  velocita: 380,
  salto: 990,
  gravita: 2700,
  cadutaVeloce: 1700,
};

const CALCIO = {
  durata: 0.24,
  inizioColpo: 0.015,
  fineColpo: 0.17,
  angolo: { alto: 2.15, basso: 1.5 },
};

const INTENTO_VUOTO = Object.freeze({
  muovi: 0, salta: false, giu: false, calcioAlto: false, calcioBasso: false, potere: false, bandiera: false,
  lancia: false, dashX: 0, dashY: 0,
});

const R_TESTA = 44 * 1.2; // raggio della foto disegnata

class Giocatore {
  constructor(partita, pers, squadra, { aiutante = false } = {}) {
    this.partita = partita;
    this.pers = pers;
    this.squadra = squadra;
    this.dir = squadra === 'sinistra' ? 1 : -1;
    this.aiutante = aiutante;
    this.colori = COLORI_SQUADRA[squadra];
    this.animale = pers.animale || null;
    this.testa = pers.testaFile && Risorse.img[pers.testaFile] ? Risorse.img[pers.testaFile]
      : this.animale === 'leopardo' ? testaLeopardo() : Risorse.testa(pers.id);
    this.pelleBase = pers.pelle || '#e8b894';
    this.pelle = this.pelleBase;
    this.potere = !aiutante && pers.potereDef ? { def: pers.potereDef, carica: 0, attivo: null } : null;
    this.ultimoTocco = 0;
    this.scalaBase = 1;      // aiutanti "mini": 0.5
    this.scalaPotere = 1;    // Nano Malefico, Ue Cipollino, Gigantutino
    this.scalaRid = 1;       // rimpicciolito dal pallone di Hackerino
    this.largo = 1;          // Gigantutone: larghezza
    this.largoTarget = 1;
    this.reset(squadra === 'sinistra' ? 400 : W - 400);
    // modificatori impostati dai poteri
    this.velMult = 1;
    this.tiroMult = 1;
    this.veicolo = null;     // nome file (bici, moto) oppure 'carrello' / 'clown'
    this.joypad = null;
    this.muscoli = false;
    this.confuso = false;
    this.replicaDi = null;
    this.magnete = false;
    this.uniforme = null;
    this.supertiro = null;
    this.bandiereDisponibili = 0;
    this.effettoBandiera = null;
    this.lentezza = 1;       // Impassibile / Microbi: < 1 rallenta
    this.gelo = false;
    this.malato = false;
    this.saltoMult = 1;      // Captain Nexi
    this.costume = null;
    this.aspetto = null;     // 'muscoli' | 'furia'
    this.scettro = false;    // Amministrazione power
    this.braccatore = false; // aiutante che bracca l'avversario
    this.lato = 0;
    this.tritone = false;    // Re del pesce
    this.acc = {};           // accessori: corona, occhiali, chitarra, naso, cappelloNano...
    this.testaAltFile = null; // volto diverso (Ue Cipollino)
    this.immobile = 0;       // > 0: non può muoversi né calciare
    this.forma = null;       // 'zucca' | 'comodino' | 'miele' | 'schiacciato'
    this.invisibile = false; // Licenziamento: fuori dal campo
    this.senzaPiedi = false; // Mi piacciono i piedi
    this.soloSaltoCalcio = false; // Rock&Roll
    this.singhiozzo = null;  // Risata stordente
    this.stelline = false;
    this.accecato = false;   // Prima donna
    this.congelato = false;  // SadasBI
    this.bloccatoInPorta = false;
    this.dash = null;        // K-POP / Japan
    this.lancio = null;      // Veggy kick / Papà ginecologo / Damabook
    this.magliaFissa = null; // leopardi con la maglia blu
  }

  reset(x) {
    this.x = x;
    this.y = GROUND;
    this.vx = 0;
    this.vy = 0;
    this.spinta = 0;
    this.aTerra = true;
    this.calcio = null;
    this.calcioPrenotato = null;
    this.ricarica = 0;
    this.fase = 0;
    this.stordito = 0;
    this.giravolta = 0;
    this.scala = this.scala || 1;
    this.comando = INTENTO_VUOTO;
    this.scivola = 0;        // Piscio Selvaggio: secondi di scivolata
    this.pozzaX = x;
    this.sommerso = false;   // tritone sotto il campo
    this.braccato = false;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashVX = 0;
    this.scie = [];
  }

  get alzo() {
    if (!this.veicolo) return 0;
    return this.veicolo === 'carrello' ? 34 : 26;
  }

  get bloccato() {
    return this.stordito > 0 || this.scivola > 0 || this.immobile > 0 || this.invisibile || this.congelato;
  }

  // verso in cui è disegnato il corpo: chi bracca guarda l'avversario, gli altri la porta da attaccare
  get versoDisegno() {
    if (this.braccatore) {
      const v = this.partita.avversarioDi(this);
      if (v) return v.x >= this.x ? 1 : -1;
    }
    return this.dir;
  }

  get collisori() {
    if (this.sommerso || this.invisibile) return [];
    const s = this.scala;
    const x = this.x;
    const y = this.y - this.alzo * s;
    if (this.forma === 'schiacciato') {
      return [-1, 0, 1].map((k) => ({ x: x + k * 30 * s, y: y - 14 * s, r: 18 * s, parte: 'corpo' }));
    }
    const c = [];
    for (const [dy, r, parte] of [[118, 44, 'testa'], [58, 26, 'corpo'], [16, 18, 'piedi']]) {
      c.push({ x, y: y - dy * s, r: r * s, parte });
      // Gigantutone: altri cerchi ai lati per coprire la larghezza
      if (this.largo > 1.05) {
        const off = r * s * (this.largo - 1);
        c.push({ x: x - off, y: y - dy * s, r: r * s, parte }, { x: x + off, y: y - dy * s, r: r * s, parte });
      }
    }
    if (this.veicolo) c.push({ x, y: this.y - 22 * s, r: 24 * s, parte: 'veicolo' });
    return c;
  }

  tocco(quanto = 0.035) {
    const t = this.partita.t;
    if (!this.potere || this.potere.attivo || t - this.ultimoTocco < 0.3) return;
    this.ultimoTocco = t;
    this.potere.carica = Math.min(1, this.potere.carica + quanto);
  }

  get potereProno() {
    return this.potere && !this.potere.attivo && this.potere.carica >= 1;
  }

  // eventi "una tantum" dell'intento (calci, salto, potere); il movimento è letto a ogni passo di fisica
  applicaIntento(i) {
    this.comando = i;
    if (i.calcioAlto) this.avviaCalcio('alto');
    else if (i.calcioBasso) this.avviaCalcio('basso');
    if (i.dashX || i.dashY) this.avviaDash(i.dashX || 0, i.dashY || 0);
  }

  avviaCalcio(tipo) {
    if (this.bloccato || this.magnete || this.sommerso || this.senzaPiedi) return;
    if (!this.calcio && this.ricarica <= 0) {
      this.calcio = { tipo, t: 0, palla: false, avversario: false };
    } else {
      this.calcioPrenotato = { tipo, t: 0.15 };
    }
  }

  // scatto veloce (doppio tocco su una freccia)
  avviaDash(dx, dy) {
    if (!this.dash || this.dashCd > 0 || this.bloccato || this.sommerso) return;
    if (dy && !this.dash.verticale) dy = 0;
    if (!dx && !dy) return;
    this.dashT = 0.2;
    this.dashCd = 0.4;
    this.dashVX = dx * 1500;
    if (dy < 0) {
      this.vy = -1250;
      this.aTerra = false;
    } else if (dy > 0) {
      this.vy = 2000;
    }
    Suoni.scatto();
  }

  aggiorna(h) {
    const target = this.scalaBase * this.scalaPotere * this.scalaRid;
    this.scala += (target - this.scala) * Math.min(1, h * 6);
    this.largo += (this.largoTarget - this.largo) * Math.min(1, h * 6);
    if (this.calcio) {
      this.calcio.t += h;
      if (this.calcio.t >= CALCIO.durata) {
        this.calcio = null;
        this.ricarica = 0.05;
      }
    }
    if (this.ricarica > 0) this.ricarica -= h;
    if (this.calcioPrenotato) {
      this.calcioPrenotato.t -= h;
      if (this.calcioPrenotato.t <= 0) this.calcioPrenotato = null;
      else if (!this.calcio && this.ricarica <= 0) {
        this.calcio = { tipo: this.calcioPrenotato.tipo, t: 0, palla: false, avversario: false };
        this.calcioPrenotato = null;
      }
    }
    if (this.stordito > 0) this.stordito -= h;
    if (this.giravolta > 0) this.giravolta -= h;
    if (this.scivola > 0) this.scivola = Math.max(0, this.scivola - h);
    if (this.dashCd > 0) this.dashCd -= h;
    if (this.lancio && this.lancio.cd > 0) this.lancio.cd -= h;
    for (const s of this.scie) s.a -= h * 3.5;
    this.scie = this.scie.filter((s) => s.a > 0);

    const c = this.bloccato ? INTENTO_VUOTO : this.comando;
    let muovi = c.muovi;
    if (this.magnete && muovi === this.dir) muovi = 0; // con l'ansia si va solo verso la propria porta
    if (this.soloSaltoCalcio) muovi = 0;               // Rock&Roll: niente frecce laterali
    const freno = this.braccato ? 0.22 : 1;            // braccato dagli aiutanti avversari
    const vel = FISICA.velocita * this.velMult * this.lentezza * freno * (this.aiutante ? 0.9 : 1);

    if (this.tritone && !this.bloccato) {
      if (this.sommerso && c.salta) this.emergi();
      else if (!this.sommerso && this.aTerra && c.giu) this.immergi();
    }
    if (this.sommerso) {
      this.nuota(h, muovi, vel);
      return;
    }

    if (this.dashT > 0) {
      this.dashT -= h;
      if (this.dashVX) this.vx = this.dashVX;
      if (!this.scie.length || Math.hypot(this.x - this.scie[this.scie.length - 1].x, this.y - this.scie[this.scie.length - 1].y) > 28) {
        this.scie.push({ x: this.x, y: this.y, a: 1 });
      }
    } else if (this.scivola > 0) {
      // scivola sulla pozza verso la propria porta
      this.vx += (-this.dir * 560 - this.vx) * Math.min(1, h * 10);
    } else {
      this.vx += (muovi * vel - this.vx) * Math.min(1, h * 18);
    }
    if (this.immobile > 0) this.vx = 0;
    this.spinta *= Math.exp(-2.2 * h);
    if (Math.abs(this.spinta) < 5) this.spinta = 0;

    if (c.salta && this.aTerra) {
      this.vy = -FISICA.salto * this.saltoMult * (this.braccato ? 0.6 : 1) * (0.78 + 0.22 * this.scala);
      this.aTerra = false;
      if (!this.aiutante) Suoni.salto();
    }
    if (c.giu && !this.aTerra) this.vy = Math.max(this.vy, FISICA.cadutaVeloce);
    this.vy += FISICA.gravita * h;

    this.x += (this.vx + (this.immobile > 0 ? 0 : this.spinta)) * h;
    this.y += this.vy * h;
    this.aTerra = false;
    if (this.y >= GROUND) {
      this.y = GROUND;
      if (this.vy > 0) this.vy = 0;
      this.aTerra = true;
    }
    const mezzo = 34 * this.scala * this.largo;
    this.x = clamp(this.x, mezzo, W - mezzo);

    if (this.invisibile) return;
    for (const o of this.partita.ostacoli()) {
      for (const col of this.collisori) {
        const s = o.spinta(col.x, col.y, col.r);
        if (!s) continue;
        this.x += s.x;
        this.y += s.y;
        if (s.ny < -0.5 && this.vy > 0) {
          this.vy = 0;
          this.aTerra = true;
        } else if (s.ny > 0.5 && this.vy < 0) {
          this.vy = 0;
        }
      }
    }

    if (this.aTerra && Math.abs(this.vx) > 25) this.fase += Math.abs(this.vx) * h * 0.042;
    else if (this.veicolo && Math.abs(this.vx) > 25) this.fase += Math.abs(this.vx) * h * 0.042;
  }

  // ---------- tritone ----------

  immergi() {
    this.sommerso = true;
    this.calcio = null;
    this.calcioPrenotato = null;
    this.y = GROUND;
    this.vy = 0;
    this.partita.spruzzo(this.x);
  }

  emergi(salto = true) {
    this.sommerso = false;
    this.partita.spruzzo(this.x);
    if (salto) {
      this.y = GROUND - 1;
      this.vy = -FISICA.salto * 1.12;
      this.aTerra = false;
    }
  }

  // sotto il campo: niente collisioni, si nuota più veloci con le frecce
  nuota(h, muovi, vel) {
    this.vx += (muovi * vel * 1.25 - this.vx) * Math.min(1, h * 10);
    this.x = clamp(this.x + this.vx * h, 40, W - 40);
    this.y = GROUND;
    this.vy = 0;
    this.spinta = 0;
    this.aTerra = true;
    this.fase += Math.abs(this.vx) * h * 0.03 + h * 2;
    if (Math.random() < h * 12) {
      this.partita.particella('bolla', this.x + rand(-24, 24), GROUND - 2, { vx: rand(-20, 20), vy: rand(-90, -40), vita: rand(0.3, 0.6), r: rand(2, 4.5) });
    }
  }

  // ---------- disegno ----------

  disegnaAura(ctx, t) {
    if (!this.potereProno || this.invisibile) return;
    const s = this.scala;
    const cx = this.x, cy = this.y - (this.alzo + 82) * s;
    const r = 112 * s;
    const pulsa = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const alone = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r * 1.05);
    alone.addColorStop(0, 'rgba(255,214,90,0)');
    alone.addColorStop(0.75, `rgba(255,214,90,${0.22 + 0.18 * pulsa})`);
    alone.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = alone;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3 + 2 * pulsa;
    ctx.strokeStyle = `rgba(255,236,150,${0.55 + 0.35 * pulsa})`;
    ctx.shadowColor = '#ffd75a';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    // archi rotanti
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 3; k++) {
      const a = t * 2.4 + (k * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.86, a, a + 0.45);
      ctx.stroke();
    }
    // scintille in orbita
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff6c8';
    for (let k = 0; k < 8; k++) {
      const a = -t * 1.6 + (k * Math.PI * 2) / 8;
      const rr = r * (0.92 + 0.06 * Math.sin(t * 5 + k));
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2.4 + pulsa * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  disegnaOmbra(ctx) {
    if (this.scivola > 0) {
      // pozza gialla lungo la scivolata
      const a = Math.min(1, this.scivola * 2);
      const x0 = Math.min(this.pozzaX, this.x) - 34, x1 = Math.max(this.pozzaX, this.x) + 34;
      ctx.fillStyle = `rgba(250,204,21,${0.55 * a})`;
      ctx.beginPath();
      ctx.ellipse((x0 + x1) / 2, GROUND + 4, (x1 - x0) / 2, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.sommerso || this.invisibile) return;
    const altezza = GROUND - this.y;
    const k = clamp(1 - altezza / 400, 0.3, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.32 * k})`;
    ctx.beginPath();
    ctx.ellipse(this.x, GROUND + 3, 40 * this.scala * this.largo * k, 8 * this.scala * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // scia lasciata dagli scatti
  disegnaScie(ctx) {
    if (!this.scie.length) return;
    const s = this.scala;
    const img = this.immagineTesta();
    ctx.save();
    for (const p of this.scie) {
      ctx.globalAlpha = clamp(p.a, 0, 1) * 0.35;
      const r = R_TESTA * s;
      ctx.drawImage(img, p.x - r, p.y - (this.alzo + 118) * s - r, r * 2, r * 2);
      ctx.fillStyle = this.coloriMaglia().maglia;
      ctx.fillRect(p.x - 16 * s, p.y - 88 * s, 32 * s, 46 * s);
    }
    ctx.restore();
  }

  disegna(ctx, t) {
    if (this.invisibile) return;
    this.pelle = this.gelo ? mescola(this.pelleBase, '#a5e3ff', 0.55)
      : this.malato ? mescola(this.pelleBase, '#86efac', 0.45)
        : this.aspetto === 'furia' ? mescola(this.pelleBase, '#ff2a2a', 0.35) : this.pelleBase;
    if (this.sommerso) {
      this.disegnaSommerso(ctx, t);
      return;
    }
    this.disegnaScie(ctx);
    const s = this.scala;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s * this.largo, s);

    if (this.forma === 'zucca' || this.forma === 'comodino') {
      if (this.forma === 'zucca') disegnaZucca(ctx, t);
      else disegnaComodino(ctx);
      ctx.restore();
      if (this.aiutante) this.disegnaEtichetta(ctx);
      return;
    }

    ctx.save();
    if (this.forma === 'schiacciato') ctx.scale(1.3, 0.22);
    if (this.giravolta > 0) {
      ctx.translate(0, -80);
      ctx.rotate(this.giravolta * 10 * -this.dir);
      ctx.translate(0, 80);
    }
    if (this.scivola > 0) ctx.rotate(this.dir * 0.22 + Math.sin(t * 16) * 0.1);

    // corpo disegnato rivolto a destra e specchiato per la squadra di destra
    ctx.save();
    ctx.scale(this.versoDisegno, 1);
    if (this.veicolo) this.disegnaVeicolo(ctx, t);
    ctx.translate(0, -this.alzo);
    const posa = this.posa(t);
    if (this.costume && this.costume.mantello) this.disegnaMantello(ctx, t, '#ffffff', '#d6dbe4');
    if (this.acc.mantelloRosso) this.disegnaMantello(ctx, t, '#dc2626', '#991b1b', true);
    if (this.animale === 'leopardo') this.disegnaCodaLeopardo(ctx, t);
    this.disegnaBraccio(ctx, posa.braccioDietro, true);
    if (this.tritone) {
      this.disegnaCoda(ctx, t);
      this.disegnaBusto(ctx);
    } else {
      this.disegnaGamba(ctx, -4, posa.gambaDietro, true);
      this.disegnaBusto(ctx);
      this.disegnaGamba(ctx, 5, posa.gambaAvanti, false);
    }
    if (this.acc.camice) this.disegnaCamice(ctx);
    if (this.acc.chitarra) this.disegnaChitarra(ctx, t);
    if (this.scettro) this.disegnaScettro(ctx, t);
    if (this.acc.arcobaleno) this.disegnaBandieraArcobaleno(ctx, t);
    this.disegnaBraccio(ctx, posa.braccioAvanti, false);
    if (this.joypad) this.disegnaJoypad(ctx);
    ctx.restore();

    // la testa (foto) non va specchiata
    const ondeggio = this.aTerra && Math.abs(this.vx) > 25 ? Math.sin(this.fase * 2) * 1.6 : 0;
    const testaY = -118 - this.alzo + ondeggio;
    ctx.save();
    ctx.translate(0, testaY);
    ctx.rotate(clamp(this.vx / 4000, -0.08, 0.08) + (this.stordito > 0 ? Math.sin(t * 9) * 0.12 : 0));
    const R = R_TESTA;
    if (this.acc.felpa) this.disegnaCappuccio(ctx, R);
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(this.immagineTesta(), -R, -R, R * 2, R * 2);
    ctx.shadowColor = 'transparent';
    this.disegnaAccessoriTesta(ctx, R, t);
    ctx.restore();
    ctx.restore();

    if (this.forma === 'miele') this.disegnaMiele(ctx, t);
    if (this.congelato) disegnaBloccoFermo(ctx, this.alzo);
    this.disegnaStati(ctx, t, this.forma === 'schiacciato' ? -40 : testaY);
    ctx.restore();

    if (this.aiutante) this.disegnaEtichetta(ctx);
  }

  disegnaAccessoriTesta(ctx, R, t) {
    const a = this.acc;
    if (this.uniforme === 'militare') this.disegnaBerretto(ctx);
    if (this.costume && this.costume.maschera) this.disegnaMaschera(ctx, R);
    if (this.aspetto === 'furia') this.disegnaOcchiLaser(ctx, R, t);
    if (a.mascheraV) disegnaMascheraV(ctx, R);
    if (a.occhiali) disegnaOcchiali(ctx, R);
    if (a.fascia) disegnaFascia(ctx, R, this.dir, t);
    if (a.naso) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, R * 0.2, R * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(-R * 0.05, R * 0.15, R * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    if (a.piediInBocca) disegnaPiedeInBocca(ctx, R, this.dir);
    if (this.malato) disegnaTermometro(ctx, R, this.dir);
    if (a.cappelloNano) disegnaCappelloNano(ctx, R, this.dir, t);
    if (a.corona) disegnaCorona(ctx, R);
  }

  posa(t) {
    const p = {};
    const corre = Math.abs(this.vx) > 25;
    const f = this.fase;
    if (this.veicolo) {
      p.gambaAvanti = { anca: 0.9 + Math.sin(f) * 0.35, ginocchio: 1.3 + Math.cos(f) * 0.3 };
      p.gambaDietro = { anca: 0.9 - Math.sin(f) * 0.35, ginocchio: 1.3 - Math.cos(f) * 0.3 };
    } else if (!this.aTerra) {
      p.gambaAvanti = { anca: 0.55, ginocchio: 0.9 };
      p.gambaDietro = { anca: -0.35, ginocchio: 0.7 };
    } else if (corre) {
      p.gambaAvanti = { anca: Math.sin(f) * 0.75, ginocchio: 0.15 + 0.75 * Math.max(0, -Math.cos(f)) };
      p.gambaDietro = { anca: -Math.sin(f) * 0.75, ginocchio: 0.15 + 0.75 * Math.max(0, Math.cos(f)) };
    } else {
      const respiro = Math.sin(t * 2.5) * 0.04;
      p.gambaAvanti = { anca: 0.12 + respiro, ginocchio: 0.1 };
      p.gambaDietro = { anca: -0.12 - respiro, ginocchio: 0.1 };
    }
    if (this.calcio) {
      const u = this.calcio.t / CALCIO.durata;
      const max = CALCIO.angolo[this.calcio.tipo];
      const k = u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65;
      p.gambaAvanti = { anca: -0.3 + (max + 0.3) * Math.sin((k * Math.PI) / 2), ginocchio: 0.12 };
      p.gambaDietro = { anca: -0.25, ginocchio: 0.2 };
    }
    if (this.joypad) {
      p.braccioAvanti = 1.15;
      p.braccioDietro = 1.0;
    } else if (!this.aTerra && !this.veicolo) {
      p.braccioAvanti = 2.4;
      p.braccioDietro = -2.2;
    } else if (corre) {
      p.braccioAvanti = -Math.sin(f) * 0.8;
      p.braccioDietro = Math.sin(f) * 0.8;
    } else {
      p.braccioAvanti = 0.15;
      p.braccioDietro = -0.15;
    }
    if (this.calcio) {
      p.braccioAvanti = -0.9;
      p.braccioDietro = 1.1;
    }
    if (this.braccatore) {
      // braccia tese per afferrare l'avversario
      p.braccioAvanti = 1.5 + Math.sin(t * 12) * 0.15;
      p.braccioDietro = 1.3 + Math.cos(t * 12) * 0.15;
    }
    if (this.scivola > 0) {
      p.braccioAvanti = 2.6 + Math.sin(t * 14) * 0.4;
      p.braccioDietro = -2.4 + Math.cos(t * 14) * 0.4;
      p.gambaAvanti = { anca: 1.1, ginocchio: 0.2 };
      p.gambaDietro = { anca: 0.4, ginocchio: 0.3 };
    }
    if (this.scettro || this.acc.arcobaleno) p.braccioAvanti = 0.9; // regge lo scettro o la bandiera
    if (this.acc.chitarra) {
      p.braccioAvanti = 0.55 + Math.sin(t * 22) * 0.25; // pennata
      p.braccioDietro = 1.35;
    }
    if (this.forma === 'miele') {
      p.braccioAvanti = 2.9;
      p.braccioDietro = -2.9;
    }
    return p;
  }

  coloriMaglia() {
    let c;
    const a = this.acc;
    if (this.costume) {
      const k = this.costume.colore;
      c = {
        maglia: k, scuro: mescola(k, '#000000', 0.35), chiaro: mescola(k, '#ffffff', 0.3),
        pantaloni: mescola(k, '#000000', 0.2), calze: k, scarpe: mescola(k, '#000000', 0.45), coscia: k, avambraccio: k,
      };
    } else if (this.uniforme === 'militare') {
      c = { maglia: '#4b5320', scuro: '#2f3514', chiaro: '#6b7530', pantaloni: '#3b4218', calze: '#2f3514', scarpe: '#1c1c1c' };
    } else if (a.felpa) {
      const k = a.felpa;
      c = { maglia: k, scuro: tinta(k, 0.7), chiaro: tinta(k, 1.3), pantaloni: '#1f2937', calze: '#1f2937', scarpe: '#f8fafc', avambraccio: k };
    } else if (a.camice) {
      const s = this.colori;
      c = { maglia: '#f8fafc', scuro: '#cbd5e1', chiaro: '#ffffff', pantaloni: s.pantaloni, calze: s.maglia, scarpe: s.scarpe };
    } else if (a.senzaMaglia) {
      const s = this.colori;
      const p = this.pelle;
      c = { maglia: p, scuro: tinta(p, 0.78), chiaro: tinta(p, 1.15), pantaloni: s.pantaloni, calze: s.maglia, scarpe: s.scarpe, nudo: true };
    } else if (this.magliaFissa) {
      const k = this.magliaFissa;
      c = { maglia: k, scuro: tinta(k, 0.6), chiaro: tinta(k, 1.35), pantaloni: '#f8fafc', calze: k, scarpe: '#111827' };
    } else {
      const s = this.colori;
      c = { maglia: s.maglia, scuro: s.scuro, chiaro: s.chiaro, pantaloni: s.pantaloni, calze: s.maglia, scarpe: s.scarpe };
    }
    if (this.animale === 'leopardo') {
      c.coscia = '#e0a33a';
      c.avambraccio = '#e0a33a';
    }
    c.coscia = c.coscia || this.pelle;
    c.avambraccio = c.avambraccio || this.pelle;
    if (this.gelo) {
      for (const k of ['maglia', 'scuro', 'chiaro', 'pantaloni', 'calze', 'scarpe', 'coscia', 'avambraccio']) c[k] = mescola(c[k], '#bfeaff', 0.5);
    }
    return c;
  }

  // testa colorata per gelo (azzurrina), furia (rossa) o malattia (verde), calcolata una volta sola
  immagineTesta() {
    const base = (this.testaAltFile && Risorse.img[this.testaAltFile]) || this.testa;
    const tinta = this.gelo ? ['#7dd3fc', 0.45] : this.malato ? ['#22c55e', 0.4] : this.aspetto === 'furia' ? ['#ff1a1a', 0.42] : null;
    if (!tinta) return base;
    const chiave = `${tinta.join()}|${this.testaAltFile || ''}`;
    this.tinte = this.tinte || {};
    if (!this.tinte[chiave]) {
      const c = creaCanvas(base.width, base.height);
      const g = c.getContext('2d');
      g.drawImage(base, 0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = tinta[1];
      g.fillStyle = tinta[0];
      g.fillRect(0, 0, c.width, c.height);
      this.tinte[chiave] = c;
    }
    return this.tinte[chiave];
  }

  disegnaGamba(ctx, xAnca, { anca, ginocchio }, dietro) {
    const col = this.coloriMaglia();
    ctx.save();
    ctx.translate(xAnca, -36);
    ctx.rotate(-anca);
    ctx.lineCap = 'round';
    ctx.strokeStyle = dietro ? scurisci(col.coscia, 0.8) : col.coscia;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 16);
    ctx.stroke();
    ctx.translate(0, 16);
    ctx.rotate(ginocchio);
    ctx.strokeStyle = dietro ? scurisci(col.calze, 0.7) : col.calze;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 14);
    ctx.stroke();
    ctx.fillStyle = dietro ? '#cbd5e1' : '#ffffff';
    ctx.fillRect(-4, 2, 8, 2.5);
    ctx.translate(0, 14);
    if (this.senzaPiedi) {
      // niente piede: solo un moncherino con il calzino
      ctx.fillStyle = dietro ? '#cbd5e1' : '#f1f5f9';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate((anca - ginocchio) * 0.75);
    ctx.fillStyle = dietro ? scurisci(col.scarpe === '#f8fafc' ? '#e2e8f0' : '#374151', 0.85) : col.scarpe;
    pathRett(ctx, -7, -4, 23, 10, 4.5);
    ctx.fill();
    ctx.fillStyle = col.scarpe === '#f8fafc' ? this.colori.maglia : '#f5c84b';
    ctx.fillRect(-1, -1.5, 10, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-6, 4.2, 21, 2);
    if (this.supertiro && !dietro) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,120,20,0.6)';
      ctx.beginPath();
      ctx.arc(6, 0, 12 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  disegnaBraccio(ctx, ang, dietro) {
    const col = this.coloriMaglia();
    ctx.save();
    ctx.translate(dietro ? -3 : 3, -78);
    ctx.rotate(-ang);
    ctx.lineCap = 'round';
    if (this.muscoli && this.aspetto !== 'furia') {
      ctx.strokeStyle = dietro ? scurisci(this.pelle, 0.8) : this.pelle;
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 27);
      ctx.stroke();
      ctx.fillStyle = dietro ? scurisci(this.pelle, 0.75) : scurisci(this.pelle, 0.95);
      ctx.beginPath();
      ctx.ellipse(3, 10, 9, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,30,30,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(4, 5); ctx.lineTo(1, 12); ctx.lineTo(4, 18);
      ctx.stroke();
      ctx.fillStyle = dietro ? scurisci(this.pelle, 0.8) : this.pelle;
      ctx.beginPath();
      ctx.arc(0, 30, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = dietro ? col.scuro : col.maglia;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 11);
      ctx.stroke();
      ctx.strokeStyle = dietro ? scurisci(col.avambraccio, 0.8) : col.avambraccio;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, 11);
      ctx.lineTo(0, 24);
      ctx.stroke();
      ctx.fillStyle = dietro ? scurisci(this.pelle, 0.8) : this.pelle;
      ctx.beginPath();
      ctx.arc(0, 26, 4.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  disegnaBusto(ctx) {
    const col = this.coloriMaglia();
    const gr = ctx.createLinearGradient(-16, 0, 16, 0);
    gr.addColorStop(0, col.scuro);
    gr.addColorStop(0.45, col.maglia);
    gr.addColorStop(1, col.chiaro);
    ctx.fillStyle = gr;
    pathRett(ctx, -16, -88, 32, 46, 11);
    ctx.fill();
    if (this.uniforme === 'militare') {
      ctx.fillStyle = col.scuro;
      ctx.fillRect(2, -70, 10, 8);
      ctx.fillRect(-12, -70, 10, 8);
      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(-16, -51, 32, 5);
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(-3, -51, 6, 5);
    } else if (this.costume) {
      if (this.costume.lettera) {
        ctx.save();
        ctx.scale(this.versoDisegno, 1); // la lettera non va specchiata
        ctx.font = '900 24px Montserrat, Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.costume.lettera, 0, -66);
        ctx.restore();
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-16, -51, 32, 4);
    } else if (col.nudo) {
      // a torso nudo: pettorali e addominali accennati
      ctx.strokeStyle = 'rgba(80,40,20,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-11, -74); ctx.quadraticCurveTo(-3, -68, 1, -74);
      ctx.moveTo(3, -74); ctx.quadraticCurveTo(9, -68, 13, -74);
      ctx.moveTo(2, -66); ctx.lineTo(2, -52);
      ctx.moveTo(-4, -61); ctx.lineTo(8, -61);
      ctx.moveTo(-4, -55); ctx.lineTo(8, -55);
      ctx.stroke();
    } else if (this.acc.felpa) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(-12, -62, 24, 10); // tascone
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-3, -86); ctx.lineTo(-4, -74);
      ctx.moveTo(4, -86); ctx.lineTo(5, -74);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(8, -86, 3, 42);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(-16, -50, 32, 4);
    }
    ctx.fillStyle = col.pantaloni;
    pathRett(ctx, -15, -50, 30, 16, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(-1, -46, 2, 12);
    if (this.muscoli) {
      ctx.strokeStyle = `rgba(255,40,40,${0.4 + 0.3 * Math.sin(this.partita.t * 10)})`;
      ctx.lineWidth = 3;
      pathRett(ctx, -18, -90, 36, 58, 12);
      ctx.stroke();
    }
  }

  disegnaVeicolo(ctx, t) {
    const v = this.veicolo;
    if (v === 'carrello') { disegnaCarrello(ctx, this.fase); return; }
    if (v === 'clown') { disegnaMacchinaClown(ctx, this.fase, t); return; }
    const img = Risorse.img[v];
    if (!(img instanceof HTMLImageElement)) return;
    const larg = img.width > img.height * 1.5 ? 150 : 130;
    const alt = (img.height / img.width) * larg;
    ctx.drawImage(img, -larg / 2, -alt + 3, larg, alt);
  }

  disegnaJoypad(ctx) {
    const img = Risorse.img[this.joypad];
    if (img instanceof HTMLImageElement) ctx.drawImage(img, 8, -66, 40, 40);
  }

  disegnaBerretto(ctx) {
    const R = 44;
    ctx.save();
    ctx.translate(0, -R * 0.62);
    ctx.fillStyle = '#4b5320';
    ctx.beginPath();
    ctx.ellipse(0, -6, R * 0.86, R * 0.42, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b4218';
    ctx.fillRect(-R * 0.86, -8, R * 1.72, 9);
    ctx.fillStyle = '#1f2410';
    ctx.beginPath();
    ctx.ellipse(this.dir * R * 0.55, 2, R * 0.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // stella rossa
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 3.2 : 8;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(Math.cos(a) * r, -20 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // mantello che sventola all'indietro (coordinate del corpo rivolto a destra)
  disegnaMantello(ctx, t, chiaro, scuro, bordoBianco = false) {
    const sv = clamp(Math.abs(this.vx) / 400 + (this.aTerra ? 0 : 0.4), 0, 1.2);
    const onda = Math.sin(t * 9) * (2 + sv * 4);
    const bx = -8 - sv * 34, by = -16 - sv * 18;
    ctx.save();
    const gr = ctx.createLinearGradient(0, -88, bx, by);
    gr.addColorStop(0, chiaro);
    gr.addColorStop(1, scuro);
    ctx.fillStyle = gr;
    ctx.strokeStyle = bordoBianco ? '#ffffff' : 'rgba(0,0,0,0.18)';
    ctx.lineWidth = bordoBianco ? 4 : 1.2;
    ctx.beginPath();
    ctx.moveTo(-13, -88);
    ctx.lineTo(9, -88);
    ctx.quadraticCurveTo(4, -50, bx + 16, by + onda);
    ctx.quadraticCurveTo(bx + 4, by + 6 - onda, bx - 8, by - onda * 0.5);
    ctx.quadraticCurveTo(-24, -52, -13, -88);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // coda di pesce al posto delle gambe
  disegnaCoda(ctx, t) {
    const calcio = this.calcio ? Math.sin(clamp(this.calcio.t / CALCIO.durata, 0, 1) * Math.PI) : 0;
    const corre = clamp(Math.abs(this.vx) / 300, 0, 1);
    const onda = Math.sin(t * 7 + this.fase) * (0.25 + corre * 0.35);
    const scuro = this.gelo ? '#5aa9b8' : '#0f766e';
    const chiaro = this.gelo ? '#b5ecf5' : '#2dd4bf';
    ctx.save();
    ctx.translate(0, -40);
    ctx.rotate(-calcio * 1.1);
    const gr = ctx.createLinearGradient(-14, 0, 14, 0);
    gr.addColorStop(0, scuro);
    gr.addColorStop(0.5, chiaro);
    gr.addColorStop(1, scuro);
    const px = onda * 10;
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.bezierCurveTo(-17, 14, -7 + px * 0.6, 24, -3 + px, 32);
    ctx.lineTo(3 + px, 32);
    ctx.bezierCurveTo(7 + px * 0.6, 24, 17, 14, 15, 0);
    ctx.closePath();
    ctx.fill();
    // squame
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let r = 0; r < 3; r++) {
      const y = 6 + r * 8;
      const larg = 13 - r * 4;
      for (let x = -larg; x <= larg; x += 6) {
        ctx.beginPath();
        ctx.arc(x + px * (y / 32), y, 3, 0, Math.PI);
        ctx.stroke();
      }
    }
    // pinna caudale
    ctx.translate(px, 32);
    ctx.rotate(onda * 0.5);
    ctx.fillStyle = chiaro;
    ctx.strokeStyle = scuro;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-10, 0, -24, -3);
    ctx.quadraticCurveTo(-17, 6, -4, 7);
    ctx.quadraticCurveTo(0, 5, 4, 7);
    ctx.quadraticCurveTo(17, 6, 24, -3);
    ctx.quadraticCurveTo(10, 0, 0, -2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (const x of [-16, -9, 9, 16]) {
      ctx.moveTo(x * 0.2, 1);
      ctx.lineTo(x, 3);
    }
    ctx.stroke();
    ctx.restore();
  }

  // sotto il campo si vedono solo increspature e la pinna che sbuca
  disegnaSommerso(ctx, t) {
    const x = this.x;
    ctx.save();
    ctx.fillStyle = 'rgba(14,116,144,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, GROUND + 6, 64, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 3; k++) {
      const u = (t * 1.2 + k / 3) % 1;
      ctx.strokeStyle = `rgba(186,230,253,${0.75 * (1 - u)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, GROUND + 2, 20 + u * 54, 4 + u * 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const verso = Math.abs(this.vx) > 20 ? Math.sign(this.vx) : this.dir;
    ctx.translate(x - verso * 18, GROUND + 4);
    ctx.scale(verso, 1);
    ctx.rotate(-0.15 + Math.sin(t * 8) * 0.18);
    ctx.fillStyle = '#2dd4bf';
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.quadraticCurveTo(-4, -16, -2, -22);
    ctx.quadraticCurveTo(-16, -34, -24, -44);
    ctx.quadraticCurveTo(-6, -38, 0, -28);
    ctx.quadraticCurveTo(6, -40, 20, -46);
    ctx.quadraticCurveTo(10, -32, 3, -22);
    ctx.quadraticCurveTo(5, -14, 6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // la testa del tritone resta riconoscibile in un piccolo segnalino
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(this.testa, x - 18, GROUND + 12, 36, 36);
    ctx.restore();
  }

  // scettro d'oro con pietra rosa, retto dalla mano avanti
  disegnaScettro(ctx, t) {
    const hx = 3 + 26 * Math.sin(0.9), hy = -78 + 26 * Math.cos(0.9);
    ctx.save();
    ctx.translate(hx, hy);
    const oro = ctx.createLinearGradient(-3, 0, 3, 0);
    oro.addColorStop(0, '#a16207');
    oro.addColorStop(0.5, '#fde68a');
    oro.addColorStop(1, '#b45309');
    ctx.fillStyle = oro;
    pathRett(ctx, -2.5, -58, 5, 82, 2);
    ctx.fill();
    // corona che regge la pietra
    ctx.beginPath();
    ctx.moveTo(-9, -60);
    ctx.lineTo(-7, -72);
    ctx.lineTo(-3, -64);
    ctx.lineTo(0, -74);
    ctx.lineTo(3, -64);
    ctx.lineTo(7, -72);
    ctx.lineTo(9, -60);
    ctx.closePath();
    ctx.fill();
    const pulsa = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.shadowColor = '#f472b6';
    ctx.shadowBlur = 10 + pulsa * 12;
    const gemma = ctx.createRadialGradient(-2, -71, 1, 0, -68, 8);
    gemma.addColorStop(0, '#fff1f7');
    gemma.addColorStop(0.4, '#f9a8d4');
    gemma.addColorStop(1, '#db2777');
    ctx.fillStyle = gemma;
    ctx.beginPath();
    ctx.arc(0, -68, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // bandiera arcobaleno che sventola, retta dalla mano avanti
  disegnaBandieraArcobaleno(ctx, t) {
    const hx = 3 + 26 * Math.sin(0.9), hy = -78 + 26 * Math.cos(0.9);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(-1.8, -96, 3.6, 110);
    const colori = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'];
    const lw = 58, lh = 38;
    colori.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      const y0 = -96 + (i * lh) / 6, y1 = -96 + ((i + 1) * lh) / 6;
      for (let k = 0; k <= 8; k++) ctx.lineTo((lw * k) / 8, y0 + Math.sin(t * 7 + k * 0.8) * 3 * (k / 8));
      for (let k = 8; k >= 0; k--) ctx.lineTo((lw * k) / 8, y1 + Math.sin(t * 7 + k * 0.8) * 3 * (k / 8));
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  // chitarra elettrica a tracolla (coordinate del corpo rivolto a destra)
  disegnaChitarra(ctx) {
    ctx.save();
    ctx.translate(4, -56);
    ctx.rotate(-0.55);
    // manico
    ctx.fillStyle = '#78350f';
    ctx.fillRect(10, -4, 52, 8);
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(60, -6, 12, 12);
    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) { ctx.moveTo(-14, k * 1.5); ctx.lineTo(66, k * 1.5); }
    ctx.stroke();
    // cassa
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(-8, 0, 17, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(6, 0, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(-4, 4, 8, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(-10, -6, 3, 12);
    ctx.restore();
  }

  // camice bianco da medico sopra la maglia
  disegnaCamice(ctx) {
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-17, -86);
    ctx.lineTo(-19, -26);
    ctx.lineTo(19, -26);
    ctx.lineTo(17, -86);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -88); ctx.lineTo(1, -66); ctx.lineTo(8, -88);
    ctx.moveTo(1, -66); ctx.lineTo(1, -26);
    ctx.stroke();
    ctx.strokeRect(5, -60, 9, 9);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(7, -64, 2, 7);
    ctx.restore();
  }

  // coda maculata del leopardo
  disegnaCodaLeopardo(ctx, t) {
    ctx.save();
    ctx.strokeStyle = '#e0a33a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    const o = Math.sin(t * 6) * 6;
    ctx.beginPath();
    ctx.moveTo(-12, -46);
    ctx.quadraticCurveTo(-46, -40 + o, -52, -76 + o);
    ctx.stroke();
    ctx.fillStyle = '#3f2a10';
    for (const [x, y] of [[-26, -45], [-40, -48], [-49, -62]]) {
      ctx.beginPath();
      ctx.arc(x, y + o * 0.6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // cappuccio della felpa dietro la testa
  disegnaCappuccio(ctx, R) {
    ctx.save();
    ctx.fillStyle = tinta(this.acc.felpa, 0.75);
    ctx.beginPath();
    ctx.ellipse(-this.dir * R * 0.1, R * 0.38, R * 0.86, R * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // colata di miele sopra il corpo
  disegnaMiele(ctx, t) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    const gr = ctx.createLinearGradient(0, -180, 0, 0);
    gr.addColorStop(0, '#fcd34d');
    gr.addColorStop(1, '#d97706');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(-40, -170);
    ctx.quadraticCurveTo(0, -200, 40, -170);
    for (let x = 40; x >= -40; x -= 10) ctx.lineTo(x, -8 - Math.abs(Math.sin(x * 0.3 + t * 2)) * 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // maschera blu sugli occhi (coordinate della testa, raggio R)
  disegnaMaschera(ctx, R) {
    const col = mescola(this.costume.colore, '#000000', 0.15);
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-R * 0.64, -R * 0.12);
    ctx.quadraticCurveTo(0, -R * 0.28, R * 0.64, -R * 0.12);
    ctx.lineTo(R * 0.68, R * 0.08);
    ctx.quadraticCurveTo(R * 0.3, R * 0.26, 0, R * 0.12);
    ctx.quadraticCurveTo(-R * 0.3, R * 0.26, -R * 0.68, R * 0.08);
    ctx.closePath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * R * 0.24 + R * 0.12, R * 0.04);
      ctx.ellipse(sx * R * 0.24, R * 0.04, R * 0.12, R * 0.075, 0, 0, Math.PI * 2);
    }
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // lacci che svolazzano dietro la testa
    const dietro = -this.dir;
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.moveTo(dietro * R * 0.66, 0);
      ctx.quadraticCurveTo(dietro * R * 0.9, R * (0.05 + k * 0.12), dietro * R * (1.05 + k * 0.1), R * (0.1 + k * 0.18) + Math.sin(this.partita.t * 10 + k) * 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  // occhi azzurri che sparano laser in avanti
  disegnaOcchiLaser(ctx, R, t) {
    const ey = R * 0.05;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      const x = sx * R * 0.24;
      const gl = ctx.createRadialGradient(x, ey, 0, x, ey, R * 0.24);
      gl.addColorStop(0, 'rgba(230,250,255,1)');
      gl.addColorStop(0.35, 'rgba(56,189,248,0.95)');
      gl.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(x, ey, R * 0.24, 0, Math.PI * 2);
      ctx.fill();
      const lung = 150 + Math.sin(t * 30 + sx) * 25;
      const fx = x + this.dir * lung, fy = ey + 10;
      ctx.strokeStyle = `rgba(56,189,248,${0.35 + 0.35 * Math.random()})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, ey);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(235,250,255,0.9)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  disegnaStati(ctx, t, testaY) {
    const sopra = testaY - 62;
    if (this.braccato) {
      ctx.save();
      ctx.font = '44px Bangers, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#111';
      ctx.fillStyle = Math.floor(t * 6) % 2 ? '#f43f5e' : '#fde047';
      const y = sopra + Math.sin(t * 10) * 3;
      ctx.strokeText('!!', 0, y);
      ctx.fillText('!!', 0, y);
      ctx.restore();
    }
    if (this.stordito > 0 || this.stelline || this.forma === 'schiacciato') {
      for (let k = 0; k < 4; k++) {
        const a = t * 5 + (k * Math.PI) / 2;
        disegnaStella(ctx, Math.cos(a) * 38, sopra + 12 + Math.sin(a) * 9, 8, '#facc15');
      }
    }
    if (this.confuso) {
      ctx.save();
      ctx.font = '40px Bangers, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#1e1b4b';
      ctx.fillStyle = '#c084fc';
      for (let k = 0; k < 3; k++) {
        const a = t * 3 + (k * Math.PI * 2) / 3;
        const x = Math.cos(a) * 34;
        const y = sopra + Math.sin(a) * 8;
        ctx.strokeText(k === 1 ? '!' : '?', x, y);
        ctx.fillText(k === 1 ? '!' : '?', x, y);
      }
      ctx.restore();
    }
    if (this.replicaDi) {
      ctx.save();
      ctx.strokeStyle = '#a855f7';
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const fase = (t * 2 + k / 3) % 1;
        ctx.globalAlpha = 1 - fase;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, sopra + 20, 10 + fase * 30, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (this.magnete) {
      ctx.fillStyle = 'rgba(125,211,252,0.9)';
      for (let k = 0; k < 3; k++) {
        const u = (t * 1.5 + k / 3) % 1;
        const lato = k % 2 ? 1 : -1;
        const x = lato * (44 + u * 18);
        const y = testaY - 20 + u * 40;
        ctx.globalAlpha = 1 - u;
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.quadraticCurveTo(x + 5, y, x, y + 4);
        ctx.quadraticCurveTo(x - 5, y, x, y - 8);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (this.bloccatoInPorta) disegnaLucchetto(ctx, 0, sopra + 6);
    if (this.soloSaltoCalcio) {
      ctx.save();
      ctx.font = '34px Bangers, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#111';
      ctx.fillStyle = '#f43f5e';
      ctx.strokeText('← ✕ →', 0, sopra + 4);
      ctx.fillText('← ✕ →', 0, sopra + 4);
      ctx.restore();
    }
  }

  disegnaEtichetta(ctx) {
    if (this.invisibile) return;
    const testo = this.animale ? 'LEOPARDO' : partiNome(this.pers.id).cognome.toUpperCase();
    const y = this.y - (this.alzo + 186) * this.scala;
    ctx.save();
    ctx.font = '800 13px Montserrat, sans-serif';
    const w = ctx.measureText(testo).width + 16;
    ctx.fillStyle = this.colori.scuro;
    ctx.globalAlpha = 0.85;
    pathRett(ctx, this.x - w / 2, y - 10, w, 20, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(testo, this.x, y + 1);
    ctx.restore();
  }
}

function disegnaStella(ctx, x, y, r, colore) {
  ctx.save();
  ctx.fillStyle = colore;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------- accessori e trasformazioni (coordinate locali) ----------

// SadasBI: il giocatore bloccato è chiuso in un riquadro "in pausa"
function disegnaBloccoFermo(ctx, alzo) {
  ctx.save();
  ctx.fillStyle = 'rgba(148,163,184,0.38)';
  ctx.strokeStyle = 'rgba(226,232,240,0.9)';
  ctx.lineWidth = 3;
  pathRett(ctx, -62, -186 - alzo, 124, 190 + alzo, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-52, -176 - alzo, 10, 120);
  // simbolo di pausa
  ctx.fillStyle = 'rgba(15,23,42,0.8)';
  ctx.fillRect(-14, -230 - alzo, 10, 30);
  ctx.fillRect(4, -230 - alzo, 10, 30);
  ctx.restore();
}

function disegnaLucchetto(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -8, 8, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#f5c84b';
  pathRett(ctx, -12, -8, 24, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function disegnaOcchiali(ctx, R) {
  ctx.save();
  ctx.fillStyle = '#0b0b0f';
  for (const sx of [-1, 1]) {
    pathRett(ctx, sx * R * 0.24 - R * 0.2, -R * 0.08, R * 0.4, R * 0.24, R * 0.08);
    ctx.fill();
  }
  ctx.fillRect(-R * 0.06, -R * 0.04, R * 0.12, R * 0.05);
  ctx.strokeStyle = '#0b0b0f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-R * 0.44, -R * 0.03); ctx.lineTo(-R * 0.7, -R * 0.08);
  ctx.moveTo(R * 0.44, -R * 0.03); ctx.lineTo(R * 0.7, -R * 0.08);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (const sx of [-1, 1]) ctx.fillRect(sx * R * 0.24 - R * 0.12, -R * 0.05, R * 0.08, R * 0.05);
  ctx.restore();
}

// hachimaki: fascia bianca sulla fronte con un sole rosso
function disegnaFascia(ctx, R, dir, t) {
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-R * 0.86, -R * 0.36);
  ctx.quadraticCurveTo(0, -R * 0.5, R * 0.86, -R * 0.36);
  ctx.lineTo(R * 0.86, -R * 0.18);
  ctx.quadraticCurveTo(0, -R * 0.32, -R * 0.86, -R * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(0, -R * 0.33, R * 0.08, 0, Math.PI * 2);
  ctx.fill();
  const d = -dir;
  ctx.fillStyle = '#f8fafc';
  for (let k = 0; k < 2; k++) {
    const o = Math.sin(t * 9 + k) * R * 0.06;
    ctx.beginPath();
    ctx.moveTo(d * R * 0.8, -R * 0.3);
    ctx.lineTo(d * R * (1.25 + k * 0.1), -R * (0.18 - k * 0.12) + o);
    ctx.lineTo(d * R * (1.22 + k * 0.1), -R * (0.08 - k * 0.12) + o);
    ctx.lineTo(d * R * 0.8, -R * 0.22);
    ctx.fill();
  }
  ctx.restore();
}

function disegnaCappelloNano(ctx, R, dir, t) {
  ctx.save();
  const punta = { x: dir * R * 0.55, y: -R * 2.0 + Math.sin(t * 4) * 3 };
  const gr = ctx.createLinearGradient(-R, 0, R, 0);
  gr.addColorStop(0, '#991b1b');
  gr.addColorStop(0.5, '#ef4444');
  gr.addColorStop(1, '#b91c1c');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(-R * 0.82, -R * 0.52);
  ctx.quadraticCurveTo(-R * 0.3, -R * 1.3, punta.x, punta.y);
  ctx.quadraticCurveTo(R * 0.4, -R * 1.1, R * 0.82, -R * 0.52);
  ctx.quadraticCurveTo(0, -R * 0.7, -R * 0.82, -R * 0.52);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(0, -R * 0.56, R * 0.86, R * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(punta.x, punta.y, R * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function disegnaCorona(ctx, R) {
  ctx.save();
  const oro = ctx.createLinearGradient(0, -R * 1.25, 0, -R * 0.7);
  oro.addColorStop(0, '#fff7c2');
  oro.addColorStop(0.5, '#facc15');
  oro.addColorStop(1, '#a16207');
  ctx.fillStyle = oro;
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-R * 0.55, -R * 0.72);
  ctx.lineTo(-R * 0.62, -R * 1.18);
  ctx.lineTo(-R * 0.3, -R * 0.95);
  ctx.lineTo(0, -R * 1.3);
  ctx.lineTo(R * 0.3, -R * 0.95);
  ctx.lineTo(R * 0.62, -R * 1.18);
  ctx.lineTo(R * 0.55, -R * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [x, c] of [[-R * 0.32, '#dc2626'], [0, '#2563eb'], [R * 0.32, '#16a34a']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, -R * 0.82, R * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// maschera di "V per Vendetta"
function disegnaMascheraV(ctx, R) {
  ctx.save();
  ctx.fillStyle = '#f5efe1';
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, R * 0.05, R * 0.68, R * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(244,114,182,0.45)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * R * 0.36, R * 0.22, R * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const sx of [-1, 1]) {
    // sopracciglia arcuate e occhi socchiusi
    ctx.moveTo(sx * R * 0.1, -R * 0.2);
    ctx.quadraticCurveTo(sx * R * 0.3, -R * 0.42, sx * R * 0.5, -R * 0.16);
    ctx.moveTo(sx * R * 0.14, -R * 0.02);
    ctx.quadraticCurveTo(sx * R * 0.27, -R * 0.1, sx * R * 0.4, -R * 0.02);
  }
  ctx.stroke();
  // baffi all'insù e pizzetto
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.moveTo(0, R * 0.36);
  ctx.quadraticCurveTo(-R * 0.3, R * 0.3, -R * 0.42, R * 0.12);
  ctx.quadraticCurveTo(-R * 0.36, R * 0.38, 0, R * 0.42);
  ctx.quadraticCurveTo(R * 0.36, R * 0.38, R * 0.42, R * 0.12);
  ctx.quadraticCurveTo(R * 0.3, R * 0.3, 0, R * 0.36);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-R * 0.06, R * 0.6);
  ctx.lineTo(0, R * 0.84);
  ctx.lineTo(R * 0.06, R * 0.6);
  ctx.fill();
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-R * 0.2, R * 0.5);
  ctx.quadraticCurveTo(0, R * 0.58, R * 0.2, R * 0.5);
  ctx.stroke();
  ctx.restore();
}

function disegnaPiedeInBocca(ctx, R, dir) {
  ctx.save();
  ctx.translate(dir * R * 0.15, R * 0.48);
  ctx.scale(dir, 1);
  ctx.rotate(-0.15);
  ctx.fillStyle = '#f8fafc';
  pathRett(ctx, -6, -6, 22, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#111827';
  pathRett(ctx, 14, -9, 30, 15, 6);
  ctx.fill();
  ctx.fillStyle = '#f5c84b';
  ctx.fillRect(20, -5, 14, 2.5);
  ctx.restore();
}

function disegnaTermometro(ctx, R, dir) {
  ctx.save();
  ctx.translate(dir * R * 0.12, R * 0.46);
  ctx.rotate(dir * 0.35);
  ctx.fillStyle = '#f8fafc';
  pathRett(ctx, dir > 0 ? 0 : -40, -3, 40, 6, 3);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(dir > 0 ? 4 : -34, -1.2, 30, 2.4);
  ctx.beginPath();
  ctx.arc(dir * 40, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// zucca intagliata (coordinate del giocatore, piedi in 0,0)
function disegnaZucca(ctx, t) {
  const cy = -72;
  ctx.save();
  for (const k of [-2, 2, -1, 1, 0]) {
    const gr = ctx.createLinearGradient(k * 22 - 34, 0, k * 22 + 34, 0);
    gr.addColorStop(0, '#c2410c');
    gr.addColorStop(0.5, '#fb923c');
    gr.addColorStop(1, '#9a3412');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(k * 21, cy, 36 - Math.abs(k) * 3, 66, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(124,45,18,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = '#3f6212';
  ctx.beginPath();
  ctx.moveTo(-6, cy - 62);
  ctx.quadraticCurveTo(-4, cy - 88, 10, cy - 96);
  ctx.lineTo(14, cy - 90);
  ctx.quadraticCurveTo(4, cy - 84, 6, cy - 62);
  ctx.fill();
  const luce = 0.7 + 0.3 * Math.sin(t * 9);
  ctx.fillStyle = `rgba(253,224,71,${luce})`;
  ctx.beginPath();
  ctx.moveTo(-36, cy - 14); ctx.lineTo(-14, cy - 14); ctx.lineTo(-25, cy - 36);
  ctx.moveTo(36, cy - 14); ctx.lineTo(14, cy - 14); ctx.lineTo(25, cy - 36);
  ctx.moveTo(-6, cy + 2); ctx.lineTo(6, cy + 2); ctx.lineTo(0, cy - 8);
  ctx.moveTo(-40, cy + 14);
  for (let i = 0; i <= 8; i++) ctx.lineTo(-40 + i * 10, cy + 14 + (i % 2 ? 10 : 0));
  ctx.lineTo(40, cy + 30);
  ctx.quadraticCurveTo(0, cy + 46, -40, cy + 30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// comodino con una banconota da 5 euro sopra
function disegnaComodino(ctx) {
  ctx.save();
  const legno = ctx.createLinearGradient(-50, 0, 50, 0);
  legno.addColorStop(0, '#6b3f1d');
  legno.addColorStop(0.5, '#9a6232');
  legno.addColorStop(1, '#6b3f1d');
  ctx.fillStyle = '#4a2a12';
  ctx.fillRect(-46, -12, 10, 12);
  ctx.fillRect(36, -12, 10, 12);
  ctx.fillStyle = legno;
  pathRett(ctx, -50, -122, 100, 112, 6);
  ctx.fill();
  ctx.fillStyle = '#b07a43';
  pathRett(ctx, -56, -132, 112, 12, 4);
  ctx.fill();
  ctx.strokeStyle = '#3b2010';
  ctx.lineWidth = 2;
  for (const y of [-110, -64]) {
    ctx.strokeRect(-40, y, 80, 38);
    ctx.fillStyle = '#f5c84b';
    ctx.beginPath();
    ctx.arc(0, y + 19, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(6, -138);
  ctx.rotate(-0.1);
  ctx.fillStyle = '#b8c2c0';
  ctx.fillRect(-30, -9, 60, 18);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.strokeRect(-27, -6.5, 54, 13);
  ctx.fillStyle = '#475569';
  ctx.font = '900 13px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('5 €', 0, 0.5);
  ctx.restore();
}

// carrello della spesa (coordinate del corpo rivolto a destra, ruote a terra)
function disegnaCarrello(ctx, fase) {
  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-46, -98);
  ctx.lineTo(56, -98);
  ctx.lineTo(44, -42);
  ctx.lineTo(-38, -42);
  ctx.closePath();
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = -36; x < 52; x += 11) { ctx.moveTo(x, -98); ctx.lineTo(x - 2 + (x > 40 ? -4 : 0), -42); }
  for (let y = -86; y < -42; y += 11) { ctx.moveTo(-44 + (y + 98) * 0.12, y); ctx.lineTo(54 - (y + 98) * 0.2, y); }
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-38, -42); ctx.lineTo(-30, -14);
  ctx.moveTo(44, -42); ctx.lineTo(38, -14);
  ctx.moveTo(-46, -98); ctx.lineTo(-62, -114);
  ctx.stroke();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-66, -118); ctx.lineTo(-58, -110);
  ctx.stroke();
  for (const x of [-30, 38]) {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(x, -8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, -8);
    ctx.lineTo(x + Math.cos(fase * 2) * 6, -8 + Math.sin(fase * 2) * 6);
    ctx.stroke();
  }
  ctx.restore();
}

// macchinina da clown a pois
function disegnaMacchinaClown(ctx, fase, t) {
  ctx.save();
  const sobbalzo = Math.abs(Math.sin(fase * 1.5)) * 3;
  ctx.translate(0, -sobbalzo);
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(-74, -22);
  ctx.quadraticCurveTo(-78, -66, -40, -66);
  ctx.lineTo(-14, -66);
  ctx.lineTo(10, -40);
  ctx.lineTo(64, -40);
  ctx.quadraticCurveTo(82, -38, 80, -22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#facc15';
  for (const [x, y] of [[-56, -46], [-34, -32], [30, -30], [56, -32], [-50, -28]]) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(186,230,253,0.7)';
  ctx.beginPath();
  ctx.moveTo(-10, -62); ctx.lineTo(6, -42); ctx.lineTo(-10, -42);
  ctx.fill();
  // fiore sul cofano
  ctx.save();
  ctx.translate(66, -46);
  ctx.rotate(t * 3);
  ctx.fillStyle = '#f0abfc';
  for (let k = 0; k < 5; k++) {
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -6, 3.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (const x of [-46, 50]) {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(x, -16, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.arc(x, -16, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(fase * 2) * 7, -16 - Math.sin(fase * 2) * 7);
    ctx.lineTo(x + Math.cos(fase * 2) * 7, -16 + Math.sin(fase * 2) * 7);
    ctx.stroke();
  }
  ctx.restore();
}
