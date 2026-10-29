// Partita online tra due browser, senza un server nostro.
//
// Chi crea la partita ("host", gioca col blu) ottiene un codice e un link da mandare all'amico.
// PeerJS (libreria open source, MIT: https://peerjs.com) usa il suo server pubblico solo per
// mettere in contatto i due browser tramite il codice: poi i messaggi viaggiano direttamente tra
// i due giocatori con WebRTC, cifrati. Se le due reti non si "vedono", PeerJS passa da un suo
// server ponte (TURN) che inoltra i dati senza poterli leggere. Nessun IP da scambiare a mano.
//
// Le due board restano uguali perché si mandano le azioni (mossa, rotazione, annulla, sparo),
// non lo stato. In caso di dubbio vale la board dell'host, che manda una fotografia completa.
//
// La connessione può cadere (telefono in tasca, cambio di rete, pagina ricaricata):
// - i due browser si mandano un "ping" ogni 2 secondi: dopo 8 secondi di silenzio la connessione
//   è persa anche se WebRTC non se ne è accorto;
// - chi è entrato col link si ricollega da solo, con attese crescenti; l'host resta in ascolto
//   sullo stesso codice (il link mandato all'amico non cambia mai);
// - codice e partita sono salvati in sessionStorage: ricaricando la pagina si rientra.

const NET_PROTOCOL = 2; // da aumentare se cambia il formato dei messaggi
const ROOM_PREFIX = "laserchess-cobalt38-v1-"; // id PeerJS = prefisso + codice partita
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // niente 0/O e 1/I, che si confondono
const CODE_LENGTH = 6;
const SESSION_KEY = "laserchess.online";
const PING_EVERY = 2000; // ms
const SILENCE_LIMIT = 8000; // ms senza messaggi: connessione persa
const OPEN_TIMEOUT = 15000; // ms per aprire il collegamento con l'altro giocatore
const RETRY_DELAYS = [1000, 2000, 3000, 5000, 8000, 10000]; // attese tra un tentativo e l'altro

function randomCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

function normalizeCode(text) {
  // Accetta sia il codice sia il link incollato per intero
  const match = String(text).match(/partita=([A-Za-z0-9]+)/);
  return (match ? match[1] : String(text)).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

class Online {
  constructor(board, hooks) {
    this.board = board;
    // { myName(), newGame(), onNewGameRequest(name), onNewGameReply(accepted), onChange() }
    this.hooks = hooks;
    this.peer = null;
    this.conn = null;
    // off | creating | hosting | joining | connected | lost | error
    this.state = "off";
    this.role = null; // "host" | "guest"
    this.code = null;
    this.opponentName = null;
    this.error = null;
    this.pendingSync = false;
    this.attempt = 0; // tentativi di ricollegamento di fila
    this.retryTimer = null;
    this.openTimer = null;
    this.lastSeen = 0; // ultimo messaggio ricevuto (ms)
    this.newGameRequested = false; // il guest ha chiesto una nuova partita e aspetta risposta
    this.savedVersion = -1; // board.version dell'ultima partita salvata in sessionStorage
    board.onAction = (action) => this.send({ type: "action", action });

    setInterval(() => this.heartbeat(), PING_EVERY);
    // Tornando sulla pagina (telefono sbloccato, scheda riaperta) si controlla subito la linea.
    // Il conto del silenzio riparte: mentre la pagina era ferma non si potevano ricevere ping
    document.addEventListener("visibilitychange", () => {
      if (document.hidden || !this.active) return;
      this.lastSeen = Date.now();
      if (this.connected) this.send({ type: "ping" });
      else if (this.state === "lost" || this.state === "joining") this.retryNow();
    });
  }

  get active() {
    return this.role !== null;
  }

  get connected() {
    return this.state === "connected";
  }

  get myIndex() {
    return this.role === "host" ? 0 : 1;
  }

  // Link da mandare all'amico: questa stessa pagina con il codice della partita
  get inviteLink() {
    // Nell'app l'indirizzo della pagina è locale: Platform dà quello del gioco pubblicato
    return `${Platform.inviteBase()}?partita=${this.code}`;
  }

  setState(state, error = null) {
    this.state = state;
    this.error = error;
    this.board.opponentReady = state === "connected";
    this.hooks.onChange();
  }

  libraryMissing() {
    if (typeof Peer !== "undefined") return false;
    this.fail("Non riesco a caricare la libreria per il gioco online: controlla la connessione e ricarica la pagina.");
    return true;
  }

  // Qualcosa è andato storto prima di giocare: si torna offline mostrando il motivo
  fail(message) {
    this.close();
    this.role = null;
    this.code = null;
    this.board.localIndex = null;
    this.clearSession();
    this.setState("error", message);
  }

  // ---------- Host ----------

  // Crea la partita: nuova board, codice e attesa dell'amico.
  // resume = { code, snapshot }: la stessa partita dopo aver ricaricato la pagina
  host(resume = null) {
    this.close();
    if (this.libraryMissing()) return;
    this.role = "host";
    this.code = resume ? resume.code : randomCode();
    this.board.localIndex = 0;
    this.opponentName = null;
    this.newGameRequested = false;
    if (resume && resume.snapshot) this.board.restore(resume.snapshot);
    else this.hooks.newGame();
    this.saveSession();
    // Finché il server non conferma il codice il link non si mostra: se il codice fosse già
    // preso se ne sceglie un altro senza che nessuno abbia ricevuto quello vecchio
    this.setState(resume ? "hosting" : "creating");
    this.openRoom(!resume);
  }

  // Registra il codice sul server di contatto e aspetta l'amico
  openRoom(fresh) {
    const old = this.peer;
    this.peer = null; // prima di distruggerlo: i suoi eventi non devono più contare
    if (old) old.destroy();
    const peer = new Peer(ROOM_PREFIX + this.code);
    this.peer = peer;
    peer.on("open", () => {
      if (this.peer !== peer) return;
      this.attempt = 0;
      if (this.state === "creating") this.setState("hosting");
    });
    peer.on("connection", (conn) => {
      if (this.peer === peer) this.attach(conn);
    });
    peer.on("disconnected", () => {
      // Persa la linea col server di contatto (non con l'altro giocatore): serve solo per
      // accogliere nuove connessioni, quindi si riprova con calma
      if (this.peer === peer) this.scheduleRetry();
    });
    peer.on("error", (err) => {
      if (this.peer !== peer) return;
      if (err.type === "unavailable-id") {
        if (fresh && this.state === "creating") {
          this.code = randomCode(); // codice già in uso (rarissimo): se ne genera un altro
          this.saveSession();
          this.openRoom(true);
        } else {
          // Il server tiene ancora il nostro codice dalla volta prima (pagina ricaricata,
          // linea caduta): si libera entro un minuto, intanto si riprova
          this.scheduleRetry();
        }
        return;
      }
      if (err.type === "browser-incompatible") {
        this.fail("Questo browser non supporta il gioco online.");
        return;
      }
      if (this.state === "creating" && this.attempt >= 3) {
        this.fail("Impossibile raggiungere il server di contatto: controlla la connessione e riprova.");
        return;
      }
      this.scheduleRetry();
    });
  }

  // ---------- Guest ----------

  // resume: si rientra in una partita in cui si era già (pagina ricaricata): se l'host non c'è
  // ancora si riprova invece di dare errore. Lo stesso dopo essersi collegati almeno una volta
  join(text, resume = false) {
    const code = normalizeCode(text);
    if (code.length !== CODE_LENGTH) {
      this.fail("Il codice della partita è di 6 caratteri.");
      return;
    }
    // Nuovo tentativo sulla stessa partita (dopo un errore di rete o una connessione persa)
    const retrying = this.role === "guest" && this.code === code && this.state !== "off" && this.state !== "error";
    this.close();
    if (this.libraryMissing()) return;
    if (!retrying) {
      this.attempt = 0;
      this.resuming = resume;
    }
    this.role = "guest";
    this.code = code;
    this.board.localIndex = 1;
    this.saveSession();
    this.setState(this.state === "lost" ? "lost" : "joining");
    const peer = new Peer();
    this.peer = peer;
    peer.on("open", () => {
      if (this.peer !== peer) return;
      this.attach(peer.connect(ROOM_PREFIX + this.code, { reliable: true }));
    });
    peer.on("error", (err) => {
      if (this.peer !== peer) return;
      if (this.connected) return; // la partita in corso non si butta via
      if (err.type === "browser-incompatible") {
        this.fail("Questo browser non supporta il gioco online.");
        return;
      }
      // Prima volta e codice inesistente: è sbagliato il codice
      if (err.type === "peer-unavailable" && !this.resuming) {
        this.fail("Partita non trovata: controlla il codice o fatti mandare un link nuovo.");
        return;
      }
      if (!this.resuming && this.attempt >= 2) {
        this.fail("Non riesco a collegarmi alla partita: controlla la connessione e riprova.");
        return;
      }
      this.scheduleRetry();
    });
  }

  // ---------- Collegamento ----------

  attach(conn) {
    // Una sola partita alla volta: se il guest rientra, la nuova connessione sostituisce la vecchia.
    // La vecchia si chiude dopo aver cambiato this.conn, così la sua chiusura non conta come persa
    const old = this.conn;
    this.conn = conn;
    if (old && old !== conn) old.close();
    clearTimeout(this.openTimer);
    if (this.role === "guest") {
      // Il collegamento diretto a volte non si apre e non dà errori: dopo un po' si riprova
      this.openTimer = setTimeout(() => {
        if (this.conn === conn && !conn.open) this.connectionLost();
      }, OPEN_TIMEOUT);
    }
    conn.on("open", () => {
      if (this.conn !== conn) return;
      clearTimeout(this.openTimer);
      this.attempt = 0;
      this.resuming = true; // da qui in poi, se cade, si ricollega da solo
      this.lastSeen = Date.now();
      this.setState("connected");
      this.send({ type: "hello", protocol: NET_PROTOCOL, name: this.hooks.myName() });
    });
    conn.on("data", (msg) => {
      if (this.conn !== conn) return;
      this.lastSeen = Date.now();
      this.receive(msg);
    });
    const lost = () => {
      if (this.conn === conn) this.connectionLost();
    };
    conn.on("close", lost);
    conn.on("error", lost);
  }

  // L'altro giocatore non risponde più: il guest si ricollega, l'host aspetta che rientri
  connectionLost() {
    if (!this.active) return;
    const conn = this.conn;
    this.conn = null;
    clearTimeout(this.openTimer);
    if (conn) conn.close();
    this.pendingSync = false;
    this.board.remoteQueue = [];
    this.setState(this.role === "host" ? "lost" : this.state === "joining" ? "joining" : "lost");
    if (this.role === "guest") this.scheduleRetry();
    else if (!this.peer || this.peer.destroyed || this.peer.disconnected) this.scheduleRetry();
  }

  // Nuovo tentativo dopo un'attesa che cresce a ogni fallimento
  scheduleRetry() {
    if (!this.active || this.retryTimer) return;
    const delay = RETRY_DELAYS[Math.min(this.attempt, RETRY_DELAYS.length - 1)];
    this.attempt++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retry();
    }, delay);
    this.hooks.onChange();
  }

  retryNow() {
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.retry();
  }

  retry() {
    if (!this.active) return;
    if (this.role === "guest") {
      if (!this.connected) this.join(this.code);
      return;
    }
    // Host: serve la linea col server di contatto per accogliere il guest, anche durante la
    // partita (se poi il guest cade, deve poter rientrare)
    const peer = this.peer;
    if (peer && !peer.destroyed && peer.disconnected) {
      try {
        peer.reconnect();
        return;
      } catch (e) {
        // peer inutilizzabile: se ne crea uno nuovo con lo stesso codice
      }
    }
    if (!peer || peer.destroyed || peer.disconnected) this.openRoom(false);
  }

  // Ping periodico e controllo del silenzio
  heartbeat() {
    if (!this.connected) return;
    if (Date.now() - this.lastSeen > SILENCE_LIMIT) {
      this.connectionLost();
      return;
    }
    this.send({ type: "ping" });
  }

  send(msg) {
    if (this.conn && this.conn.open) this.conn.send(msg);
  }

  receive(msg) {
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
      case "ping":
        return; // basta che sia arrivato (lastSeen)
      case "hello":
        if (msg.protocol !== NET_PROTOCOL) {
          this.fail("Avete due versioni diverse del gioco: ricaricate entrambi la pagina.");
          return;
        }
        this.setOpponentName(msg.name);
        if (this.role === "host") this.sendSync();
        break;
      case "name":
        this.setOpponentName(msg.name);
        break;
      case "sync":
        if (this.role === "guest") {
          this.board.restore(msg.state);
          this.newGameRequested = false;
        }
        break;
      case "action":
        this.board.queueRemote(msg.action);
        break;
      case "needSync":
        if (this.role === "host") this.sendSync();
        break;
      case "newGameRequest":
        if (this.role === "host") this.hooks.onNewGameRequest(this.opponentName || "L'avversario");
        break;
      case "newGameReply":
        if (this.role === "guest") {
          this.newGameRequested = false;
          this.hooks.onNewGameReply(!!msg.accepted);
        }
        break;
    }
    this.hooks.onChange();
  }

  setOpponentName(name) {
    this.opponentName = String(name || "Avversario").slice(0, 16);
    this.board.renamePlayer(1 - this.myIndex, this.opponentName);
  }

  // Il mio nome è cambiato
  rename(name) {
    if (!this.active) return;
    this.board.renamePlayer(this.myIndex, name);
    this.send({ type: "name", name });
  }

  // L'host manda la fotografia della partita (appena il laser ha finito, se è in volo)
  sendSync() {
    if (this.role !== "host" || !this.connected) return;
    if (this.board.busy) {
      this.pendingSync = true;
      return;
    }
    this.pendingSync = false;
    this.send({ type: "sync", state: this.board.snapshot() });
  }

  // Le board non coincidono: vale quella dell'host
  onDesync() {
    if (this.role === "host") this.sendSync();
    else this.send({ type: "needSync" });
  }

  // Nuova partita: la crea l'host; il guest la chiede e aspetta la risposta
  requestNewGame() {
    if (!this.connected) return false;
    this.newGameRequested = true;
    this.send({ type: "newGameRequest" });
    this.hooks.onChange();
    return true;
  }

  answerNewGame(accepted) {
    if (accepted) this.hooks.newGame();
    this.send({ type: "newGameReply", accepted });
  }

  update() {
    if (this.pendingSync && !this.board.busy) this.sendSync();
    // L'host salva la partita a ogni cambiamento, per riprenderla se ricarica la pagina
    if (this.role === "host" && !this.board.busy && this.board.version !== this.savedVersion) {
      this.saveSession();
    }
  }

  close() {
    clearTimeout(this.retryTimer);
    clearTimeout(this.openTimer);
    this.retryTimer = null;
    // Prima si staccano, poi si chiudono: "close" e "disconnected" arrivano subito e non devono
    // far partire un ricollegamento
    const { conn, peer } = this;
    this.conn = null;
    this.peer = null;
    if (conn) conn.close();
    if (peer) peer.destroy();
    this.pendingSync = false;
  }

  // Esce dalla partita online: la board resta, ma si torna a giocare in due sullo stesso schermo
  leave() {
    this.close();
    this.role = null;
    this.code = null;
    this.opponentName = null;
    this.newGameRequested = false;
    this.attempt = 0;
    this.board.localIndex = null;
    this.board.remoteQueue = [];
    this.clearSession();
    this.setState("off");
  }

  // ---------- Ripresa dopo aver ricaricato la pagina ----------

  saveSession() {
    const data = { role: this.role, code: this.code };
    if (this.role === "host") {
      data.snapshot = this.board.snapshot();
      this.savedVersion = this.board.version;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (e) {
      // storage non disponibile: ricaricando la pagina si perde la partita
    }
  }

  clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      // niente
    }
  }

  // La partita online in cui era questa scheda prima di ricaricare, se c'è
  savedSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      return s && (s.role === "host" || s.role === "guest") && typeof s.code === "string" ? s : null;
    } catch (e) {
      return null;
    }
  }

  // Rientra nella partita salvata; false se non ce n'è una
  resume() {
    const s = this.savedSession();
    if (!s) return false;
    if (s.role === "host") this.host({ code: s.code, snapshot: s.snapshot });
    else this.join(s.code, true);
    return true;
  }
}
