'use strict';

// ===================== MULTIPLAYER ONLINE =====================
// Elenco stanze e messaggi passano da un broker MQTT pubblico (nessun server da installare).
// La partita usa, se possibile, una connessione diretta WebRTC tra i due PC; altrimenti resta sul broker.
// L'host simula la partita e manda lo stato all'ospite; l'ospite manda solo i tasti premuti.

const RETE_CONFIG = {
  broker: [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081',
  ],
  radice: 'headsoccer-sadas-7f3k/v1',
  stun: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
  stanzaScaduta: 95000,  // ms: una stanza non rinnovata da più tempo è considerata chiusa
  rinnovoStanza: 30000,
};

function nuovoCodice() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return s;
}

// ---------- collegamento al broker ----------

class Rete {
  constructor() {
    this.id = nuovoCodice();
    this.client = null;
    this.stato = 'spento'; // spento | connessione | connesso | errore
    this.broker = null;
    this.stanze = new Map();
    this.onStanze = null;
    this.onMessaggio = null;
    this.onStato = null;
  }

  topic(...parti) { return [RETE_CONFIG.radice, ...parti].join('/'); }

  impostaStato(s) {
    this.stato = s;
    if (this.onStato) this.onStato(s);
  }

  async connetti() {
    if (this.stato === 'connesso' || this.stato === 'connessione') return this.attesa;
    if (typeof mqtt === 'undefined') {
      this.impostaStato('errore');
      throw new Error('libreria MQTT non caricata');
    }
    this.impostaStato('connessione');
    this.attesa = (async () => {
      for (const url of RETE_CONFIG.broker) {
        try {
          await this.provaBroker(url);
          this.broker = url;
          this.impostaStato('connesso');
          return;
        } catch (e) {
          console.warn('Broker non raggiungibile', url, e && e.message);
        }
      }
      this.impostaStato('errore');
      throw new Error('nessun server raggiungibile');
    })();
    return this.attesa;
  }

  provaBroker(url) {
    return new Promise((ok, ko) => {
      const client = mqtt.connect(url, {
        clientId: `hss_${this.id}_${Math.random().toString(36).slice(2, 7)}`,
        clean: true,
        connectTimeout: 6000,
        reconnectPeriod: 0,
        keepalive: 20,
        // se il browser si chiude di colpo il broker cancella da solo la stanza
        will: { topic: this.topic('stanze', this.id), payload: '', retain: true, qos: 1 },
      });
      const timer = setTimeout(() => { client.end(true); ko(new Error('timeout')); }, 8000);
      client.once('connect', () => {
        clearTimeout(timer);
        client.options.reconnectPeriod = 3000;
        this.client = client;
        client.subscribe([this.topic('stanze', '+'), this.topic('c', this.id)], { qos: 0 });
        client.on('message', (t, payload) => this.ricevi(t, payload));
        client.on('connect', () => this.impostaStato('connesso'));
        client.on('offline', () => this.impostaStato('connessione'));
        ok();
      });
      client.once('error', (e) => {
        clearTimeout(timer);
        client.end(true);
        ko(e);
      });
    });
  }

  ricevi(topic, payload) {
    const testo = payload ? payload.toString() : '';
    const parti = topic.split('/');
    const tipo = parti[parti.length - 2];
    const id = parti[parti.length - 1];
    if (tipo === 'stanze') {
      // il broker può consegnare gli annunci fuori ordine: vale sempre il più recente (orario dell'host)
      this.ultimoTs = this.ultimoTs || new Map();
      if (!testo) {
        const vecchia = this.stanze.get(id);
        if (vecchia) this.ultimoTs.set(id, Math.max(this.ultimoTs.get(id) || 0, vecchia.ts || 0));
        this.stanze.delete(id);
      } else {
        let info;
        try { info = JSON.parse(testo); } catch (e) { return; }
        if ((info.ts || 0) <= (this.ultimoTs.get(id) || 0)) return;
        this.ultimoTs.set(id, info.ts || 0);
        this.stanze.set(id, { ...info, id });
      }
      if (this.onStanze) this.onStanze();
      return;
    }
    if (tipo === 'c' && id === this.id && testo) {
      let m;
      try { m = JSON.parse(testo); } catch (e) { return; }
      if (this.onMessaggio) this.onMessaggio(m);
    }
  }

  stanzeAperte() {
    const ora = Date.now();
    return [...this.stanze.values()]
      .filter((s) => s.id !== this.id && !s.chiusa && ora - (s.ts || 0) < RETE_CONFIG.stanzaScaduta)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

  pubblicaStanza(info) {
    if (!this.client) return;
    // orario sempre crescente, anche con due annunci nello stesso millisecondo
    this.tsStanza = Math.max(Date.now(), (this.tsStanza || 0) + 1);
    this.client.publish(this.topic('stanze', this.id), JSON.stringify({ ...info, ts: this.tsStanza }), { retain: true, qos: 1 });
  }

  rimuoviStanza() {
    if (!this.client) return;
    // prima un annuncio "chiusa" con orario (vince su eventuali annunci vecchi in ritardo), poi la cancellazione
    this.pubblicaStanza({ chiusa: true });
    const client = this.client;
    setTimeout(() => { if (client.connected) client.publish(this.topic('stanze', this.id), '', { retain: true, qos: 1 }); }, 1500);
  }

  invia(id, msg) {
    if (!this.client) return;
    this.client.publish(this.topic('c', id), JSON.stringify({ ...msg, da: this.id }), { qos: 0 });
  }

  chiudi() {
    if (this.client) this.client.end(true);
    this.client = null;
    this.impostaStato('spento');
  }
}

// ---------- canale tra i due giocatori (WebRTC diretto, altrimenti via broker) ----------

class Canale {
  constructor(rete, altro, iniziatore) {
    this.rete = rete;
    this.altro = altro;
    this.iniziatore = iniziatore;
    this.pc = null;
    this.dc = null;
    this.icePendenti = [];
    this.onMessaggio = null;
    this.onChiuso = null;
    this.onCambio = null;
    this.chiuso = false;
    this.diretto = false;
    this.ultimoRx = performance.now();
    this.battito = setInterval(() => this.controlla(), 1000);
    this.avviaRtc();
  }

  avviaRtc() {
    if (typeof RTCPeerConnection === 'undefined') return;
    try {
      this.pc = new RTCPeerConnection({ iceServers: RETE_CONFIG.stun });
      this.pc.onicecandidate = (e) => {
        if (e.candidate) this.rete.invia(this.altro, { tipo: 'rtc', ice: e.candidate.toJSON() });
      };
      if (this.iniziatore) {
        this.impostaDc(this.pc.createDataChannel('gioco', { ordered: true }));
        this.offri();
      } else {
        this.pc.ondatachannel = (e) => this.impostaDc(e.channel);
      }
    } catch (e) {
      console.warn('WebRTC non disponibile', e);
      this.pc = null;
    }
  }

  async offri() {
    try {
      const offerta = await this.pc.createOffer();
      await this.pc.setLocalDescription(offerta);
      this.rete.invia(this.altro, { tipo: 'rtc', sdp: { type: offerta.type, sdp: this.pc.localDescription.sdp } });
    } catch (e) { console.warn('offerta WebRTC', e); }
  }

  async gestisciRtc(m) {
    if (!this.pc || this.chiuso) return;
    try {
      if (m.sdp) {
        await this.pc.setRemoteDescription(m.sdp);
        if (m.sdp.type === 'offer') {
          const risposta = await this.pc.createAnswer();
          await this.pc.setLocalDescription(risposta);
          this.rete.invia(this.altro, { tipo: 'rtc', sdp: { type: risposta.type, sdp: this.pc.localDescription.sdp } });
        }
        for (const c of this.icePendenti) await this.pc.addIceCandidate(c);
        this.icePendenti = [];
      } else if (m.ice) {
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(m.ice);
        else this.icePendenti.push(m.ice);
      }
    } catch (e) { console.warn('segnalazione WebRTC', e); }
  }

  impostaDc(dc) {
    this.dc = dc;
    dc.onopen = () => { this.diretto = true; if (this.onCambio) this.onCambio(); };
    dc.onclose = () => { this.diretto = false; if (this.onCambio) this.onCambio(); };
    dc.onmessage = (e) => {
      try { this.ricevi(JSON.parse(e.data)); } catch (err) { console.warn(err); }
    };
  }

  invia(msg) {
    if (this.chiuso) return;
    if (this.dc && this.dc.readyState === 'open') {
      try {
        this.dc.send(JSON.stringify(msg));
        return;
      } catch (e) { /* si ripiega sul broker */ }
    }
    this.rete.invia(this.altro, { tipo: 'g', m: msg });
  }

  ricevi(msg) {
    this.ultimoRx = performance.now();
    if (msg.tipo === 'ping') return;
    if (this.onMessaggio) this.onMessaggio(msg);
  }

  controlla() {
    this.invia({ tipo: 'ping' });
    if (performance.now() - this.ultimoRx > 10000) this.chiudi('timeout');
  }

  chiudi(motivo = 'chiuso') {
    if (this.chiuso) return;
    this.chiuso = true;
    clearInterval(this.battito);
    try { if (this.dc) this.dc.close(); } catch (e) { /* già chiuso */ }
    try { if (this.pc) this.pc.close(); } catch (e) { /* già chiuso */ }
    if (this.onChiuso) this.onChiuso(motivo);
  }
}

// ---------- stato della partita: serializzazione a differenze ----------

const Sync = {
  escludi: new Set(['partita', 'pers', 'colori', 'testa', 'tinte', 'comando', 'calcioPrenotato', 'previsione',
    'previsioneT', 'scia', 'ostacoli']),
  chiaviPartita: ['t', 'stato', 'timerStato', 'timerFine', 'tempo', 'punteggio', 'banconote', 'msgGol', 'msgPotere',
    'msgVia', 'scossa', 'tempoGioco', 'campoColore', 'congelato', 'glitch', 'bandiere', 'proiettili'],

  codifica(v, ctx, prof = 0) {
    if (v === null) return null;
    const t = typeof v;
    if (t === 'number') {
      if (Number.isFinite(v)) return Math.round(v * 100) / 100;
      return v > 0 ? '$inf' : v < 0 ? '$-inf' : 0;
    }
    if (t === 'string' || t === 'boolean') return v;
    if (t !== 'object') return undefined;
    if (v instanceof Giocatore) return { $g: ctx.giocatori.indexOf(v) };
    if (v instanceof Pallone) return { $b: ctx.palloni.indexOf(v) };
    if (v instanceof Effetto) return { $e: v.uid };
    if (prof > 5 || v instanceof HTMLElement || v instanceof Map || v instanceof Set) return undefined;
    if (Array.isArray(v)) {
      return v.map((x) => {
        const c = Sync.codifica(x, ctx, prof + 1);
        return c === undefined ? null : c;
      });
    }
    return Sync.campi(v, ctx, prof);
  },

  // i campi di un oggetto (anche di un Giocatore, Pallone o Effetto, che altrove viaggiano come riferimenti)
  campi(v, ctx, prof = 0) {
    const o = {};
    for (const k of Object.keys(v)) {
      if (Sync.escludi.has(k)) continue;
      const c = Sync.codifica(v[k], ctx, prof + 1);
      if (c !== undefined) o[k] = c;
    }
    return o;
  },

  fotografa(p) {
    const ctx = { giocatori: p.giocatori, palloni: p.palloni };
    const stato = { p: {}, g: [], b: [], e: [], s: { ...p.stadio.ecc } };
    for (const k of Sync.chiaviPartita) {
      const c = Sync.codifica(p[k], ctx, 1);
      stato.p[k] = c === undefined ? null : c;
    }
    stato.g = p.giocatori.map((g) => {
      const d = Sync.campi(g, ctx);
      d.$pers = { id: g.pers.id, testaFile: g.pers.testaFile || null, animale: g.pers.animale || null, pelle: g.pers.pelle || null };
      return d;
    });
    stato.b = p.palloni.map((b) => Sync.campi(b, ctx));
    stato.e = p.effetti.map((e) => {
      const d = Sync.campi(e, ctx);
      d.$cls = e.constructor.name;
      return d;
    });
    return stato;
  },

  // differenza tra due alberi JSON: solo ciò che è cambiato
  diff(a, b) {
    if (a === b) return undefined;
    const oa = a !== null && typeof a === 'object';
    const ob = b !== null && typeof b === 'object';
    if (!ob) return b;
    if (!oa || Array.isArray(a) !== Array.isArray(b)) return { $v: b };
    const out = { $p: 1 };
    let cambi = false;
    if (Array.isArray(b)) {
      if (a.length !== b.length) { out.$l = b.length; cambi = true; }
      for (let i = 0; i < b.length; i++) {
        const d = Sync.diff(a[i], b[i]);
        if (d !== undefined) { out[i] = d; cambi = true; }
      }
    } else {
      for (const k of Object.keys(b)) {
        const d = Sync.diff(a[k], b[k]);
        if (d !== undefined) { out[k] = d; cambi = true; }
      }
      for (const k of Object.keys(a)) {
        if (!(k in b)) { out[k] = { $d: 1 }; cambi = true; }
      }
    }
    return cambi ? out : undefined;
  },

  applica(a, p) {
    if (p === null || typeof p !== 'object') return p;
    if (p.$v !== undefined) return JSON.parse(JSON.stringify(p.$v));
    if (!p.$p) return p;
    let t = a;
    if (t === null || typeof t !== 'object') t = '$l' in p ? [] : {};
    for (const k of Object.keys(p)) {
      if (k === '$p' || k === '$l') continue;
      const v = p[k];
      if (v && typeof v === 'object' && v.$d) {
        if (Array.isArray(t)) t[k] = null; else delete t[k];
      } else {
        t[k] = Sync.applica(t[k], v);
      }
    }
    if ('$l' in p) t.length = p.$l;
    return t;
  },

  decodifica(v, ctx) {
    if (v === '$inf') return Infinity;
    if (v === '$-inf') return -Infinity;
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map((x) => Sync.decodifica(x, ctx));
    if ('$g' in v) return ctx.giocatori[v.$g] || null;
    if ('$b' in v) return ctx.palloni[v.$b] || null;
    if ('$e' in v) return ctx.effetti.get(v.$e) || true;
    const o = {};
    for (const k of Object.keys(v)) o[k] = Sync.decodifica(v[k], ctx);
    return o;
  },

  persDa(partita, d) {
    if (d.animale) return { id: d.id, nome: d.id, animale: d.animale, pelle: d.pelle, potereDef: null };
    return partita.trovaPersonaggio(d.id) || { id: d.id, nome: nomeCompleto(d.id), testaFile: d.testaFile, pelle: d.pelle, potereDef: null };
  },

  // ricostruisce sullo schermo dell'ospite giocatori, palloni ed effetti descritti dallo stato
  materializza(partita, stato) {
    const gs = stato.g || [];
    const giocatori = gs.map((d, i) => {
      let g = partita.giocatori[i];
      if (!g || g.pers.id !== d.$pers.id || g.squadra !== d.squadra || g.aiutante !== d.aiutante) {
        g = new Giocatore(partita, Sync.persDa(partita, d.$pers), d.squadra, { aiutante: d.aiutante });
      }
      return g;
    });
    const palloni = (stato.b || []).map((d, i) => (partita.palloni[i] instanceof Pallone ? partita.palloni[i] : new Pallone()));
    const vecchi = new Map(partita.effetti.map((e) => [e.uid, e]));
    const effetti = new Map();
    const elenco = (stato.e || []).map((d) => {
      let e = vecchi.get(d.uid);
      const C = CLASSI_PER_NOME[d.$cls] || Effetto;
      if (!e || !(e instanceof C) || e.constructor !== C) e = Object.create(C.prototype);
      effetti.set(d.uid, e);
      return e;
    });
    const ctx = { giocatori, palloni, effetti };
    const assegna = (obj, d) => {
      for (const k of Object.keys(d)) {
        if (k[0] === '$') continue;
        obj[k] = Sync.decodifica(d[k], ctx);
      }
    };
    giocatori.forEach((g, i) => assegna(g, gs[i]));
    palloni.forEach((b, i) => assegna(b, stato.b[i]));
    elenco.forEach((e, i) => { assegna(e, stato.e[i]); e.partita = partita; });
    partita.giocatori = giocatori;
    partita.umano = giocatori[0] || partita.umano;
    partita.cpu = giocatori[1] || partita.cpu;
    partita.palloni = palloni.length ? palloni : partita.palloni;
    partita.effetti = elenco;
    for (const k of Sync.chiaviPartita) {
      if (stato.p && k in stato.p) partita[k] = Sync.decodifica(stato.p[k], ctx);
    }
    if (!Array.isArray(partita.bandiere)) partita.bandiere = [];
    if (!Array.isArray(partita.proiettili)) partita.proiettili = [];
    if (stato.s) Object.assign(partita.stadio.ecc, stato.s);
  },
};

// sull'host: comandi del giocatore remoto (tasti tenuti + pressioni da usare una volta sola)
class ControlloRemoto {
  constructor() {
    this.tenuti = { muovi: 0, salta: false, giu: false };
    this.colpi = [];
  }
  ricevi(m) {
    this.tenuti = { muovi: clamp(m.muovi | 0, -1, 1), salta: !!m.salta, giu: !!m.giu };
    if (Array.isArray(m.c)) this.colpi.push(...m.c.slice(0, 10));
  }
  pensa() {
    const i = { ...INTENTO_VUOTO, ...this.tenuti };
    for (const c of this.colpi) {
      if (['calcioAlto', 'calcioBasso', 'potere', 'bandiera', 'lancia'].includes(c)) i[c] = true;
      else if (c === 'dx+') i.dashX = 1;
      else if (c === 'dx-') i.dashX = -1;
      else if (c === 'dy+') i.dashY = 1;
      else if (c === 'dy-') i.dashY = -1;
    }
    this.colpi = [];
    return i;
  }
}

// ---------- interfaccia: lobby, stanza e partita ----------

const Online = {
  rete: null,
  canale: null,
  ruolo: null,        // 'host' | 'ospite' | null
  stanza: null,       // { nome, privata, codice }
  ospite: null,       // sull'host: { id, nick, pers }
  host: null,         // sull'ospite: { id, nick, pers }
  inPartita: false,
  attesaIngresso: null,
  timerRinnovo: null,

  init() {
    if (!$('#pannelloOnline')) return; // pagina senza lobby (test)
    this.el = {
      pannello: $('#pannelloOnline'),
      spia: $('#spiaRete'),
      testoRete: $('#testoRete'),
      nick: $('#nickOnline'),
      lobby: $('#vistaLobby'),
      stanza: $('#vistaStanza'),
      nomeStanza: $('#nomeStanza'),
      privata: $('#stanzaPrivata'),
      elenco: $('#elencoStanze'),
      codice: $('#codiceStanza'),
      avviso: $('#avvisoOnline'),
    };
    try { this.el.nick.value = localStorage.getItem('hss_nick') || ''; } catch (e) { /* nessuno storage */ }
    this.el.nick.addEventListener('input', () => {
      try { localStorage.setItem('hss_nick', this.el.nick.value.trim()); } catch (e) { /* nessuno storage */ }
      if (this.ruolo === 'host') this.pubblica();
    });
    $('#btnCrea').addEventListener('click', () => this.creaStanza());
    $('#btnEntraCodice').addEventListener('click', () => this.entra(this.el.codice.value.trim().toUpperCase()));
    this.el.codice.addEventListener('keydown', (e) => { if (e.code === 'Enter') $('#btnEntraCodice').click(); });
    $('#btnAvvia').addEventListener('click', () => this.avviaPartita());
    $('#btnLascia').addEventListener('click', () => this.lasciaStanza());
    $('#btnRiprova').addEventListener('click', () => this.connetti());
    window.addEventListener('beforeunload', () => {
      if (this.canale) this.canale.invia({ tipo: 'esci' });
      if (this.ruolo === 'host' && this.rete) this.rete.rimuoviStanza();
    });
    setInterval(() => { if (this.attivo()) this.disegnaElenco(); }, 5000);
  },

  attivo() { return App.modo === 'online'; },

  nick() {
    const n = this.el.nick.value.trim();
    if (n) return n.slice(0, 16);
    return App.scelta.umano ? partiNome(App.scelta.umano.id).cognome : 'Giocatore';
  },

  mioPers() { return App.scelta.umano; },

  avvisa(testo, errore = false) {
    this.el.avviso.textContent = testo || '';
    this.el.avviso.classList.toggle('errore-testo', !!errore);
  },

  async connetti() {
    if (!this.rete) {
      this.rete = new Rete();
      this.rete.onStato = () => this.aggiornaStato();
      this.rete.onStanze = () => this.disegnaElenco();
      this.rete.onMessaggio = (m) => this.messaggio(m);
    }
    this.aggiornaStato();
    try {
      await this.rete.connetti();
    } catch (e) {
      this.avvisa('Impossibile collegarsi al server delle stanze. Controlla la connessione a internet e riprova.', true);
    }
    this.aggiornaStato();
  },

  aggiornaStato() {
    const s = this.rete ? this.rete.stato : 'spento';
    const testi = { spento: 'Non connesso', connessione: 'Connessione in corso…', connesso: 'Online', errore: 'Server non raggiungibile' };
    let t = testi[s];
    if (s === 'connesso' && this.canale) t += this.canale.diretto ? ' · collegamento diretto' : ' · collegamento via server';
    this.el.testoRete.textContent = t;
    this.el.spia.className = `spia ${s}`;
    $('#btnRiprova').classList.toggle('nascosto', s !== 'errore');
    const ok = s === 'connesso';
    $('#btnCrea').disabled = !ok || !!this.ruolo;
    $('#btnEntraCodice').disabled = !ok || !!this.ruolo;
    if (App.partita && App.partita.modo !== 'cpu' && this.canale) {
      App.partita.infoRete = this.canale.diretto ? 'connessione diretta' : 'connessione via server';
    }
  },

  // ---------- lobby ----------

  disegnaElenco() {
    const ul = this.el.elenco;
    ul.textContent = '';
    const stanze = this.rete ? this.rete.stanzeAperte() : [];
    if (!stanze.length) {
      const li = document.createElement('li');
      li.className = 'vuoto';
      li.textContent = this.rete && this.rete.stato === 'connesso' ? 'Nessuna stanza aperta: creane una!' : '—';
      ul.append(li);
      return;
    }
    for (const s of stanze) {
      const li = document.createElement('li');
      const testa = document.createElement('img');
      testa.alt = '';
      const pers = App.tutti.find((p) => p.id === s.pers);
      testa.src = pers ? Risorse.srcTesta(pers.id) : '';
      const info = document.createElement('div');
      info.className = 'info';
      const nome = document.createElement('b');
      nome.textContent = s.nome || 'Stanza';
      const chi = document.createElement('span');
      chi.textContent = `${s.nick || '?'}${pers ? ` · ${pers.nome}` : ''}`;
      info.append(nome, chi);
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.piena ? 'Piena' : 'Entra';
      b.disabled = !!s.piena || !!this.ruolo;
      b.addEventListener('click', () => this.entra(s.id));
      li.append(testa, info, b);
      ul.append(li);
    }
  },

  creaStanza() {
    if (!this.mioPers()) { this.avvisa('Prima scegli il tuo giocatore dalla griglia.', true); return; }
    if (!this.rete || this.rete.stato !== 'connesso') return;
    this.ruolo = 'host';
    this.stanza = {
      nome: this.el.nomeStanza.value.trim().slice(0, 24) || `Stanza di ${this.nick()}`,
      privata: this.el.privata.checked,
      codice: this.rete.id,
    };
    this.ospite = null;
    this.pubblica();
    clearInterval(this.timerRinnovo);
    this.timerRinnovo = setInterval(() => this.pubblica(), RETE_CONFIG.rinnovoStanza);
    this.avvisa('');
    this.mostraStanza();
  },

  pubblica() {
    if (this.ruolo !== 'host' || !this.stanza || !this.rete) return;
    if (this.stanza.privata) return;
    const p = this.mioPers();
    this.rete.pubblicaStanza({ nome: this.stanza.nome, nick: this.nick(), pers: p ? p.id : null, piena: !!this.ospite || this.inPartita });
  },

  entra(codice) {
    if (!codice) return;
    if (!this.mioPers()) { this.avvisa('Prima scegli il tuo giocatore dalla griglia.', true); return; }
    if (!this.rete || this.rete.stato !== 'connesso' || this.ruolo) return;
    if (codice === this.rete.id) { this.avvisa('Questa è la tua stanza.', true); return; }
    this.avvisa('Ingresso nella stanza…');
    this.rete.invia(codice, { tipo: 'entra', nick: this.nick(), pers: this.mioPers().id });
    clearTimeout(this.attesaIngresso);
    this.attesaIngresso = setTimeout(() => this.avvisa('La stanza non risponde: forse è stata chiusa.', true), 7000);
  },

  messaggio(m) {
    if (m.tipo === 'g') {
      if (this.canale && m.da === this.canale.altro) this.canale.ricevi(m.m);
      return;
    }
    if (m.tipo === 'rtc') {
      if (this.canale && m.da === this.canale.altro) this.canale.gestisciRtc(m);
      return;
    }
    if (m.tipo === 'entra' && this.ruolo === 'host') {
      if (this.ospite && this.ospite.id !== m.da) {
        this.rete.invia(m.da, { tipo: 'rifiutato', motivo: 'La stanza è piena.' });
        return;
      }
      this.ospite = { id: m.da, nick: String(m.nick || 'Ospite').slice(0, 16), pers: m.pers };
      this.rete.invia(m.da, { tipo: 'benvenuto', nick: this.nick(), pers: this.mioPers().id, nome: this.stanza.nome });
      this.apriCanale(m.da, true);
      this.pubblica();
      this.mostraStanza();
      Suoni.init();
      Suoni.bip(880);
      return;
    }
    if (m.tipo === 'benvenuto' && !this.ruolo) {
      clearTimeout(this.attesaIngresso);
      this.ruolo = 'ospite';
      this.host = { id: m.da, nick: String(m.nick || 'Host').slice(0, 16), pers: m.pers };
      this.stanza = { nome: m.nome || 'Stanza', codice: m.da };
      this.apriCanale(m.da, false);
      this.avvisa('');
      this.mostraStanza();
      return;
    }
    if (m.tipo === 'rifiutato') {
      clearTimeout(this.attesaIngresso);
      this.avvisa(m.motivo || 'Ingresso rifiutato.', true);
    }
  },

  apriCanale(altro, iniziatore) {
    if (this.canale) this.canale.chiudi('sostituito');
    const c = new Canale(this.rete, altro, iniziatore);
    this.canale = c;
    c.onMessaggio = (m) => this.messaggioCanale(m);
    c.onCambio = () => this.aggiornaStato();
    c.onChiuso = (motivo) => { if (this.canale === c) this.persoContatto(motivo); };
    this.aggiornaStato();
  },

  messaggioCanale(m) {
    switch (m.tipo) {
      case 'pers':
        if (this.ruolo === 'host' && this.ospite) { this.ospite.pers = m.pers; this.ospite.nick = String(m.nick || this.ospite.nick).slice(0, 16); }
        if (this.ruolo === 'ospite' && this.host) { this.host.pers = m.pers; this.host.nick = String(m.nick || this.host.nick).slice(0, 16); }
        this.mostraStanza();
        break;
      case 'via':
        if (this.ruolo === 'ospite') this.avviaComeOspite(m);
        break;
      case 'st':
        if (this.ruolo === 'ospite') this.riceviStato(m);
        break;
      case 'rk':
        if (this.ruolo === 'host') this.chiaveRichiesta = true;
        break;
      case 'in':
        if (this.ruolo === 'host' && this.controlloRemoto) this.controlloRemoto.ricevi(m);
        break;
      case 'rivincita':
        this.votoAltro = true;
        this.aggiornaNotaFine();
        if (this.ruolo === 'host') this.forseRivincita();
        break;
      case 'riparti':
        if (this.ruolo === 'ospite') this.ripartiOspite();
        break;
      case 'fineStanza':
        this.persoContatto('chiusa');
        break;
      case 'esci':
        this.persoContatto('uscito');
        break;
    }
  },

  // l'altro giocatore se n'è andato (o non risponde più)
  persoContatto(motivo) {
    const c = this.canale;
    this.canale = null;
    if (c && !c.chiuso) c.chiudi(motivo);
    const testo = motivo === 'timeout' ? 'Connessione persa con l\'avversario.' : 'L\'avversario ha lasciato la stanza.';
    if (this.inPartita) this.chiudiPartita();
    if (this.ruolo === 'host') {
      this.ospite = null;
      this.pubblica();
      this.mostraStanza();
      this.avvisa(testo, true);
    } else if (this.ruolo === 'ospite') {
      this.ruolo = null;
      this.host = null;
      this.stanza = null;
      this.mostraLobby();
      this.avvisa(motivo === 'chiusa' ? 'L\'host ha chiuso la stanza.' : testo, true);
    }
    this.aggiornaStato();
  },

  lasciaStanza() {
    if (this.canale) {
      this.canale.invia({ tipo: this.ruolo === 'host' ? 'fineStanza' : 'esci' });
      const c = this.canale;
      this.canale = null;
      setTimeout(() => c.chiudi('lasciata'), 300);
    }
    if (this.ruolo === 'host') this.rete.rimuoviStanza();
    clearInterval(this.timerRinnovo);
    this.ruolo = null;
    this.ospite = null;
    this.host = null;
    this.stanza = null;
    this.mostraLobby();
    this.aggiornaStato();
  },

  // il giocatore ha cambiato personaggio o nome mentre è in una stanza
  aggiornaMioPersonaggio() {
    if (!this.ruolo) return;
    if (this.canale) this.canale.invia({ tipo: 'pers', pers: this.mioPers().id, nick: this.nick() });
    if (this.ruolo === 'host') this.pubblica();
    this.mostraStanza();
  },

  mostraLobby() {
    this.el.lobby.classList.remove('nascosto');
    this.el.stanza.classList.add('nascosto');
    this.disegnaElenco();
  },

  mostraStanza() {
    if (!this.ruolo) { this.mostraLobby(); return; }
    this.el.lobby.classList.add('nascosto');
    this.el.stanza.classList.remove('nascosto');
    $('#titoloStanza').textContent = this.stanza ? this.stanza.nome : '';
    $('#codiceMio').textContent = this.stanza ? this.stanza.codice : '';
    const trova = (id) => App.tutti.find((p) => p.id === id) || null;
    const io = { nick: this.nick(), pers: this.mioPers() };
    const [sx, dx] = this.ruolo === 'host'
      ? [io, this.ospite ? { nick: this.ospite.nick, pers: trova(this.ospite.pers) } : null]
      : [this.host ? { nick: this.host.nick, pers: trova(this.host.pers) } : null, io];
    const riempi = (slot, chi, etichetta) => {
      App.riempiSlot(slot, chi ? chi.pers : null);
      slot.querySelector('.slot-etichetta').textContent = chi ? `${etichetta} · ${chi.nick}` : etichetta;
      if (!chi) slot.querySelector('.slot-nome').textContent = 'In attesa…';
    };
    riempi($('#slotHost'), sx, 'HOST');
    riempi($('#slotOspite'), dx, 'OSPITE');
    const pronta = this.ruolo === 'host' && this.ospite && this.ospite.pers && this.canale;
    $('#btnAvvia').disabled = !pronta;
    $('#btnAvvia').classList.toggle('nascosto', this.ruolo !== 'host');
    $('#notaStanza').textContent = this.ruolo === 'host'
      ? (this.ospite ? 'Pronti! Premi INIZIA quando volete.' : this.stanza.privata
        ? `Stanza privata: comunica il codice ${this.stanza.codice} al tuo avversario.`
        : 'In attesa di un avversario… La stanza è visibile a tutti.')
      : 'In attesa che l\'host avvii la partita…';
  },

  // ---------- partita ----------

  avviaPartita() {
    if (this.ruolo !== 'host' || !this.ospite || !this.canale) return;
    const suo = App.tutti.find((p) => p.id === this.ospite.pers);
    if (!suo) return;
    const mio = this.mioPers();
    this.canale.invia({ tipo: 'via', host: { nick: this.nick(), pers: mio.id }, ospite: { nick: this.ospite.nick, pers: suo.id } });
    this.controlloRemoto = new ControlloRemoto();
    this.inPartita = true;
    this.pubblica();
    this.preparaFine();
    const p = App.avviaPartitaOnline({
      modo: 'host', umano: mio, cpu: suo, controlloRemoto: this.controlloRemoto,
      nomi: { sinistra: 'TU', destra: this.ospite.nick },
    });
    this.agganciaHost(p);
  },

  agganciaHost(p) {
    this.ultimoInviato = null;
    this.seq = 0;
    this.accumulo = 0;
    this.prossimaChiave = 0;
    p.registroParticelle = [];
    Suoni.registro = [];
    p.dopoAggiorna = (dt) => this.inviaStato(p, dt);
    this.aggiornaStato();
  },

  inviaStato(p, dt) {
    if (!this.canale || p !== App.partita) return;
    this.accumulo += dt;
    this.prossimaChiave -= dt;
    const intervallo = this.canale.diretto ? 1 / 30 : 1 / 15;
    if (this.accumulo < intervallo) return;
    this.accumulo = 0;
    const stato = Sync.fotografa(p);
    const chiave = !this.ultimoInviato || this.prossimaChiave <= 0 || this.chiaveRichiesta;
    const d = chiave ? Sync.diff({}, stato) : Sync.diff(this.ultimoInviato, stato);
    this.ultimoInviato = stato;
    if (chiave) { this.prossimaChiave = 3; this.chiaveRichiesta = false; }
    this.seq++;
    const msg = { tipo: 'st', n: this.seq, k: chiave ? 1 : 0, d: d || null };
    if (p.registroParticelle.length) msg.pt = p.registroParticelle.splice(0);
    if (Suoni.registro && Suoni.registro.length) msg.sn = Suoni.registro.splice(0);
    this.canale.invia(msg);
  },

  avviaComeOspite(m) {
    const trova = (id) => App.tutti.find((p) => p.id === id);
    const persHost = trova(m.host.pers);
    const persOspite = trova(m.ospite.pers);
    if (!persHost || !persOspite) return;
    this.inPartita = true;
    this.preparaFine();
    this.specchio = null;
    this.seqRicevuto = 0;
    this.ultimaRichiesta = 0;
    this.inputPrecedente = null;
    this.ultimoInputInviato = 0;
    this.controlloLocale = new ControlloUmano();
    Suoni.registro = null;
    const p = App.avviaPartitaOnline({
      modo: 'ospite', umano: persHost, cpu: persOspite,
      nomi: { sinistra: m.host.nick || 'Host', destra: 'TU' },
    });
    p.dopoAggiorna = () => this.inviaInput(p);
    this.aggiornaStato();
  },

  inviaInput(p) {
    if (!this.canale || p !== App.partita) return;
    const i = this.controlloLocale.pensa();
    const colpi = ['calcioAlto', 'calcioBasso', 'potere', 'bandiera', 'lancia'].filter((k) => i[k]);
    if (i.dashX) colpi.push(i.dashX > 0 ? 'dx+' : 'dx-');
    if (i.dashY) colpi.push(i.dashY > 0 ? 'dy+' : 'dy-');
    const tenuti = `${i.muovi}|${i.salta}|${i.giu}`;
    const ora = performance.now();
    if (!colpi.length && tenuti === this.inputPrecedente && ora - this.ultimoInputInviato < 250) return;
    this.inputPrecedente = tenuti;
    this.ultimoInputInviato = ora;
    const msg = { tipo: 'in', muovi: i.muovi, salta: i.salta, giu: i.giu };
    if (colpi.length) msg.c = colpi;
    this.canale.invia(msg);
  },

  riceviStato(m) {
    const p = App.partita;
    if (!p || p.modo !== 'ospite') return;
    // particelle e suoni arrivano comunque, anche se manca un pezzo di stato
    if (Array.isArray(m.pt)) {
      for (const [tipo, x, y, vx, vy, vita, r, colore, vr] of m.pt) {
        p.particella(tipo, x, y, { vx, vy, vita, r: r || undefined, colore: colore || null, vr });
      }
    }
    if (Array.isArray(m.sn)) {
      for (const [nome, ...args] of m.sn) if (typeof Suoni[nome] === 'function') Suoni[nome](...args);
    }
    if (m.k) {
      this.specchio = Sync.applica({}, m.d);
    } else if (this.specchio && m.n === this.seqRicevuto + 1) {
      if (m.d) this.specchio = Sync.applica(this.specchio, m.d);
    } else {
      // è andato perso un aggiornamento: si chiede uno stato completo
      const ora = performance.now();
      if (ora - this.ultimaRichiesta > 400 && this.canale) {
        this.ultimaRichiesta = ora;
        this.canale.invia({ tipo: 'rk' });
      }
      return;
    }
    this.seqRicevuto = m.n;
    try {
      Sync.materializza(p, this.specchio);
    } catch (e) {
      console.warn('stato non applicabile', e);
      return;
    }
    if (p.stato === 'fine' && p.timerFine <= 0) this.fine(p.punteggio);
  },

  preparaFine() {
    this.fineMostrata = false;
    this.votoMio = false;
    this.votoAltro = false;
  },

  fine(punteggio) {
    if (this.fineMostrata) return;
    this.fineMostrata = true;
    App.mostraFine(punteggio);
    this.aggiornaNotaFine();
  },

  aggiornaNotaFine() {
    const nota = $('#notaFine');
    if (!nota) return;
    nota.textContent = this.votoMio && !this.votoAltro ? 'In attesa che anche l\'avversario accetti la rivincita…'
      : !this.votoMio && this.votoAltro ? 'L\'avversario vuole la rivincita!' : '';
  },

  votaRivincita() {
    if (!this.canale) return;
    this.votoMio = true;
    if (this.ruolo === 'host') this.forseRivincita();
    else this.canale.invia({ tipo: 'rivincita' });
    this.aggiornaNotaFine();
  },

  forseRivincita() {
    if (!(this.votoMio && this.votoAltro) || !App.partita) return;
    const p = App.partita;
    this.canale.invia({ tipo: 'riparti' });
    this.preparaFine();
    App.nascondiPannelli();
    p.nuovaPartita();
    p.registroParticelle = [];
    this.ultimoInviato = null;
    this.chiaveRichiesta = true;
  },

  ripartiOspite() {
    const p = App.partita;
    if (!p) return;
    this.preparaFine();
    App.nascondiPannelli();
    p.particelle = [];
    p.msgGol = null;
    p.msgPotere = null;
    this.specchio = null;
  },

  // chiude la partita in corso tornando alla stanza (o alla lobby)
  chiudiPartita() {
    this.inPartita = false;
    this.controlloRemoto = null;
    Suoni.registro = null;
    App.esciDallaPartita();
    if (this.ruolo === 'host') this.pubblica();
    this.mostraStanza();
  },

  abbandona() {
    if (this.canale) this.canale.invia({ tipo: 'esci' });
    const ruolo = this.ruolo;
    this.chiudiPartita();
    if (ruolo === 'ospite') {
      const c = this.canale;
      this.canale = null;
      if (c) setTimeout(() => c.chiudi('lasciata'), 300);
      this.ruolo = null;
      this.host = null;
      this.stanza = null;
      this.mostraLobby();
    } else if (ruolo === 'host') {
      const c = this.canale;
      this.canale = null;
      if (c) setTimeout(() => c.chiudi('lasciata'), 300);
      this.ospite = null;
      this.pubblica();
      this.mostraStanza();
    }
    this.aggiornaStato();
  },
};
