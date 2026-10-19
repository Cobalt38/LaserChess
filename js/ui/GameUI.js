// Collega la parte HTML (stato, comandi, storico, finestre, fine partita) alla board.
// update() gira a ogni frame ma tocca il DOM solo quando qualcosa è cambiato.
class GameUI {
  constructor(board, online, actions) {
    this.board = board;
    this.online = online;
    this.actions = actions; // { settings, saveSettings(), newGame(), setMuted(bool) }
    const $ = (id) => document.getElementById(id);
    this.el = {
      status: $("status"),
      statusText: $("status-text"),
      dot: $("status-dot"),
      history: $("history"),
      fireBtn: $("btn-fire"),
      undoBtn: $("btn-undo"),
      newBtn: $("btn-new"),
      soundBtn: $("btn-sound"),
      drawBtn: $("btn-draw"),
      variantList: $("variant-list"),
      variantNote: $("variant-note"),
      names: [$("name-0"), $("name-1")],
      nameDots: [$("name-dot-0"), $("name-dot-1")],
      namesNote: $("names-note"),
      gameover: $("gameover"),
      goTitle: $("go-title"),
      goText: $("go-text"),
      goNew: $("go-new"),
      goClose: $("go-close"),
    };
    this.shown = {};

    this.el.fireBtn.addEventListener("click", () => board.fireLaser());
    this.el.undoBtn.addEventListener("click", () => board.undoMove());
    this.el.newBtn.addEventListener("click", () => this.confirmNewGame());
    this.el.goNew.addEventListener("click", () => actions.newGame());
    this.el.goClose.addEventListener("click", () => (this.el.gameover.hidden = true));
    this.el.drawBtn.addEventListener("click", () => board.claimDraw());
    this.el.soundBtn.addEventListener("click", () => {
      actions.setMuted(!actions.settings.muted);
      this.renderSound();
    });

    // Pulsanti che aprono le finestre (data-open="id della <dialog>")
    for (const btn of document.querySelectorAll("[data-open]")) {
      btn.addEventListener("click", () => this.openDialog(btn.dataset.open));
    }
    this.el.names.forEach((input, i) => {
      input.addEventListener("input", () => this.renameLocal(i, input.value));
    });

    this.renderSound();
    this.renderVariants();
  }

  openDialog(id) {
    if (id === "dlg-names") this.renderNames();
    if (id === "dlg-variants") this.renderVariantLock();
    document.getElementById(id).showModal();
  }

  // Chiede conferma solo se c'è una partita in corso
  confirmNewGame(message = "Ricominciare? La partita in corso andrà persa.") {
    const b = this.board;
    if (this.online.role === "guest") {
      // Online la nuova partita la crea chi ospita: gliela si chiede
      message = `Chiedere a ${this.online.opponentName || "chi ospita"} di iniziare una nuova partita?`;
    }
    if (b.history.length > 0 && !b.gameOver && !confirm(message)) return false;
    this.actions.newGame();
    return true;
  }

  renderSound() {
    const muted = this.actions.settings.muted;
    this.el.soundBtn.textContent = muted ? "🔇 Muto" : "🔊 Audio";
    this.el.soundBtn.setAttribute("aria-pressed", String(!muted));
  }

  renderVariants() {
    const { settings } = this.actions;
    const list = this.el.variantList;
    list.replaceChildren();
    for (const [key, variant] of Object.entries(VARIANTS)) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!settings.variants[key];
      input.addEventListener("change", () => {
        settings.variants[key] = input.checked;
        this.actions.saveSettings();
        // Se la partita è iniziata e non si vuole ricominciare, vale dalla prossima
        this.confirmNewGame("Ricominciare con le nuove varianti? Altrimenti varranno dalla prossima partita.");
      });
      const name = document.createElement("strong");
      name.textContent = variant.label;
      const desc = document.createElement("small");
      desc.textContent = variant.description;
      const text = document.createElement("span");
      text.append(name, desc);
      const label = document.createElement("label");
      label.append(input, text);
      list.append(label);
    }
  }

  // Online le varianti le sceglie chi ospita
  renderVariantLock() {
    const guest = this.online.role === "guest";
    for (const input of this.el.variantList.querySelectorAll("input")) input.disabled = guest;
    this.el.variantNote.hidden = !guest;
  }

  // Nomi: sullo stesso schermo si cambiano qui; online ognuno sceglie il suo nel pannello Online
  renderNames() {
    const online = this.online.active;
    this.el.names.forEach((input, i) => {
      const player = this.board.players[i];
      input.value = online ? (player ? player.name : "") : this.actions.settings.names[i];
      input.readOnly = online;
      this.el.nameDots[i].style.background = `rgb(${PLAYER_SLOTS[i].color.join(",")})`;
    });
    this.el.namesNote.hidden = !online;
  }

  renameLocal(i, value) {
    if (this.online.active) return;
    const { settings } = this.actions;
    settings.names[i] = value;
    this.actions.saveSettings();
    this.board.renamePlayer(i, value.trim() || `Giocatore ${i + 1}`);
  }

  statusText() {
    const b = this.board;
    const o = this.online;
    if (b.gameOver) {
      const w = b.gameOver.winner;
      return { text: w ? `${w.name} vince!` : "Patta", color: w ? w.pColor : null };
    }
    if (o.state === "hosting") return { text: "In attesa dell'avversario…", color: null };
    if (o.state === "joining") return { text: "Collegamento alla partita…", color: null };
    if (o.state === "lost") return { text: "Connessione persa", color: null };
    const p = b.activePlayer;
    if (!p) return { text: "Laser Chess", color: null };
    const mine = b.localIndex !== null && p === b.localPlayer;
    const theirs = b.localIndex !== null && !mine;
    let text;
    if (b.busy) text = `${p.name} spara…`;
    else if (b.phase === "fire") text = mine ? "Spara il laser!" : theirs ? `${p.name} sta per sparare…` : `${p.name}, spara il laser!`;
    else text = mine ? `Tocca a te, ${p.name}` : `Turno di ${p.name}`;
    return { text, color: p.pColor };
  }

  // Aggiorna un pezzo di DOM solo se il valore è cambiato
  changed(key, value) {
    if (this.shown[key] === value) return false;
    this.shown[key] = value;
    return true;
  }

  update() {
    const b = this.board;

    const { text, color } = this.statusText();
    if (this.changed("status", text + color)) {
      this.el.statusText.textContent = text;
      this.el.dot.hidden = !color;
      if (color) {
        this.el.dot.style.background = `rgb(${color.join(",")})`;
        this.el.fireBtn.style.setProperty("--player", `rgb(${color.join(",")})`);
      }
    }

    const fire = b.localCanFire;
    if (this.changed("fire", fire)) {
      this.el.fireBtn.disabled = !fire;
      this.el.fireBtn.classList.toggle("ready", fire);
    }

    if (this.changed("undo", b.localCanUndo)) this.el.undoBtn.disabled = !b.localCanUndo;

    const claim = b.drawClaimable && b.phase === "move" && b.myTurn && !b.busy && !b.gameOver;
    if (this.changed("claim", claim)) this.el.drawBtn.hidden = !claim;

    if (this.changed("historyVersion", b.historyVersion)) this.renderHistory();
    if (this.changed("gameOver", b.gameOver)) this.renderGameOver();
  }

  // Eventi della board che riguardano la UI: un elemento "scuote la testa"
  onEvent(name) {
    if (name === "needFire") this.nudge(this.el.fireBtn); // mossa già fatta: si deve sparare
    if (name === "notYourTurn") this.nudge(this.el.status); // online, tocca all'altro
  }

  nudge(el) {
    el.classList.remove("nudge");
    void el.offsetWidth; // riavvia l'animazione
    el.classList.add("nudge");
  }

  renderHistory() {
    const ol = this.el.history;
    const history = this.board.history;
    ol.replaceChildren();
    if (history.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Ancora nessuna mossa";
      ol.append(li);
      return;
    }
    history.forEach((entry, i) => {
      const li = document.createElement("li");
      li.style.setProperty("--player", `rgb(${entry.player.pColor.join(",")})`);
      if (i === history.length - 1) li.classList.add("latest");
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = `${entry.n}.`;
      const who = document.createElement("strong");
      who.textContent = entry.player.name;
      const head = document.createElement("div");
      head.append(n, " ", who, " ", entry.text);
      li.append(head);
      for (const hit of entry.hits) {
        const div = document.createElement("div");
        div.className = "hit";
        div.textContent = hit;
        li.append(div);
      }
      ol.append(li);
    });
    ol.scrollTop = ol.scrollHeight;
  }

  renderGameOver() {
    const go = this.board.gameOver;
    this.el.gameover.hidden = !go;
    if (!go) return;
    const w = go.winner;
    this.el.goTitle.textContent = w ? `${w.name} vince!` : "Patta!";
    if (go.reason === "repetition") {
      this.el.goText.textContent = "La stessa posizione si è presentata tre volte.";
    } else if (w) {
      const loser = this.board.players.find((p) => p !== w);
      this.el.goText.textContent = `Il laser ha colpito il King di ${loser.name}.`;
    } else {
      this.el.goText.textContent = "Lo stesso raggio ha colpito entrambi i King.";
    }
    this.el.goNew.textContent = this.online.role === "guest" ? "Chiedi la rivincita" : "Nuova partita";
    this.el.goNew.focus();
  }
}
