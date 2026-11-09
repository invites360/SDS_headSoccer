'use strict';

// Traduce una riga di ElencoMosse.csv in un potere giocabile, riconoscendo parole chiave nel testo.
// Un effetto non riconosciuto diventa un "super tiro" generico, così ogni mossa fa comunque qualcosa.
function analizzaPotere(p) {
  if (!p || !p.nome) return null;
  const effetto = p.effetto || '';
  const grafica = p.grafica || '';
  const eff = effetto.toLowerCase();
  const gra = grafica.toLowerCase();
  const testo = `${eff} ${gra}`;
  const file = (grafica.match(/([\w-]+\.(?:png|jpe?g|webp|gif))/i) || [])[1] || null;
  const def = { nome: p.nome, effetto, durata: p.durata || 15, file, acc: analizzaAccessori(testo) };
  const percento = (eff.match(/(\d+)\s*%/) || [])[1];
  const numero = (re, testoDove = eff) => {
    const m = testoDove.match(re);
    return m ? Number(m[1].replace(',', '.')) : null;
  };
  const chi = personaggiCitati(effetto);
  let m;

  // l'ordine conta: "rubano la barra" non è Forza Juve, "si trasforma in un comodino con una banconota" non è Business Man...
  if (/\bruba/.test(eff) && /barra/.test(eff)) return { ...def, tipo: 'ladri', durata: Infinity };
  if (/\bruba/.test(eff)) return { ...def, tipo: 'ruba' };
  if (/tabellone|guadagna\s+\d+\s+gol/.test(eff)) {
    return { ...def, tipo: 'hacker', gol: numero(/guadagna\s+(\d+)/) || 1, durata: p.durata || 4 };
  }
  if (/secondi di gioco/.test(eff)) return { ...def, tipo: 'tempo', secondi: numero(/(\d+)\s*secondi/) || 10, durata: 3.5 };
  if (/si blocca tutto|blocca il tempo/.test(eff)) return { ...def, tipo: 'congela' };
  if (/piedi/.test(eff) && /calciare/.test(eff)) return { ...def, tipo: 'piedi' };
  if (/pancia|inglob/.test(eff)) return { ...def, tipo: 'pancia' };
  if (/freccett\w*\s+laterali|solo il salto/.test(eff)) return { ...def, tipo: 'rock' };
  if (/un comando s|a vuoto/.test(eff)) return { ...def, tipo: 'singhiozzo' };
  if (/scompare|sparisce/.test(eff) && /avversari/.test(eff)) {
    const perde = numero(/perde\s+(?:il\s+)?(\d+)\s*%/);
    return { ...def, tipo: 'scompare', velSe: perde ? 1 - perde / 100 : 1 };
  }
  if (/elefant|mandria/.test(eff)) return { ...def, tipo: 'elefanti' };
  if (/miele/.test(eff)) return { ...def, tipo: 'immobilizza', forma: 'miele' };
  if ((m = eff.match(/avversario\s+(?:diventa|si trasforma in)\s+(?:un[ao']?\s*)?([a-zà-ù]+)/))) {
    return { ...def, tipo: 'immobilizza', forma: m[1] };
  }
  if (/materializza|porta di/.test(eff)) return { ...def, tipo: 'porta' };
  if (/\bserver/.test(eff)) return { ...def, tipo: 'server' };
  if (/cloni degli avversari/.test(eff)) return { ...def, tipo: 'clonavversari', n: 3 };
  if (/vede tutto|patina|più scuro/.test(eff)) return { ...def, tipo: 'buio' };
  if (/mappamondo/.test(eff)) return { ...def, tipo: 'mappamondo' };
  if (/nessun beneficio/.test(eff)) {
    return { ...def, tipo: 'nessuno', campo: /terreno[^.]*arancion/.test(gra) ? '#f97316' : null };
  }
  if (/lanciare|premendo c\b/.test(eff)) {
    const proiettile = /pomodor/.test(eff) ? 'pomodoro' : /sacch|sacc|soldi/.test(eff) ? 'sacco' : /libr/.test(eff) ? 'libro' : 'palla';
    return { ...def, tipo: 'lancio', proiettile };
  }
  if (/due volte/.test(eff) && /slide|scatto/.test(eff)) {
    return { ...def, tipo: 'dash', verticale: /sopra|sotto|alto|basso/.test(eff) };
  }
  if (/dimension/.test(eff)) {
    return {
      ...def, tipo: 'nano',
      scala: percento ? 1 - Number(percento) / 100 : 0.5,
      vel: /veloce il doppio/.test(eff) ? 2 : 1.5,
      saltoAltezza: /salta il doppio/.test(eff) ? 2 : 1.5,
    };
  }
  if ((m = eff.match(/(alt[oa]|larg[oa])\s+(?:il\s+)?(doppio|triplo|quadruplo)/))) {
    const k = { doppio: 2, triplo: 3, quadruplo: 4 }[m[2]];
    return m[1].startsWith('larg') ? { ...def, tipo: 'largo', k } : { ...def, tipo: 'gigante', k };
  }
  if (/avversari/.test(eff) && /riduc|rallent|diminui|più lent/.test(eff) && percento) {
    return {
      ...def, tipo: 'rallenta', mult: Math.max(0.03, 1 - Number(percento) / 100),
      gelo: /congel|azzurr|ghiacc/.test(gra), malato: /ammala|verde|termometr/.test(testo),
    };
  }
  if (/bracca|impedir/.test(eff)) {
    const animali = (m = eff.match(/(\d+)\s+leopard/)) ? Number(m[1]) : 0;
    return { ...def, tipo: 'bracca', chi, scettro: /scettro/.test(gra), animale: animali ? 'leopardo' : null, n: animali || chi.length };
  }
  if (/\bevoca|\bcompai|\bcompar/.test(eff)) { // \b: "scompaiono" (Impazzisco) non conta
    const n = numero(/compai\w*\s+(\d+)/) || 1;
    let speciale = null;
    if (!chi.length && (m = effetto.match(/(?:evoca|compar\w*)\s+(?:un[oa]?\s+|il\s+|la\s+|lo\s+)?([\wÀ-ÿ']+)/i))) speciale = m[1];
    const stats = {};
    const vx = numero(/(\d+(?:[.,]\d+)?)\s*x\s+più veloce/);
    const tx = numero(/tiro\s+è\s+(\d+(?:[.,]\d+)?)\s*x/);
    const sx = numero(/salto\s+è\s+(\d+(?:[.,]\d+)?)\s*x/);
    if (vx) stats.velMult = vx / 0.9; // gli aiutanti di base vanno al 90%
    if (tx) stats.tiroMult = tx;
    if (sx) stats.saltoMult = Math.sqrt(sx);
    return {
      ...def, tipo: 'evoca', chi, speciale, n,
      mini: /\bmini\b|alt[ie] la metà/.test(eff), senzaMaglia: /senza maglia/.test(eff), stats,
    };
  }
  if (/salt[oa]/.test(eff) && percento) {
    return { ...def, tipo: 'salto', mult: 1 + Number(percento) / 100, costume: analizzaCostume(grafica) };
  }
  if (/scivol/.test(eff)) return { ...def, tipo: 'scivola' };
  if (/acqua|sotto il campo/.test(eff)) return { ...def, tipo: 'sottacqua' };
  if (/raddoppi|triplic|quadruplic|si moltiplica il pallone|palloni/.test(eff)) {
    const n = /quadruplic/.test(eff) ? 4 : /raddoppi/.test(eff) ? 2 : 3;
    return { ...def, tipo: 'multipalla', n, durata: /prossimo gol/.test(eff) ? Infinity : def.durata };
  }
  if (/moltiplic/.test(testo)) {
    m = testo.match(/moltiplic\w*\D*(\d+)/);
    return { ...def, tipo: 'cloni', n: m ? Number(m[1]) : 4, variante: /arcobalen/.test(testo) ? 'arcobaleno' : 'militare' };
  }
  const velPerc = numero(/veloc\w*[^0-9%]*?(\d+(?:[.,]\d+)?)\s*%/);
  const velX = numero(/(\d+(?:[.,]\d+)?)\s*x\s+più veloce/);
  if (velPerc || velX) {
    const tiro = numero(/(?:tira|tiro)[^0-9%]*?(\d+)\s*%/);
    const veicolo = file || (/carrello/.test(testo) ? 'carrello' : /clown/.test(testo) ? 'clown' : null);
    return {
      ...def, tipo: 'velocita', mult: velX || 1 + velPerc / 100, tiroMult: tiro ? 1 + tiro / 100 : 1,
      veicolo, pioggia: /scarpe/.test(gra) ? 'scarpa' : null,
    };
  }
  if (/replica|non ha il controllo/.test(testo)) return { ...def, tipo: 'replica' };
  if (/banconot/.test(testo)) return { ...def, tipo: 'banconote' };
  if (/invertit/.test(testo)) return { ...def, tipo: 'confusione' };
  if (/magnete|incolla/.test(testo)) return { ...def, tipo: 'magnete' };
  if (/bandierin/.test(testo)) {
    // nel CSV la durata indica lo stordimento; la bandierina resta disponibile più a lungo
    return { ...def, tipo: 'bandierina', stordimento: p.durata || 3, durata: 20 };
  }
  if (/topolino|rimpicciol/.test(testo)) return { ...def, tipo: 'topolino', file: file || 'hackerino.png' };
  if (/potenza|scaravent/.test(testo)) {
    // la colonna GRAFICA decide l'aspetto: muscoli gonfi oppure volto rosso con occhi laser
    return { ...def, tipo: 'muscoli', aspetto: /rosso|laser|furia/.test(gra) ? 'furia' : 'muscoli' };
  }
  return { ...def, tipo: 'supertiro' };
}

// Oggetti indossati dal personaggio mentre il potere è attivo, letti dalla descrizione.
function analizzaAccessori(t) {
  const a = {};
  if (/corona/.test(t)) a.corona = true;
  if (/mantello rosso/.test(t)) a.mantelloRosso = true;
  if (/occhiali/.test(t)) a.occhiali = true;
  if (/note musicali/.test(t)) a.note = true;
  if (/chitarra/.test(t)) a.chitarra = true;
  if (/cappell\w*\s+rosso|cappello\s+a\s+punta/.test(t)) a.cappelloNano = true;
  if (/naso rosso/.test(t)) a.naso = true;
  if (/camice/.test(t)) a.camice = true;
  if (/felpa/.test(t)) a.felpa = /arancion/.test(t) ? '#f97316' : '#64748b';
  if (/giappones/.test(t)) a.fascia = true;
  if (/vendetta|maschera di v\b/.test(t)) a.mascheraV = true;
  if (/bandiera arcobaleno|bandiere arcobaleno/.test(t)) a.arcobaleno = true;
  return a;
}

// "maschera blu, mantello bianco e calzamaglia #2C32B2 con una N bianca" -> costume da supereroe
function analizzaCostume(grafica) {
  if (!/mantello|maschera|calzamaglia|costume/i.test(grafica)) return null;
  return {
    colore: (grafica.match(/#[0-9a-f]{6}/i) || ['#2c32b2'])[0].toLowerCase(),
    lettera: (grafica.match(/\b(?:una|la|lettera)\s+([A-Z])\b/) || [])[1] || '',
    mantello: /mantello/i.test(grafica),
    maschera: /maschera/i.test(grafica),
  };
}

let ultimoUidEffetto = 0;

class Effetto {
  constructor(partita, owner, def) {
    this.partita = partita;
    this.owner = owner;
    this.def = def;
    this.durata = def.durata;
    this.t = this.durata;
    this.finito = false;
    this.vittima = partita.avversarioDi(owner);
    this.uid = ++ultimoUidEffetto;
  }
  avvia() {
    const acc = this.def.acc || {};
    for (const k of Object.keys(acc)) this.owner.acc[k] = acc[k];
    this.inizia();
  }
  inizia() {}
  aggiorna(dt) {
    this.t -= dt;
    if (this.t <= 0) this.termina();
  }
  termina() {
    if (this.finito) return;
    this.finito = true;
    for (const k of Object.keys(this.def.acc || {})) delete this.owner.acc[k];
    this.fine();
  }
  fine() {}
  suGol() {}
  // livelli di disegno: dietro i giocatori, davanti a tutto, sopra lo schermo (sotto il tabellone)
  disegnaSotto() {}
  disegnaSopra() {}
  disegnaSchermo() {}
  // tutti i giocatori della squadra avversaria presenti in campo
  avversari() {
    return this.partita.giocatori.filter((g) => g.squadra !== this.owner.squadra);
  }
}

class EffettoVelocita extends Effetto {
  inizia() {
    this.owner.velMult = this.def.mult;
    this.owner.tiroMult = this.def.tiroMult || 1;
    this.owner.veicolo = this.def.veicolo || this.def.file || null;
  }
  aggiorna(dt) {
    super.aggiorna(dt);
    // Shopping compulsivo: dal cielo piovono scarpe griffate
    if (this.def.pioggia && !this.finito && Math.random() < dt * 30) {
      this.partita.particella('scarpa', rand(40, W - 40), -20, {
        vx: rand(-60, 60), vy: rand(80, 220), vita: rand(1.4, 2), vr: rand(-5, 5), colore: pick(['#ec4899', '#111827', '#f5c84b', '#dc2626', '#f8fafc']),
      });
    }
  }
  fine() {
    this.owner.velMult = 1;
    this.owner.tiroMult = 1;
    this.owner.veicolo = null;
  }
}

// Impassibile / Microbi: l'avversario rallenta (azzurrino come congelato, oppure verde e malato)
class EffettoRallenta extends Effetto {
  inizia() {
    const v = this.vittima;
    if (!v) return;
    v.lentezza = this.def.mult;
    v.gelo = !!this.def.gelo;
    v.malato = !!this.def.malato;
    if (v.malato) {
      Suoni.starnuto();
      for (let i = 0; i < 24; i++) {
        this.partita.particella('microbo', v.x + rand(-40, 40), v.y - rand(60, 170), { vx: rand(-80, 80), vy: rand(-80, 40), vita: rand(0.6, 1.2), r: rand(4, 8) });
      }
      return;
    }
    for (let i = 0; i < 30; i++) {
      const a = rand(0, Math.PI * 2);
      this.partita.particella('ghiaccio', v.x + Math.cos(a) * 30, v.y - 80 + Math.sin(a) * 50, {
        vx: Math.cos(a) * rand(60, 220), vy: Math.sin(a) * rand(60, 220), vita: rand(0.5, 1), vr: rand(-6, 6),
      });
    }
    Suoni.gelo();
  }
  aggiorna(dt) {
    super.aggiorna(dt);
    const v = this.vittima;
    if (v && !this.finito && Math.random() < dt * 8) {
      const tipo = v.malato ? 'microbo' : 'ghiaccio';
      this.partita.particella(tipo, v.x + rand(-30, 30), v.y - rand(20, 150), { vy: rand(-30, 10), vita: rand(0.4, 0.8), vr: rand(-3, 3), r: rand(3, 5) });
    }
  }
  fine() {
    if (!this.vittima) return;
    this.vittima.lentezza = 1;
    this.vittima.gelo = false;
    this.vittima.malato = false;
  }
}

// Captain Nexi: salto più alto e costume da supereroe
class EffettoSalto extends Effetto {
  inizia() {
    // l'altezza del salto cresce col quadrato della velocità iniziale
    this.owner.saltoMult = Math.sqrt(this.def.mult);
    this.owner.costume = this.def.costume;
  }
  fine() {
    this.owner.saltoMult = 1;
    this.owner.costume = null;
  }
}

class EffettoReplica extends Effetto {
  inizia() {
    this.owner.joypad = this.def.file || 'joypad.png';
    if (this.vittima) this.vittima.replicaDi = this.owner;
  }
  fine() {
    this.owner.joypad = null;
    if (this.vittima && this.vittima.replicaDi === this.owner) this.vittima.replicaDi = null;
  }
}

class EffettoBanconote extends Effetto {
  inizia() {
    this.partita.banconote[this.owner.squadra] = true;
    this.partita.pioggiaBanconote(this.owner.squadra);
  }
  fine() {
    this.partita.banconote[this.owner.squadra] = false;
  }
}

// personaggio da far comparire: uno del CSV, oppure uno "speciale" con la sua immagine (es. Maradona)
function personaggioAiutante(partita, id, file) {
  const p = partita.trovaPersonaggio(id);
  if (p) return p;
  const nome = id ? id.charAt(0).toUpperCase() + id.slice(1).toLowerCase() : 'Aiutante';
  return { id: nome, nome, testaFile: file && Risorse.img[file] ? file : null, pelle: '#c99674', potereDef: null };
}

// Cartoboys, Principessa di RoccaPiemonte, Forza Napoli, Letto di Paolo: compaiono uno o più aiutanti
class EffettoEvoca extends Effetto {
  inizia() {
    const p = this.partita;
    const d = this.def;
    const ids = d.chi && d.chi.length ? d.chi : [d.speciale || 'Aiutante'];
    const n = Math.max(1, d.n || 1);
    const ruoli = n === 1 ? [d.stats && d.stats.velMult ? 'attacco' : 'difesa'] : ['attacco', 'difesa', 'centro', 'attacco'];
    this.aiutanti = [];
    for (let i = 0; i < n; i++) {
      const pers = personaggioAiutante(p, ids[i % ids.length], d.file);
      const lato = i % 2 ? 1 : -1;
      const x = clamp(this.owner.x + lato * this.owner.dir * (110 + 70 * Math.floor(i / 2)), 80, W - 80);
      const a = p.evoca(pers, this.owner, x, ruoli[i % ruoli.length]);
      if (d.mini) a.scalaBase = 0.5;
      if (d.stats) Object.assign(a, d.stats);
      if (d.senzaMaglia) a.acc.senzaMaglia = true;
      this.aiutanti.push(a);
    }
  }
  fine() {
    this.aiutanti.forEach((a) => this.partita.congeda(a));
  }
}

// Amministrazione power / Leopardi Calcio: compaiono aiutanti che braccano l'avversario
class EffettoBracca extends Effetto {
  inizia() {
    const p = this.partita;
    const d = this.def;
    this.owner.scettro = !!d.scettro;
    let chi = (d.chi || []).filter((id) => chiaveId(id) !== chiaveId(this.owner.pers.id));
    if (d.animale) chi = Array.from({ length: d.n || 3 }, () => null);
    if (!chi.length) chi = ['Aiutante'];
    const bersaglio = this.vittima || this.owner;
    this.aiutanti = chi.map((id, i) => {
      const pers = d.animale
        ? { id: 'Leopardo', nome: 'Leopardo', animale: d.animale, pelle: '#e0a33a', potereDef: null }
        : p.trovaPersonaggio(id) || { id, nome: nomeCompleto(id), potereDef: null };
      const lato = i % 2 ? 1 : -1;
      const x = clamp(bersaglio.x + lato * (130 + 40 * Math.floor(i / 2)), 80, W - 80);
      const a = p.evoca(pers, this.owner, x, 'bracca');
      a.braccatore = true;
      a.lato = lato * (1 + 0.5 * Math.floor(i / 2));
      a.velMult = d.animale ? 1.35 : 1.1;
      if (d.animale) a.magliaFissa = '#1d4ed8';
      return a;
    });
    if (d.animale) Suoni.ruggito();
  }
  fine() {
    this.owner.scettro = false;
    this.aiutanti.forEach((a) => this.partita.congeda(a));
  }
}

// Comunismo (divisa militare) / LGBTQ (bandiera arcobaleno): il personaggio si moltiplica
class EffettoCloni extends Effetto {
  inizia() {
    const militare = this.def.variante !== 'arcobaleno';
    if (militare) this.owner.uniforme = 'militare';
    this.aiutanti = [];
    const ruoli = ['difesa', 'centro', 'attacco'];
    for (let i = 1; i < this.def.n; i++) {
      const x = clamp(this.owner.x + this.owner.dir * (i % 2 ? -1 : 1) * 90 * Math.ceil(i / 2), 80, W - 80);
      const clone = this.partita.evoca(this.owner.pers, this.owner, x, ruoli[(i - 1) % ruoli.length]);
      if (militare) clone.uniforme = 'militare';
      else clone.acc.arcobaleno = true;
      this.aiutanti.push(clone);
    }
  }
  fine() {
    this.owner.uniforme = null;
    this.aiutanti.forEach((a) => this.partita.congeda(a));
  }
}

class EffettoMuscoli extends Effetto {
  inizia() {
    this.owner.muscoli = true;
    this.owner.aspetto = this.def.aspetto || 'muscoli';
  }
  fine() {
    this.owner.muscoli = false;
    this.owner.aspetto = null;
  }
}

class EffettoConfusione extends Effetto {
  inizia() { if (this.vittima) this.vittima.confuso = true; }
  fine() { if (this.vittima) this.vittima.confuso = false; }
}

class EffettoMagnete extends Effetto {
  inizia() {
    this.owner.magnete = true;
    this.partita.pallone.inPancia = null;
    this.partita.pallone.incollatoA = this.owner;
  }
  fine() {
    this.owner.magnete = false;
    if (this.partita.pallone.incollatoA === this.owner) this.partita.pallone.incollatoA = null;
  }
  suGol() { this.termina(); }
}

class EffettoBandierina extends Effetto {
  inizia() {
    this.owner.bandiereDisponibili = 1;
    this.owner.effettoBandiera = this;
    this.piantata = null;
  }
  pianta() {
    if (this.owner.bandiereDisponibili <= 0) return;
    this.owner.bandiereDisponibili = 0;
    this.piantata = this.partita.piantaBandiera(this.owner, this.def.stordimento, this);
  }
  esplosa() { this.termina(); }
  fine() {
    this.owner.bandiereDisponibili = 0;
    this.owner.effettoBandiera = null;
    if (this.piantata) this.partita.rimuoviBandiera(this.piantata);
  }
}

class EffettoTopolino extends Effetto {
  inizia() { this.partita.pallone.topolino = this.owner; }
  fine() {
    this.partita.pallone.topolino = null;
    this.partita.giocatori.forEach((g) => { g.scalaRid = 1; });
  }
}

// Piscio Selvaggio: un getto giallo raggiunge l'avversario, che scivola verso la propria porta
class EffettoScivola extends Effetto {
  inizia() {
    this.volo = 0.45;
    this.getto = 0;
    this.colpito = false;
    Suoni.getto();
  }
  aggiorna(dt) {
    const v = this.vittima;
    if (!v) { this.termina(); return; }
    if (this.getto < 0.6) {
      this.getto += dt;
      const o = this.owner;
      const x0 = o.x + o.dir * 16, y0 = o.y - 42 * o.scala;
      const x1 = v.x, y1 = v.y - 40;
      const T = this.volo;
      const g = 900;
      for (let i = 0; i < 3; i++) {
        this.partita.particella('piscio', x0, y0, {
          vx: (x1 - x0) / T + rand(-30, 30),
          vy: (y1 - y0 - 0.5 * g * T * T) / T + rand(-30, 30),
          vita: T + 0.15, r: rand(3, 5.5),
        });
      }
    }
    if (!this.colpito) {
      if (this.getto < this.volo) return; // la durata parte quando il getto arriva
      this.colpito = true;
      v.scivola = this.durata;
      v.pozzaX = v.x;
      Suoni.splash();
    }
    super.aggiorna(dt);
  }
  fine() {
    if (this.vittima) this.vittima.scivola = 0;
  }
}

// Re del pesce: diventa un tritone e con la freccia giù si immerge sotto il campo
class EffettoSottacqua extends Effetto {
  inizia() { this.owner.tritone = true; }
  fine() {
    if (this.owner.sommerso) this.owner.emergi(false);
    this.owner.tritone = false;
  }
}

// Impazzisco: il pallone si moltiplica e i palloni riappaiono sulla traversa avversaria fino al prossimo gol
class EffettoMultipalla extends Effetto {
  inizia() {
    const p = this.partita;
    const b = p.pallone;
    b.incollatoA = null;
    b.inPancia = null;
    this.extra = [];
    const n = Math.max(2, this.def.n || 3);
    for (let i = 1; i < n; i++) {
      const nb = new Pallone();
      nb.x = b.x;
      nb.y = Math.min(b.y, GROUND - nb.r - 2);
      const a = -Math.PI / 2 + (i % 2 ? -1 : 1) * 0.8 * Math.ceil(i / 2);
      nb.vx = Math.cos(a) * 520;
      nb.vy = Math.sin(a) * 520;
      p.palloni.push(nb);
      this.extra.push(nb);
    }
    b.vy = Math.min(b.vy, -420);
    p.nuvola(b.x, b.y);
    Suoni.puff();
    this.attesa = 0.45;
  }
  aggiorna(dt) {
    if (this.attesa > 0) {
      this.attesa -= dt;
      if (this.attesa <= 0) this.teletrasporta();
    }
    super.aggiorna(dt);
  }
  teletrasporta() {
    const p = this.partita;
    const palloni = [p.pallone, ...this.extra];
    const destra = this.owner.squadra === 'sinistra'; // porta avversaria
    const bocca = destra ? W - GOAL_DEPTH : GOAL_DEPTH;
    const fondo = destra ? W : 0;
    palloni.forEach((b, i) => {
      p.nuvola(b.x, b.y);
      const u = palloni.length === 1 ? 0.5 : i / (palloni.length - 1);
      const verso = Math.sign(fondo - bocca);
      b.x = lerp(bocca + verso * b.r, fondo - verso * b.r, u);
      b.y = BAR_Y - BAR_R - b.r - 1;
      b.vx = 0;
      b.vy = 0;
      b.scia = [];
      b.incollatoA = null;
      b.inPancia = null;
      b.dolce = 1.2;
      p.nuvola(b.x, b.y);
    });
    Suoni.puff();
    this.partita.scossa = 0.2;
  }
  fine() {
    const extra = new Set(this.extra);
    this.partita.palloni = this.partita.palloni.filter((b) => !extra.has(b));
  }
  suGol() { this.termina(); }
}

class EffettoSupertiro extends Effetto {
  inizia() { this.owner.supertiro = this; }
  fine() { if (this.owner.supertiro === this) this.owner.supertiro = null; }
}

// ---------- mosse aggiunte a novembre 2026 ----------

// Pregnancy: il pallone viene risucchiato nella pancia e portato a spasso; Z/X lo sputa fuori
class EffettoPancia extends Effetto {
  inizia() {
    const b = this.partita.pallone;
    b.incollatoA = null;
    b.inPancia = null;
    b.attiratoDa = this.owner;
    this.preso = false;
    this.attesa = 1.2;
    Suoni.risucchio();
  }
  aggiorna(dt) {
    const b = this.partita.pallone;
    if (!this.preso) {
      this.attesa -= dt;
      if (b.inPancia === this.owner) {
        this.preso = true;
        Suoni.bip(300);
      } else if (this.attesa <= 0 || b.attiratoDa !== this.owner) {
        this.termina();
      }
      return; // la durata parte dalla cattura
    }
    if (b.inPancia !== this.owner) { this.termina(); return; } // sputato con un calcio
    super.aggiorna(dt);
  }
  fine() {
    const b = this.partita.pallone;
    if (b.attiratoDa === this.owner) b.attiratoDa = null;
    if (b.inPancia === this.owner) {
      b.inPancia = null;
      b.vx = this.owner.vx + this.owner.dir * 220;
      b.vy = -520;
    }
  }
  suGol() { this.termina(); }
  disegnaSopra(ctx) {
    const b = this.partita.pallone;
    const o = this.owner;
    if (b.inPancia !== o || o.invisibile) return;
    // pancione semitrasparente sopra il pallone: si vede che è "dentro"
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = o.coloriMaglia().maglia;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r * 1.35, b.r * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }
}

// Rock&Roll: suona malissimo e l'avversario può solo saltare e calciare
class EffettoRock extends Effetto {
  inizia() {
    this.vittime = this.avversari();
    this.vittime.forEach((v) => { v.soloSaltoCalcio = true; });
    this.prossimaNota = 0;
    this.prossimoAccordo = 0;
  }
  aggiorna(dt) {
    super.aggiorna(dt);
    if (this.finito) return;
    const o = this.owner;
    this.prossimaNota -= dt;
    if (this.prossimaNota <= 0) {
      this.prossimaNota = 0.12;
      this.partita.particella('nota', o.x + o.dir * 30, o.y - 70 * o.scala, { vx: o.dir * rand(120, 320), vy: rand(-160, -40), vita: rand(0.8, 1.3), colore: pick(['#f43f5e', '#facc15', '#a3e635', '#38bdf8']) });
    }
    this.prossimoAccordo -= dt;
    if (this.prossimoAccordo <= 0) {
      this.prossimoAccordo = 0.9;
      Suoni.chitarra();
    }
  }
  fine() {
    this.vittime.forEach((v) => { v.soloSaltoCalcio = false; });
  }
}

// Ue Cipollino / Gigantutino: diventa alto il doppio o il triplo (con un volto diverso se indicato)
class EffettoGigante extends Effetto {
  inizia() {
    this.owner.scalaPotere = this.def.k || 2;
    if (this.def.file && Risorse.img[this.def.file]) this.owner.testaAltFile = this.def.file;
    this.partita.nuvola(this.owner.x, this.owner.y - 100);
    Suoni.cresci();
  }
  fine() {
    this.owner.scalaPotere = 1;
    this.owner.testaAltFile = null;
    this.partita.nuvola(this.owner.x, this.owner.y - 100);
  }
}

// Gigantutone: diventa largo il triplo
class EffettoLargo extends Effetto {
  inizia() {
    this.owner.largoTarget = this.def.k || 3;
    Suoni.cresci();
  }
  fine() { this.owner.largoTarget = 1; }
}

// Nano Malefico: metà altezza, salta il doppio e corre il doppio
class EffettoNano extends Effetto {
  inizia() {
    const o = this.owner;
    const s = this.def.scala || 0.5;
    o.scalaPotere = s;
    o.velMult = this.def.vel || 2;
    // il salto dipende già dalla taglia (0.78 + 0.22 * scala): qui si compensa per ottenere l'altezza voluta
    o.saltoMult = Math.sqrt(this.def.saltoAltezza || 2) / (0.78 + 0.22 * s);
    this.partita.nuvola(o.x, o.y - 60);
    Suoni.restringi();
  }
  fine() {
    const o = this.owner;
    o.scalaPotere = 1;
    o.velMult = 1;
    o.saltoMult = 1;
  }
}

// K-POP / Japan: doppio tocco sulle frecce per uno scatto veloce
class EffettoDash extends Effetto {
  inizia() {
    this.owner.dash = { verticale: !!this.def.verticale };
    this.prossimaNota = 0;
  }
  aggiorna(dt) {
    super.aggiorna(dt);
    const o = this.owner;
    if (this.finito || !o.acc.note) return;
    this.prossimaNota -= dt;
    if (this.prossimaNota <= 0) {
      this.prossimaNota = 0.22;
      const a = rand(0, Math.PI * 2);
      this.partita.particella('nota', o.x + Math.cos(a) * 60 * o.scala, o.y - 90 * o.scala + Math.sin(a) * 60, { vx: rand(-30, 30), vy: rand(-90, -40), vita: rand(0.7, 1.1), colore: pick(['#f0abfc', '#67e8f9', '#fde047']) });
    }
  }
  fine() { this.owner.dash = null; }
}

// Data Center: dal terreno sbucano server che sbalzano in alto l'avversario
class EffettoServer extends Effetto {
  inizia() {
    this.server = [];
    this.prossimo = 0.25;
    this.ostacoli = [];
  }
  aggiorna(dt) {
    super.aggiorna(dt);
    if (this.finito) return;
    const v = this.vittima;
    this.prossimo -= dt;
    if (this.prossimo <= 0 && v && !v.invisibile && !v.sommerso) {
      this.prossimo = 1.5;
      const x = clamp(v.x + v.vx * 0.45, 60, W - 60);
      this.server.push({ x, t: 0, colpito: false });
      Suoni.allarme();
    }
    for (const s of this.server) {
      s.t += dt;
      const h = this.altezza(s);
      if (s.t > 0.55 && s.t < 0.8 && h > 40) {
        if (Math.random() < dt * 20) this.partita.particella('polvere', s.x + rand(-40, 40), GROUND - 4, { vx: rand(-200, 200), vy: rand(-300, -80), vita: 0.5, r: rand(4, 8) });
        if (!s.colpito) {
          for (const g of this.avversari()) {
            if (g.invisibile || g.sommerso) continue;
            if (Math.abs(g.x - s.x) < 52 + 30 * g.scala * g.largo && g.y > GROUND - h - 30) {
              s.colpito = true;
              g.y = Math.min(g.y, GROUND - h);
              g.vy = -1550;
              g.aTerra = false;
              g.stordito = Math.max(g.stordito, 0.6);
              g.giravolta = 0.8;
              Suoni.pugno();
              this.partita.scossa = 0.3;
            }
          }
        }
      }
    }
    this.server = this.server.filter((s) => s.t < 1.7);
    this.ostacoli = this.server.filter((s) => this.altezza(s) > 12).map((s) => {
      const h = this.altezza(s);
      return { tipo: 'server', rimbalzo: 0.5, spinta: (x, y, r) => spintaCerchioRett(x, y, r, s.x - 36, GROUND - h, 72, h) };
    });
  }
  altezza(s) {
    if (s.t < 0.55) return 0;
    if (s.t < 0.7) return 175 * ((s.t - 0.55) / 0.15);
    if (s.t < 1.35) return 175;
    return Math.max(0, 175 * (1 - (s.t - 1.35) / 0.3));
  }
  fine() {
    this.server = [];
    this.ostacoli = [];
  }
  disegnaSotto(ctx, t) {
    for (const s of this.server || []) {
      const h = this.altezza(s);
      if (s.t < 0.55) {
        // avviso: crepe lampeggianti nel terreno
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(s.t * 40);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let k = -2; k <= 2; k++) {
          ctx.moveTo(s.x + k * 12, GROUND + 2);
          ctx.lineTo(s.x + k * 18 + (k % 2 ? 6 : -6), GROUND + 12);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(251,191,36,0.25)';
        ctx.fillRect(s.x - 40, GROUND - 3, 80, 6);
        ctx.restore();
        continue;
      }
      disegnaRackServer(ctx, s.x, h, t);
    }
  }
}

function disegnaRackServer(ctx, x, h, t) {
  if (h <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 60, GROUND - h - 4, 120, h + 4);
  ctx.clip();
  const y0 = GROUND - 175;
  const sp = 175 - h; // il rack sale dal terreno: si vede solo la parte emersa
  ctx.translate(0, sp);
  const gr = ctx.createLinearGradient(x - 36, 0, x + 36, 0);
  gr.addColorStop(0, '#111827');
  gr.addColorStop(0.5, '#374151');
  gr.addColorStop(1, '#0b1220');
  ctx.fillStyle = gr;
  pathRett(ctx, x - 36, y0, 72, 175, 5);
  ctx.fill();
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const y = y0 + 10 + i * 23;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x - 30, y, 60, 17);
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(x - 26, y + 7, 30, 3);
    for (let k = 0; k < 3; k++) {
      const acceso = Math.sin(t * (7 + k * 3) + i * 1.7 + x) > -0.2;
      ctx.fillStyle = acceso ? (k === 0 ? '#22c55e' : k === 1 ? '#38bdf8' : '#f59e0b') : '#1e293b';
      ctx.beginPath();
      ctx.arc(x + 12 + k * 7, y + 8.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Sindrome della Cocozza / 5 euro sul comodino / Cercola Honey: l'avversario non può muoversi
class EffettoImmobilizza extends Effetto {
  inizia() {
    const v = this.vittima;
    if (!v) return;
    v.immobile += 1;
    v.forma = this.def.forma;
    v.vx = 0;
    if (this.def.forma === 'miele') {
      Suoni.splash();
    } else {
      this.partita.nuvola(v.x, v.y - 80);
      Suoni.magia();
    }
  }
  aggiorna(dt) {
    super.aggiorna(dt);
    const v = this.vittima;
    if (v && !this.finito && this.def.forma === 'miele' && Math.random() < dt * 14) {
      this.partita.particella('miele', v.x + rand(-34, 34) * v.scala, v.y - rand(20, 150) * v.scala, { vy: rand(40, 120), vita: rand(0.5, 0.9), r: rand(3, 6) });
    }
  }
  fine() {
    const v = this.vittima;
    if (!v) return;
    v.immobile = Math.max(0, v.immobile - 1);
    if (v.forma === this.def.forma) v.forma = null;
    if (this.def.forma !== 'miele') this.partita.nuvola(v.x, v.y - 80);
    Suoni.puff();
  }
  disegnaSopra(ctx, t) {
    const v = this.vittima;
    if (!v || this.def.forma !== 'miele') return;
    // cascata di miele che scende dall'alto sulla vittima
    const top = v.y - (v.alzo + 175) * v.scala;
    const lx = 30 * v.scala * v.largo;
    ctx.save();
    const gr = ctx.createLinearGradient(v.x - lx, 0, v.x + lx, 0);
    gr.addColorStop(0, 'rgba(217,119,6,0.75)');
    gr.addColorStop(0.5, 'rgba(252,211,77,0.85)');
    gr.addColorStop(1, 'rgba(217,119,6,0.75)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(v.x - lx * 0.6, 0);
    for (let y = 0; y <= top; y += 20) ctx.lineTo(v.x - lx * 0.6 + Math.sin(t * 6 + y * 0.05) * 4, y);
    ctx.lineTo(v.x + lx * 0.6 + Math.sin(t * 6 + top * 0.05) * 4, top);
    for (let y = top; y >= 0; y -= 20) ctx.lineTo(v.x + lx * 0.6 + Math.sin(t * 6 + y * 0.05 + 1) * 4, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(v.x - lx * 0.25, 0, 4, top);
    ctx.restore();
  }
}

// Licenziamento soft/strong: l'avversario scompare per qualche secondo
class EffettoScompare extends Effetto {
  inizia() {
    const v = this.vittima;
    if (!v) return;
    v.invisibile = true;
    v.calcio = null;
    this.partita.nuvola(v.x, v.y - 80);
    Suoni.puff();
    if (this.def.velSe && this.def.velSe !== 1) this.owner.velMult = this.def.velSe;
  }
  fine() {
    const v = this.vittima;
    if (this.def.velSe && this.def.velSe !== 1) this.owner.velMult = 1;
    if (!v) return;
    v.invisibile = false;
    this.partita.nuvola(v.x, v.y - 80);
    Suoni.puff();
  }
}

// Vieni Un Att: l'avversario si materializza nella porta di chi usa il potere e resta bloccato lì
class EffettoPorta extends Effetto {
  inizia() {
    const v = this.vittima;
    if (!v) return;
    this.partita.nuvola(v.x, v.y - 80);
    v.x = this.owner.squadra === 'sinistra' ? GOAL_DEPTH * 0.55 : W - GOAL_DEPTH * 0.55;
    v.y = GROUND;
    v.vx = 0;
    v.vy = 0;
    v.immobile += 1;
    v.bloccatoInPorta = true;
    this.partita.nuvola(v.x, v.y - 80);
    Suoni.magia();
  }
  aggiorna(dt) {
    super.aggiorna(dt);
    const v = this.vittima;
    if (v && !this.finito) v.x = this.owner.squadra === 'sinistra' ? GOAL_DEPTH * 0.55 : W - GOAL_DEPTH * 0.55;
  }
  fine() {
    const v = this.vittima;
    if (!v) return;
    v.immobile = Math.max(0, v.immobile - 1);
    v.bloccatoInPorta = false;
  }
}

// Indian power: una mandria di elefanti travolge l'avversario, che resta schiacciato a terra
class EffettoElefanti extends Effetto {
  inizia() {
    const v = this.vittima || this.owner;
    this.verso = Math.sign(v.x - this.owner.x) || this.owner.dir;
    const partenza = this.verso > 0 ? -220 : W + 220;
    this.elefanti = Array.from({ length: 4 }, (_, i) => ({ x: partenza - this.verso * i * 210, fase: rand(0, 6), s: rand(0.92, 1.08) }));
    this.colpito = false;
    this.schiacciato = this.def.durata;
    this.t = Infinity;
    Suoni.barrito();
  }
  aggiorna(dt) {
    const v = this.vittima;
    for (const e of this.elefanti) {
      e.x += this.verso * 760 * dt;
      e.fase += dt * 9;
      if (Math.random() < dt * 12) this.partita.particella('polvere', e.x - this.verso * 60, GROUND - 6, { vx: -this.verso * rand(60, 200), vy: rand(-140, -40), vita: rand(0.4, 0.8), r: rand(6, 11) });
      if (!this.colpito && v && !v.invisibile && !v.sommerso && Math.abs(e.x - v.x) < 90 && v.y > GROUND - 260) {
        this.colpito = true;
        v.immobile += 1;
        v.forma = 'schiacciato';
        v.vx = 0;
        v.vy = 0;
        v.y = GROUND;
        v.calcio = null;
        Suoni.pugno();
        this.partita.scossa = 0.45;
      }
    }
    if (this.colpito) {
      this.schiacciato -= dt;
      if (this.schiacciato <= 0) this.termina();
    } else if (this.elefanti.every((e) => (this.verso > 0 ? e.x > W + 260 : e.x < -260))) {
      this.termina();
    }
    if (Math.random() < dt * 1.5) Suoni.passi();
  }
  fine() {
    const v = this.vittima;
    if (this.colpito && v) {
      v.immobile = Math.max(0, v.immobile - 1);
      if (v.forma === 'schiacciato') v.forma = null;
      this.partita.nuvola(v.x, v.y - 30);
    }
    this.elefanti = [];
  }
  disegnaSopra(ctx, t) {
    for (const e of this.elefanti || []) {
      if (e.x < -300 || e.x > W + 300) continue;
      disegnaElefante(ctx, e.x, GROUND, this.verso, e.s, e.fase);
    }
  }
}

function disegnaElefante(ctx, x, y, verso, s, fase) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(verso * s, s);
  const grigio = '#8b8f99', scuro = '#6b6f78';
  // zampe
  for (const [lx, sf] of [[-52, 0], [-28, Math.PI], [30, Math.PI / 2], [54, -Math.PI / 2]]) {
    const sw = Math.sin(fase + sf) * 0.35;
    ctx.save();
    ctx.translate(lx, -70);
    ctx.rotate(sw);
    ctx.fillStyle = lx < 0 ? scuro : grigio;
    pathRett(ctx, -11, 0, 22, 70, 8);
    ctx.fill();
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(-11, 62, 22, 6);
    ctx.restore();
  }
  // corpo
  const gr = ctx.createLinearGradient(0, -170, 0, -60);
  gr.addColorStop(0, '#a3a8b3');
  gr.addColorStop(1, scuro);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.ellipse(0, -112, 86, 56, 0, 0, Math.PI * 2);
  ctx.fill();
  // coda
  ctx.strokeStyle = scuro;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-84, -120);
  ctx.quadraticCurveTo(-100, -95 + Math.sin(fase) * 6, -96, -78);
  ctx.stroke();
  // testa, orecchio e proboscide
  ctx.fillStyle = grigio;
  ctx.beginPath();
  ctx.ellipse(78, -128, 36, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.ellipse(62, -124, 22, 30, -0.2 + Math.sin(fase * 0.5) * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = grigio;
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(104, -118);
  ctx.quadraticCurveTo(128, -84, 116 + Math.sin(fase) * 8, -56);
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(96, -104);
  ctx.quadraticCurveTo(118, -96, 122, -110);
  ctx.lineTo(116, -112);
  ctx.quadraticCurveTo(110, -104, 98, -110);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(90, -138, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // gualdrappa e baldacchino
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath();
  ctx.moveTo(-44, -160);
  ctx.lineTo(40, -160);
  ctx.lineTo(48, -104);
  ctx.lineTo(-52, -104);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f5c84b';
  for (let i = -48; i < 46; i += 12) {
    ctx.beginPath();
    ctx.arc(i + 4, -104, 4, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillRect(-46, -164, 88, 6);
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-36, -164); ctx.lineTo(-36, -214);
  ctx.moveTo(32, -164); ctx.lineTo(32, -214);
  ctx.stroke();
  ctx.fillStyle = '#7c3aed';
  ctx.beginPath();
  ctx.moveTo(-48, -212);
  ctx.quadraticCurveTo(-2, -252, 44, -212);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f5c84b';
  ctx.beginPath();
  ctx.arc(-2, -238, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Risata stordente: all'avversario funziona un comando sì e i due successivi no
class EffettoSinghiozzo extends Effetto {
  inizia() {
    const v = this.vittima;
    if (!v) return;
    v.singhiozzo = { n: 0, muovi: 0, salta: false, giu: false, prima: null };
    v.stelline = true;
    this.prossimaRisata = 0;
    Suoni.risata();
  }
  aggiorna(dt) {
    super.aggiorna(dt);
    if (this.finito) return;
    this.prossimaRisata -= dt;
    if (this.prossimaRisata <= 0) {
      this.prossimaRisata = 0.35;
      const o = this.owner;
      this.partita.particella('risata', o.x + rand(-40, 40), o.y - 190 * o.scala, { vx: rand(-40, 40), vy: rand(-90, -50), vita: 1 });
    }
  }
  fine() {
    const v = this.vittima;
    if (!v) return;
    v.singhiozzo = null;
    v.stelline = false;
  }
}

// filtro dei comandi per Risata stordente (una pressione su tre va a segno)
function filtraSinghiozzo(s, i) {
  const prima = s.prima || INTENTO_VUOTO;
  const conta = () => (s.n++ % 3) === 0;
  if (i.muovi !== 0 && i.muovi !== prima.muovi) s.muovi = conta() ? i.muovi : 0;
  else if (i.muovi === 0) s.muovi = 0;
  if (i.salta && !prima.salta) s.salta = conta();
  else if (!i.salta) s.salta = false;
  if (i.giu && !prima.giu) s.giu = conta();
  else if (!i.giu) s.giu = false;
  const out = { ...i, muovi: s.muovi, salta: s.salta, giu: s.giu };
  for (const k of ['calcioAlto', 'calcioBasso', 'potere', 'bandiera', 'lancia']) if (i[k]) out[k] = conta();
  if (i.dashX || i.dashY) {
    if (!conta()) { out.dashX = 0; out.dashY = 0; }
  }
  s.prima = { muovi: i.muovi, salta: i.salta, giu: i.giu };
  return out;
}

// Mago di Oz: in vantaggio toglie secondi alla partita, in svantaggio li aggiunge
class EffettoTempo extends Effetto {
  inizia() {
    const p = this.partita;
    const mio = p.punteggio[this.owner.squadra];
    const suo = p.punteggio[this.owner.squadra === 'sinistra' ? 'destra' : 'sinistra'];
    const s = this.def.secondi || 10;
    this.delta = mio > suo ? -s : mio < suo ? s : 0;
    p.tempo = Math.max(1, p.tempo + this.delta);
    Suoni.cucu();
  }
  disegnaSopra(ctx, t) {
    const u = 1 - this.t / this.durata;
    const a = u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1;
    disegnaCucu(ctx, W / 2, 440, a, u, this.delta);
  }
}

function disegnaCucu(ctx, x, y, alpha, u, delta) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(x, y);
  const sc = easeOutBack(clamp(u * 6, 0, 1));
  ctx.scale(sc, sc);
  // casetta di legno
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.moveTo(-90, -60);
  ctx.lineTo(0, -140);
  ctx.lineTo(90, -60);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9a3412';
  pathRett(ctx, -72, -64, 144, 150, 8);
  ctx.fill();
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 4;
  ctx.stroke();
  // sportellino e uccellino
  ctx.fillStyle = '#1c0a03';
  ctx.fillRect(-16, -112, 32, 30);
  const fuori = Math.sin(clamp(u * 3, 0, 1) * Math.PI) * 34;
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(0, -98 + 0, 13, 10, 0, 0, Math.PI * 2);
  ctx.save();
  ctx.translate(0, fuori * 0.2);
  ctx.beginPath();
  ctx.arc(0, -96 - fuori * 0.3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(10, -98 - fuori * 0.3);
  ctx.lineTo(22, -95 - fuori * 0.3);
  ctx.lineTo(10, -92 - fuori * 0.3);
  ctx.fill();
  ctx.restore();
  // quadrante
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(0, 4, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 42, 4 + Math.sin(a) * 42);
    ctx.lineTo(Math.cos(a) * 48, 4 + Math.sin(a) * 48);
    ctx.stroke();
  }
  const giro = (delta < 0 ? -1 : 1) * u * Math.PI * 6;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(Math.cos(giro - Math.PI / 2) * 38, 4 + Math.sin(giro - Math.PI / 2) * 38);
  ctx.moveTo(0, 4);
  ctx.lineTo(Math.cos(giro / 12) * 24, 4 + Math.sin(giro / 12) * 24);
  ctx.stroke();
  // pendolo
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 3;
  const pa = Math.sin(u * 30) * 0.4;
  ctx.beginPath();
  ctx.moveTo(0, 86);
  ctx.lineTo(Math.sin(pa) * 50, 86 + Math.cos(pa) * 50);
  ctx.stroke();
  ctx.fillStyle = '#f5c84b';
  ctx.beginPath();
  ctx.arc(Math.sin(pa) * 50, 86 + Math.cos(pa) * 50, 10, 0, Math.PI * 2);
  ctx.fill();
  // testo
  const testo = delta < 0 ? `${delta} s` : delta > 0 ? `+${delta} s` : '± 0 s';
  ctx.font = '64px Bangers, Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#111';
  ctx.strokeText(testo, 150 * (testo.length > 5 ? 1.1 : 1), 0);
  ctx.fillStyle = delta < 0 ? '#fb7185' : delta > 0 ? '#86efac' : '#e2e8f0';
  ctx.fillText(testo, 150 * (testo.length > 5 ? 1.1 : 1), 0);
  ctx.restore();
}

// Shopping compulsivo usa EffettoVelocita (con carrello e pioggia di scarpe).

// Microbi usa EffettoRallenta (faccia verde e termometro).

// Mi piacciono i piedi: gli avversari perdono i piedi (solo colpi di testa), che finiscono in bocca a chi usa il potere
class EffettoPiedi extends Effetto {
  inizia() {
    this.vittime = this.avversari();
    this.vittime.forEach((v) => { v.senzaPiedi = true; v.calcio = null; });
    this.owner.acc.piediInBocca = true;
    Suoni.puff();
    for (const v of this.vittime) this.partita.nuvola(v.x, v.y - 10);
  }
  fine() {
    this.vittime.forEach((v) => { v.senzaPiedi = false; });
    delete this.owner.acc.piediInBocca;
  }
}

// Veggy kick / Papà ginecologo / Damabook: con C si lanciano oggetti che respingono l'avversario
class EffettoLancio extends Effetto {
  inizia() { this.owner.lancio = { tipo: this.def.proiettile || 'palla', cd: 0 }; }
  fine() { this.owner.lancio = null; }
}

// Gli Zingari: due ladruncoli corrono a rubare la barra del potere dell'avversario e la portano a chi li ha chiamati
class EffettoLadri extends Effetto {
  inizia() {
    const o = this.owner;
    this.ladri = [-1, 1].map((k) => ({ x: o.x + k * 40, fase: rand(0, 6), verso: o.dir }));
    this.stato = 'vai';
    this.bottino = 0;
    this.sicurezza = 9;
    Suoni.fischietto();
  }
  aggiorna(dt) {
    const v = this.vittima;
    this.sicurezza -= dt;
    if (!v || this.sicurezza <= 0) { this.termina(); return; }
    const meta = this.stato === 'vai' ? v.x : this.owner.x;
    let arrivati = 0;
    this.ladri.forEach((l, i) => {
      const bx = clamp(meta + (i ? 46 : -46), 30, W - 30);
      const dx = bx - l.x;
      l.verso = Math.sign(dx) || l.verso;
      l.x += clamp(dx, -960 * dt, 960 * dt);
      l.fase += dt * 18;
      if (Math.abs(dx) < 14) arrivati++;
    });
    if (arrivati === 2 && this.stato === 'vai') {
      if (v.potere && !v.potere.attivo) {
        this.bottino = v.potere.carica;
        v.potere.carica = 0;
      }
      this.stato = 'torna';
      Suoni.risucchio();
      this.partita.nuvola(v.x, v.y - 120);
    } else if (arrivati === 2 && this.stato === 'torna') {
      this.stato = 'fatto';
      this.termina();
    }
  }
  fine() {
    if (this.stato === 'fatto' && this.owner.potere) {
      // dopo pulisciEffetti la barra riprende a caricarsi partendo dal bottino
      this.owner.potere.carica = clamp(this.bottino, 0, 1);
      Suoni.bip(990);
    }
  }
  disegnaSopra(ctx, t) {
    for (const [i, l] of (this.ladri || []).entries()) {
      disegnaLadro(ctx, l.x, GROUND, l.verso, l.fase, this.stato === 'torna' && i === 0 ? this.bottino : null);
    }
  }
}

function disegnaLadro(ctx, x, y, verso, fase, bottino) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.85, 0.85);
  ctx.save();
  ctx.scale(verso, 1);
  ctx.lineCap = 'round';
  for (const k of [-1, 1]) {
    const a = Math.sin(fase) * 0.8 * k;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(Math.sin(a) * 30, -40 + Math.cos(a) * 36);
    ctx.stroke();
  }
  // maglia a righe
  ctx.fillStyle = '#f8fafc';
  pathRett(ctx, -16, -92, 32, 52, 10);
  ctx.fill();
  ctx.fillStyle = '#111827';
  for (let r = 0; r < 4; r++) ctx.fillRect(-16, -86 + r * 13, 32, 6);
  // sacco sulle spalle
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.ellipse(-22, -80, 14, 18, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // testa con passamontagna e mascherina
  ctx.fillStyle = '#e0ac69';
  ctx.beginPath();
  ctx.arc(0, -112, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(0, -116, 23, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  ctx.fillRect(-22, -118, 44, 10);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-8 + verso * 3, -113, 3.5, 0, Math.PI * 2);
  ctx.arc(8 + verso * 3, -113, 3.5, 0, Math.PI * 2);
  ctx.fill();
  if (bottino !== null) {
    // la barra del potere rubata, tenuta sopra la testa
    ctx.fillStyle = '#1f2937';
    pathRett(ctx, -46, -168, 92, 18, 9);
    ctx.fill();
    const gr = ctx.createLinearGradient(-44, 0, 44, 0);
    gr.addColorStop(0, '#b8860b');
    gr.addColorStop(1, '#ffe58a');
    ctx.fillStyle = gr;
    pathRett(ctx, -44, -166, Math.max(8, 88 * bottino), 14, 7);
    ctx.fill();
    ctx.font = '800 13px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.round(bottino * 100)}%`, 0, -174);
  }
  ctx.restore();
}

// SadasBI: si blocca tutto (avversari, tempo e pallone) tranne chi usa il potere
class EffettoCongela extends Effetto {
  inizia() {
    const p = this.partita;
    p.congelato = this.owner.squadra;
    this.avversari().forEach((g) => { g.congelato = true; g.calcio = null; });
    Suoni.gelo();
  }
  aggiorna(dt) {
    super.aggiorna(dt);
    // chi compare durante il blocco (es. aiutanti) resta bloccato anche lui
    if (!this.finito) this.avversari().forEach((g) => { g.congelato = true; });
  }
  fine() {
    const p = this.partita;
    if (p.congelato === this.owner.squadra) p.congelato = null;
    p.giocatori.forEach((g) => { g.congelato = false; });
  }
  disegnaSchermo(ctx, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(160,190,230,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(56,189,248,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < W; x += 80) { ctx.moveTo(x, 120); ctx.lineTo(x, H); }
    for (let y = 120; y < H; y += 80) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // cruscotto in un angolo
    const x0 = 40, y0 = 150;
    ctx.fillStyle = 'rgba(2,6,23,0.75)';
    pathRett(ctx, x0, y0, 250, 140, 14);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '800 20px Montserrat, sans-serif';
    ctx.fillStyle = '#e0f2fe';
    ctx.textBaseline = 'top';
    ctx.fillText('SadasBI', x0 + 16, y0 + 12);
    ctx.font = '600 12px Montserrat, sans-serif';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(`PAUSA ANALISI · ${Math.ceil(this.t)} s`, x0 + 16, y0 + 38);
    const barre = [0.5, 0.8, 0.35, 0.95, 0.6, 0.75];
    barre.forEach((h, i) => {
      const hh = 60 * h * (0.85 + 0.15 * Math.sin(t * 3 + i));
      ctx.fillStyle = i % 2 ? '#38bdf8' : '#f5c84b';
      ctx.fillRect(x0 + 18 + i * 36, y0 + 128 - hh, 24, hh);
    });
    ctx.restore();
  }
}

// Massimo Scalo: hackera il tabellone (+1 a sé, -1 all'avversario, mai sotto zero)
class EffettoHacker extends Effetto {
  inizia() {
    const p = this.partita;
    const mia = this.owner.squadra;
    const sua = mia === 'sinistra' ? 'destra' : 'sinistra';
    const n = this.def.gol || 1;
    p.punteggio[mia] += n;
    p.punteggio[sua] = Math.max(0, p.punteggio[sua] - n);
    p.glitch = 1.6;
    Suoni.hack();
    this.partita.stadio.esulta(mia, 1);
  }
}

// Prima donna: l'avversario vede tutto più scuro, lei è inquadrata da una testa mobile
class EffettoBuio extends Effetto {
  inizia() {
    this.vittime = this.avversari();
    this.vittime.forEach((v) => { v.accecato = true; });
    Suoni.riflettore();
  }
  fine() { this.vittime.forEach((v) => { v.accecato = false; }); }
  disegnaSopra(ctx, t) {
    const o = this.owner;
    if (o.invisibile) return;
    const lx = clamp(o.x * 0.6 + W * 0.2 + Math.sin(t * 1.3) * 40, 120, W - 120);
    const ly = 128;
    const tx = o.x, ty = o.y - 80 * o.scala;
    // cono di luce
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = Math.atan2(ty - ly, tx - lx);
    const d = Math.hypot(tx - lx, ty - ly) + 120;
    const gr = ctx.createLinearGradient(lx, ly, tx, ty);
    gr.addColorStop(0, 'rgba(255,250,220,0.55)');
    gr.addColorStop(1, 'rgba(255,250,220,0.10)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(lx + Math.cos(a + Math.PI / 2) * 10, ly + Math.sin(a + Math.PI / 2) * 10);
    ctx.lineTo(lx + Math.cos(a) * d + Math.cos(a + Math.PI / 2) * 110, ly + Math.sin(a) * d + Math.sin(a + Math.PI / 2) * 110);
    ctx.lineTo(lx + Math.cos(a) * d - Math.cos(a + Math.PI / 2) * 110, ly + Math.sin(a) * d - Math.sin(a + Math.PI / 2) * 110);
    ctx.lineTo(lx - Math.cos(a + Math.PI / 2) * 10, ly - Math.sin(a + Math.PI / 2) * 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // testa mobile del faro
    ctx.save();
    ctx.translate(lx, ly);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-26, -24, 52, 10);
    ctx.fillRect(-4, -16, 8, 12);
    ctx.rotate(a - Math.PI / 2);
    ctx.fillStyle = '#374151';
    pathRett(ctx, -18, -8, 36, 34, 6);
    ctx.fill();
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.ellipse(0, 26, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  disegnaSchermo(ctx) {
    // solo chi subisce il potere (sullo schermo di chi gioca) vede la patina grigia
    const loc = this.partita.locale;
    if (!loc || loc.squadra === this.owner.squadra) return;
    ctx.save();
    ctx.fillStyle = 'rgba(28,28,34,0.66)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// Inseminazione: cadono gocce bianche e compaiono mini cloni dell'avversario che giocano per chi usa il potere
class EffettoClonAvversari extends Effetto {
  inizia() {
    this.attesa = 0.8;
    this.aiutanti = [];
  }
  aggiorna(dt) {
    super.aggiorna(dt);
    if (this.finito) return;
    if (this.attesa > 0) {
      for (let i = 0; i < 4; i++) {
        this.partita.particella('goccia', rand(60, W - 60), rand(-20, 40), { vx: rand(-20, 20), vy: rand(200, 500), vita: rand(0.6, 1.1), r: rand(3, 5), colore: '#f8fafc' });
      }
      this.attesa -= dt;
      if (this.attesa <= 0) this.creaCloni();
    }
  }
  creaCloni() {
    const v = this.vittima;
    if (!v) return;
    const ruoli = ['attacco', 'centro', 'difesa'];
    for (let i = 0; i < (this.def.n || 3); i++) {
      const x = clamp(W / 2 + (i - 1) * 240, 80, W - 80);
      const c = this.partita.evoca(v.pers, this.owner, x, ruoli[i % 3]);
      c.scalaBase = 0.5;
      this.aiutanti.push(c);
    }
  }
  fine() {
    this.aiutanti.forEach((a) => this.partita.congeda(a));
  }
}

// Dentone Viaggiatore: il pallone diventa un mappamondo, più pesante e meno rimbalzante
class EffettoMappamondo extends Effetto {
  inizia() {
    this.partita.palloni.forEach((b) => { b.mappamondo = true; });
    this.partita.nuvola(this.partita.pallone.x, this.partita.pallone.y);
    Suoni.puff();
  }
  fine() { this.partita.palloni.forEach((b) => { b.mappamondo = false; }); }
}

// Dr Slide / Corporate slave: nessun beneficio, solo scena (campo arancione o felpa arancione)
class EffettoNessuno extends Effetto {
  inizia() {
    if (this.def.campo) this.partita.campoColore = this.def.campo;
    Suoni.bip(220);
  }
  fine() {
    if (this.def.campo && this.partita.campoColore === this.def.campo) this.partita.campoColore = null;
  }
}

const CLASSI_EFFETTO = {
  velocita: EffettoVelocita,
  rallenta: EffettoRallenta,
  salto: EffettoSalto,
  replica: EffettoReplica,
  banconote: EffettoBanconote,
  evoca: EffettoEvoca,
  bracca: EffettoBracca,
  cloni: EffettoCloni,
  muscoli: EffettoMuscoli,
  confusione: EffettoConfusione,
  magnete: EffettoMagnete,
  bandierina: EffettoBandierina,
  topolino: EffettoTopolino,
  scivola: EffettoScivola,
  sottacqua: EffettoSottacqua,
  multipalla: EffettoMultipalla,
  supertiro: EffettoSupertiro,
  pancia: EffettoPancia,
  rock: EffettoRock,
  gigante: EffettoGigante,
  largo: EffettoLargo,
  nano: EffettoNano,
  dash: EffettoDash,
  server: EffettoServer,
  immobilizza: EffettoImmobilizza,
  scompare: EffettoScompare,
  porta: EffettoPorta,
  elefanti: EffettoElefanti,
  singhiozzo: EffettoSinghiozzo,
  tempo: EffettoTempo,
  piedi: EffettoPiedi,
  lancio: EffettoLancio,
  ladri: EffettoLadri,
  congela: EffettoCongela,
  hacker: EffettoHacker,
  buio: EffettoBuio,
  clonavversari: EffettoClonAvversari,
  mappamondo: EffettoMappamondo,
  nessuno: EffettoNessuno,
};

// per ricostruire gli effetti dalla rete (il nome della classe viaggia nello stato)
const CLASSI_PER_NOME = Object.fromEntries(
  [Effetto, ...Object.values(CLASSI_EFFETTO)].map((C) => [C.name, C]),
);

// Forza Juve: prende il potere dell'avversario (che perde la carica) e lo usa al suo posto.
function potereRubato(partita, owner) {
  const vittima = partita.avversarioDi(owner);
  const suo = vittima && vittima.potere;
  if (!suo || suo.def.tipo === 'ruba') return { ...owner.potere.def, tipo: 'supertiro' };
  if (!suo.attivo) suo.carica = 0;
  return suo.def;
}

function creaEffetto(partita, owner) {
  let def = owner.potere.def;
  if (def.tipo === 'ruba') def = potereRubato(partita, owner);
  const Classe = CLASSI_EFFETTO[def.tipo] || EffettoSupertiro;
  return new Classe(partita, owner, def);
}
