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

const NET_PROTOCOL = 1; // da aumentare se cambia il formato dei messaggi
const ROOM_PREFIX = "laserchess-cobalt38-v1-"; // id PeerJS = prefisso + codice partita
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // niente 0/O e 1/I, che si confondono
const CODE_LENGTH = 6;

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
    // { myName(), newGame(), onNewGameRequest(name), onChange() }
    this.hooks = hooks;
    this.peer = null;
    this.conn = null;
    this.state = "off"; // off | hosting | joining | connected | lost | error
    this.role = null; // "host" | "guest"
    this.code = null;
    this.opponentName = null;
    this.error = null;
    this.pendingSync = false;
    board.onAction = (action) => this.send({ type: "action", action });
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
    return `${location.href.split(/[?#]/)[0]}?partita=${this.code}`;
  }

  setState(state, error = null) {
    this.state = state;
    this.error = error;
    this.board.peerConnected = state === "connected";
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
    this.setState("error", message);
  }

  // Crea la partita: nuova board, codice e attesa dell'amico
  host() {
    this.close();
    if (this.libraryMissing()) return;
    this.role = "host";
    this.code = randomCode();
    this.board.localIndex = 0;
    this.opponentName = null;
    this.hooks.newGame();
    this.setState("hosting");
    this.peer = new Peer(ROOM_PREFIX + this.code);
    this.peer.on("connection", (conn) => this.attach(conn));
    this.watchPeer();
  }

  join(text) {
    const code = normalizeCode(text);
    if (code.length !== CODE_LENGTH) {
      this.fail("Il codice della partita è di 6 caratteri.");
      return;
    }
    this.close();
    if (this.libraryMissing()) return;
    this.role = "guest";
    this.code = code;
    this.board.localIndex = 1;
    this.setState("joining");
    this.peer = new Peer();
    this.peer.on("open", () => {
      this.attach(this.peer.connect(ROOM_PREFIX + this.code, { reliable: true }));
    });
    this.watchPeer();
  }

  // Il guest che ha perso la connessione rientra nella stessa partita
  reconnect() {
    if (this.role === "guest" && this.code) this.join(this.code);
  }

  watchPeer() {
    const peer = this.peer;
    // Persa la linea col server di contatto (non con l'altro giocatore): si riprova
    peer.on("disconnected", () => {
      if (this.peer === peer && !peer.destroyed) peer.reconnect();
    });
    peer.on("error", (err) => {
      if (this.peer !== peer) return;
      if (err.type === "unavailable-id" && this.role === "host" && this.state === "hosting") {
        this.host(); // codice già in uso (rarissimo): se ne genera un altro
        return;
      }
      const messages = {
        "peer-unavailable": "Partita non trovata: controlla il codice o fatti mandare un link nuovo.",
        "browser-incompatible": "Questo browser non supporta il gioco online.",
        "network": "Impossibile raggiungere il server di contatto: controlla la connessione.",
        "server-error": "Il server di contatto non risponde: riprova tra poco.",
        "socket-error": "Impossibile raggiungere il server di contatto: controlla la connessione.",
        "webrtc": "Non riesco a collegarmi direttamente all'altro giocatore.",
      };
      if (this.connected || this.state === "lost") return; // la partita in corso non si butta via
      this.fail(messages[err.type] || `Errore di connessione (${err.type || err.message}).`);
    });
  }

  attach(conn) {
    // Una sola partita alla volta: se il guest rientra, la nuova connessione sostituisce la vecchia
    if (this.conn && this.conn !== conn) this.conn.close();
    this.conn = conn;
    conn.on("open", () => {
      if (this.conn !== conn) return;
      this.setState("connected");
      this.send({ type: "hello", protocol: NET_PROTOCOL, name: this.hooks.myName() });
    });
    conn.on("data", (msg) => {
      if (this.conn === conn) this.receive(msg);
    });
    const lost = () => {
      if (this.conn !== conn) return;
      this.conn = null;
      if (this.state === "connected" || this.state === "joining") this.setState("lost");
    };
    conn.on("close", lost);
    conn.on("error", lost);
  }

  send(msg) {
    if (this.conn && this.conn.open) this.conn.send(msg);
  }

  receive(msg) {
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
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
        if (this.role === "guest") this.board.restore(msg.state);
        break;
      case "action":
        this.board.queueRemote(msg.action);
        break;
      case "needSync":
        if (this.role === "host") this.sendSync();
        break;
      case "newGameRequest":
        if (this.role === "host") this.hooks.onNewGameRequest(this.opponentName);
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

  requestNewGame() {
    this.send({ type: "newGameRequest" });
  }

  update() {
    if (this.pendingSync && !this.board.busy) this.sendSync();
  }

  close() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    this.conn = null;
    this.peer = null;
    this.pendingSync = false;
  }

  // Esce dalla partita online: la board resta, ma si torna a giocare in due sullo stesso schermo
  leave() {
    this.close();
    this.role = null;
    this.code = null;
    this.opponentName = null;
    this.board.localIndex = null;
    this.board.remoteQueue = [];
    this.setState("off");
  }
}
