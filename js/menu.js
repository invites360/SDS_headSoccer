'use strict';

function richiediSchermoIntero() {
  const el = document.documentElement;
  if (document.fullscreenElement) return;
  const f = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!f) return;
  try {
    const p = f.call(el, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* il browser può rifiutare: si gioca comunque */ }
}

function esciSchermoIntero() {
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

const $ = (sel) => document.querySelector(sel);

function testoDurata(def) {
  if (def.tipo === 'bandierina') return `Stordimento ${def.stordimento} s`;
  if (def.tipo === 'ruba') return 'Dura quanto il potere rubato';
  if (['ladri', 'hacker', 'tempo'].includes(def.tipo)) return 'Effetto immediato';
  if (!Number.isFinite(def.durata)) return 'Fino al prossimo gol';
  return `Durata ${def.durata} s`;
}

const App = {
  tutti: [],
  selezionabili: [],
  scelta: { umano: null, cpu: null },
  passo: 1,
  livello: 'normale',
  modo: 'cpu', // 'cpu' | 'online'
  stadio: null,
  partita: null,

  async init() {
    if (!Array.isArray(window.DATI_PERSONAGGI)) {
      $('#erroreDati').classList.remove('nascosto');
      return;
    }
    this.tutti = window.DATI_PERSONAGGI.map((p) => ({
      ...p,
      nome: nomeCompleto(p.id),
      chiave: chiaveId(p.id),
      potereDef: analizzaPotere(p.potere),
    }));
    this.selezionabili = this.tutti.filter((p) => p.foto);

    const grafiche = new Set(['hackerino.png', 'joypad.png', 'money.png']);
    this.tutti.forEach((p) => { if (p.potereDef && p.potereDef.file) grafiche.add(p.potereDef.file); });
    const font = Promise.all([
      document.fonts.load('300 32px Montserrat'),
      document.fonts.load('900 32px Montserrat'),
      document.fonts.load('italic 900 32px Montserrat'),
      document.fonts.load('32px Bangers'),
    ]).catch(() => {});
    await Promise.all([
      Risorse.precarica([...grafiche]),
      Risorse.caricaTeste(this.tutti.filter((p) => p.testa)),
      Promise.race([font, new Promise((ok) => setTimeout(ok, 2500))]),
    ]);

    this.costruisciGriglia();
    this.collegaEventi();
    Online.init();
    this.aggiornaUI();
  },

  cambiaModo(modo) {
    this.modo = modo;
    document.querySelectorAll('#modo button').forEach((b) => b.classList.toggle('attivo', b.dataset.modo === modo));
    if (modo === 'online') {
      this.passo = 1;
      Online.connetti();
    }
    this.aggiornaUI();
  },

  costruisciGriglia() {
    const griglia = $('#griglia');
    griglia.innerHTML = '';
    for (const p of this.selezionabili) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'carta';
      b.dataset.id = p.id;
      const img = document.createElement('img');
      img.src = Risorse.srcTesta(p.id);
      img.alt = p.nome;
      const nome = document.createElement('div');
      nome.className = 'nome';
      nome.textContent = p.nome;
      const potere = document.createElement('div');
      potere.className = p.potereDef ? 'potere' : 'potere vuoto';
      potere.textContent = p.potereDef ? p.potereDef.nome : 'Nessuna mossa finale';
      const segno = document.createElement('span');
      segno.className = 'segno';
      b.append(segno, img, nome, potere);
      if (!p.testa) {
        const avviso = document.createElement('div');
        avviso.className = 'avviso';
        avviso.textContent = 'foto non leggibile';
        b.append(avviso);
      }
      b.addEventListener('click', () => this.seleziona(p));
      b.addEventListener('mouseenter', () => { this.mostraDettaglio(p); this.mostraTooltip(p, b); });
      b.addEventListener('focus', () => { this.mostraDettaglio(p); this.mostraTooltip(p, b); });
      b.addEventListener('mouseleave', () => this.nascondiTooltip());
      b.addEventListener('blur', () => this.nascondiTooltip());
      griglia.append(b);
    }
    griglia.addEventListener('scroll', () => this.nascondiTooltip());
    window.addEventListener('scroll', () => this.nascondiTooltip(), true);
  },

  // riquadro con la descrizione completa della mossa finale, sopra (o sotto) la carta
  mostraTooltip(p, carta) {
    let tip = $('#tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'tooltip';
      tip.className = 'tooltip';
      tip.setAttribute('role', 'tooltip');
      document.body.append(tip);
    }
    tip.textContent = '';
    const riga = (classe, testo) => {
      const el = document.createElement('div');
      el.className = classe;
      el.textContent = testo;
      tip.append(el);
    };
    riga('tip-nome', p.nome);
    const def = p.potereDef;
    if (def) {
      riga('tip-potere', def.nome);
      riga('tip-effetto', def.effetto);
      if (p.potere && p.potere.grafica) riga('tip-grafica', p.potere.grafica);
      riga('tip-durata', testoDurata(def));
    } else {
      riga('tip-effetto vuoto', 'Nessuna mossa finale in ElencoMosse.csv.');
    }
    tip.classList.add('visibile');
    const r = carta.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const margine = 10;
    let top = r.top - t.height - margine;
    tip.classList.toggle('sotto', top < 8);
    if (top < 8) top = r.bottom + margine;
    const left = clamp(r.left + r.width / 2 - t.width / 2, 8, window.innerWidth - t.width - 8);
    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.setProperty('--freccia', `${Math.round(r.left + r.width / 2 - left)}px`);
  },

  nascondiTooltip() {
    const tip = $('#tooltip');
    if (tip) tip.classList.remove('visibile');
  },

  collegaEventi() {
    $('#passo1').addEventListener('click', () => this.vaiAlPasso(1));
    $('#passo2').addEventListener('click', () => this.vaiAlPasso(2));
    $('#slotUmano').addEventListener('click', () => this.vaiAlPasso(1));
    $('#slotCpu').addEventListener('click', () => this.vaiAlPasso(2));
    $('#btnGioca').addEventListener('click', () => this.avviaPartita());
    document.querySelectorAll('#modo button').forEach((b) => b.addEventListener('click', () => this.cambiaModo(b.dataset.modo)));
    document.querySelectorAll('#difficolta button').forEach((b) => {
      b.addEventListener('click', () => {
        this.livello = b.dataset.livello;
        document.querySelectorAll('#difficolta button').forEach((x) => x.classList.toggle('attivo', x === b));
      });
    });
    $('#griglia').addEventListener('keydown', (e) => this.navigaGriglia(e));
    $('#menu').addEventListener('keydown', (e) => {
      if (e.code === 'Backspace' && this.passo === 2 && e.target.tagName !== 'INPUT') this.vaiAlPasso(1);
    });
    $('#cerca').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      document.querySelectorAll('#griglia .carta').forEach((c) => {
        const p = this.selezionabili.find((x) => x.id === c.dataset.id);
        c.hidden = q !== '' && !`${p.nome} ${p.potereDef ? p.potereDef.nome : ''}`.toLowerCase().includes(q);
      });
    });
    $('#cerca').addEventListener('keydown', (e) => {
      const prima = this.carteVisibili()[0];
      if (!prima) return;
      if (e.code === 'ArrowDown') { e.preventDefault(); prima.focus(); }
      if (e.code === 'Enter') prima.click();
    });

    document.querySelectorAll('#partita [data-azione]').forEach((b) => {
      b.addEventListener('click', () => this.azione(b.dataset.azione));
    });
    document.addEventListener('fullscreenchange', () => {
      if (this.partita && !document.fullscreenElement && this.partita.stato !== 'fine') this.partita.pausa();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.partita) this.partita.pausa();
    });
  },

  carteVisibili() {
    return [...document.querySelectorAll('#griglia .carta')].filter((c) => !c.hidden);
  },

  navigaGriglia(e) {
    const carte = this.carteVisibili();
    const i = carte.indexOf(document.activeElement);
    if (i < 0) return;
    const colonne = carte.filter((c) => c.offsetTop === carte[0].offsetTop).length || 1;
    const passi = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: colonne, ArrowUp: -colonne };
    if (!(e.code in passi)) return;
    e.preventDefault();
    const j = clamp(i + passi[e.code], 0, carte.length - 1);
    carte[j].focus();
  },

  mostraDettaglio(p) {
    const d = $('#dettaglio');
    d.textContent = '';
    const nome = document.createElement('b');
    if (p.potereDef) {
      nome.textContent = p.potereDef.nome;
      d.append(`${p.nome} — `, nome, `: ${p.potereDef.effetto}`);
      d.append(` (${testoDurata(p.potereDef).toLowerCase()})`);
    } else {
      nome.textContent = p.nome;
      d.append(nome, ' non ha ancora una mossa finale in ElencoMosse.csv.');
    }
  },

  seleziona(p) {
    const cerca = $('#cerca');
    if (cerca.value) {
      cerca.value = '';
      cerca.dispatchEvent(new Event('input'));
    }
    if (this.modo === 'online') {
      this.scelta.umano = p;
      this.aggiornaUI();
      Online.aggiornaMioPersonaggio();
      return;
    }
    if (this.passo === 1) {
      this.scelta.umano = p;
      this.passo = 2;
    } else {
      this.scelta.cpu = p;
    }
    this.aggiornaUI();
    if (this.scelta.umano && this.scelta.cpu && this.passo === 2 && p === this.scelta.cpu) $('#btnGioca').focus();
  },

  vaiAlPasso(n) {
    this.passo = n;
    this.aggiornaUI();
  },

  aggiornaUI() {
    const online = this.modo === 'online';
    $('#passo1').classList.toggle('attivo', this.passo === 1);
    $('#passo2').classList.toggle('attivo', this.passo === 2);
    const conOnline = !!$('#pannelloOnline'); // la pagina di test non ha il pannello online
    $('#passo2').classList.toggle('nascosto', online);
    if (conOnline) {
      $('#pannelloCpu').classList.toggle('nascosto', online);
      $('#pannelloOnline').classList.toggle('nascosto', !online);
    }
    $('#titoloPasso').textContent = this.passo === 1 ? 'Scegli il tuo giocatore' : 'Scegli l\'avversario (CPU)';
    document.querySelectorAll('#griglia .carta').forEach((c) => {
      const u = this.scelta.umano && this.scelta.umano.id === c.dataset.id;
      const k = !online && this.scelta.cpu && this.scelta.cpu.id === c.dataset.id;
      c.classList.toggle('scelto-umano', !!u && !k);
      c.classList.toggle('scelto-cpu', !!k);
      c.querySelector('.segno').textContent = u && k ? 'TU · CPU' : u ? 'TU' : k ? 'CPU' : '';
      c.querySelector('.segno').style.display = u || k ? '' : 'none';
    });
    this.riempiSlot($('#slotUmano'), this.scelta.umano);
    this.riempiSlot($('#slotCpu'), this.scelta.cpu);
    if (conOnline) this.riempiSlot($('#slotOnlineMio'), this.scelta.umano);
    $('#btnGioca').disabled = !(this.scelta.umano && this.scelta.cpu);
  },

  riempiSlot(slot, p) {
    const testa = slot.querySelector('.slot-testa');
    testa.innerHTML = '';
    if (p) {
      const img = document.createElement('img');
      img.src = Risorse.srcTesta(p.id);
      img.alt = '';
      testa.append(img);
    }
    slot.querySelector('.slot-nome').textContent = p ? p.nome : '—';
    slot.querySelector('.slot-potere').textContent = p ? (p.potereDef ? p.potereDef.nome : 'Nessuna mossa finale') : '';
  },

  avviaPartita() {
    if (!this.scelta.umano || !this.scelta.cpu) return;
    Suoni.init();
    richiediSchermoIntero();
    $('#menu').classList.remove('attiva');
    $('#partita').classList.add('attiva');
    $('#pannelloPausa').classList.add('nascosto');
    $('#pannelloFine').classList.add('nascosto');
    if (!this.stadio) this.stadio = new Stadio();
    if (this.partita) this.partita.distruggi();
    this.partita = new Partita({
      canvas: $('#campo'),
      stadio: this.stadio,
      umano: this.scelta.umano,
      cpu: this.scelta.cpu,
      livello: this.livello,
      personaggi: this.tutti,
      eventi: {
        pausa: () => this.mostraPausa(),
        riprendi: () => this.azione('riprendi'),
        fine: (punteggio) => this.mostraFine(punteggio),
        rivincita: () => this.azione('rivincita'),
        esci: () => this.azione('esci'),
      },
    });
  },

  // partita online: modo 'host' oppure 'ospite' (chiamata da Online)
  avviaPartitaOnline({ modo, umano, cpu, controlloRemoto = null, nomi }) {
    Suoni.init();
    richiediSchermoIntero();
    $('#menu').classList.remove('attiva');
    $('#partita').classList.add('attiva');
    this.nascondiPannelli();
    if (!this.stadio) this.stadio = new Stadio();
    if (this.partita) this.partita.distruggi();
    this.partitaUmano = umano;
    this.partitaCpu = cpu;
    this.partita = new Partita({
      canvas: $('#campo'),
      stadio: this.stadio,
      umano,
      cpu,
      livello: 'normale',
      personaggi: this.tutti,
      modo,
      nomi,
      controlloRemoto,
      eventi: {
        pausa: () => this.mostraPausa(),
        riprendi: () => this.azione('riprendi'),
        fine: (punteggio) => Online.fine(punteggio),
        rivincita: () => this.azione('rivincita'),
        esci: () => this.azione('esci'),
      },
    });
    return this.partita;
  },

  nascondiPannelli() {
    $('#pannelloPausa').classList.add('nascosto');
    $('#pannelloFine').classList.add('nascosto');
  },

  // torna al menu senza toccare la scelta dei personaggi
  esciDallaPartita() {
    if (this.partita) this.partita.distruggi();
    this.partita = null;
    esciSchermoIntero();
    this.nascondiPannelli();
    $('#partita').classList.remove('attiva');
    $('#menu').classList.add('attiva');
    this.aggiornaUI();
  },

  mostraPausa() {
    const online = this.partita && this.partita.modo !== 'cpu';
    $('#notaPausa').textContent = online
      ? 'La partita online non si ferma: puoi tornare a giocare o abbandonarla.'
      : document.fullscreenElement
        ? 'Premi P per riprendere.'
        : 'Sei uscito dallo schermo intero: riprendi per tornarci.';
    document.querySelector('#pannelloPausa [data-azione="ricomincia"]').classList.toggle('nascosto', online);
    document.querySelector('#pannelloPausa [data-azione="esci"]').textContent = online ? 'Abbandona la partita' : 'Torna alla scelta';
    $('#pannelloPausa').classList.remove('nascosto');
  },

  mostraFine(punteggio) {
    const p = this.partita;
    const mia = p && p.locale ? p.locale.squadra : 'sinistra';
    const sua = mia === 'sinistra' ? 'destra' : 'sinistra';
    const io = punteggio[mia], lui = punteggio[sua];
    const { sinistra, destra } = punteggio;
    const esito = $('#esito');
    if (io > lui) { esito.textContent = 'HAI VINTO!'; esito.style.color = '#f5c84b'; }
    else if (io < lui) { esito.textContent = 'HAI PERSO'; esito.style.color = '#fb7185'; }
    else { esito.textContent = 'PAREGGIO'; esito.style.color = '#e2e8f0'; }
    const online = p && p.modo !== 'cpu';
    $('#notaFine').textContent = '';
    document.querySelector('#pannelloFine [data-azione="esci"]').firstChild.textContent = online ? 'Esci dalla partita ' : 'Cambia giocatori ';
    const r = $('#risultato');
    r.innerHTML = '';
    const testa = (p) => {
      const img = document.createElement('img');
      img.src = Risorse.srcTesta(p.id);
      img.alt = p.nome;
      img.title = p.nome;
      return img;
    };
    const num = (n) => Object.assign(document.createElement('span'), { textContent: String(n) });
    const trattino = Object.assign(document.createElement('span'), { textContent: '–', className: 'trattino' });
    const persSx = online ? this.partitaUmano : this.scelta.umano;
    const persDx = online ? this.partitaCpu : this.scelta.cpu;
    r.append(testa(persSx), num(sinistra), trattino, num(destra), testa(persDx));
    $('#pannelloFine').classList.remove('nascosto');
  },

  azione(nome) {
    const p = this.partita;
    if (!p) return;
    if (p.modo !== 'cpu') {
      // partita online
      if (nome === 'riprendi') $('#pannelloPausa').classList.add('nascosto');
      else if (nome === 'rivincita') Online.votaRivincita();
      else if (nome === 'esci') Online.abbandona();
      return;
    }
    switch (nome) {
      case 'riprendi':
        $('#pannelloPausa').classList.add('nascosto');
        richiediSchermoIntero();
        p.riprendi();
        break;
      case 'ricomincia':
      case 'rivincita':
        $('#pannelloPausa').classList.add('nascosto');
        $('#pannelloFine').classList.add('nascosto');
        richiediSchermoIntero();
        p.nuovaPartita();
        p.riprendi();
        break;
      case 'esci':
        p.distruggi();
        this.partita = null;
        esciSchermoIntero();
        $('#partita').classList.remove('attiva');
        $('#menu').classList.add('attiva');
        this.passo = 1;
        this.aggiornaUI();
        break;
    }
  },
};

App.init();
