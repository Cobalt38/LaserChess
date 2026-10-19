// Collega la parte HTML (stato, comandi, storico, fine partita) alla board.
// update() gira a ogni frame ma tocca il DOM solo quando qualcosa è cambiato.
class GameUI {
  constructor(board, actions) {
    this.board = board;
    this.actions = actions; // { settings, newGame(), setMuted(bool), setVariant(key, bool) }
    const $ = (id) => document.getElementById(id);
    this.el = {
      status: $("status-text"),
      dot: $("status-dot"),
      history: $("history"),
      fireBtn: $("btn-fire"),
      undoBtn: $("btn-undo"),
      newBtn: $("btn-new"),
      soundBtn: $("btn-sound"),
      drawBtn: $("btn-draw"),
      variantList: $("variant-list"),
      gameover: $("gameover"),
      goTitle: $("go-title"),
      goText: $("go-text"),
      goNew: $("go-new"),
      goClose: $("go-close"),
    };
    this.shown = { status: null, claim: null, fire: null, undo: null, historyVersion: -1, gameOver: undefined };

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
    this.renderSound();
    this.renderVariants();
  }

  // Chiede conferma solo se c'è una partita in corso
  confirmNewGame(message = "Ricominciare? La partita in corso andrà persa.") {
    const b = this.board;
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
    const list = this.el.variantList;
    list.replaceChildren();
    for (const [key, variant] of Object.entries(VARIANTS)) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!this.actions.settings.variants[key];
      input.addEventListener("change", () => {
        this.actions.setVariant(key, input.checked);
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

  update() {
    const b = this.board;

    let text = "Laser Chess";
    let color = null;
    if (b.gameOver) {
      const w = b.gameOver.winner;
      text = w ? `${w.name} vince!` : "Patta";
      color = w ? w.pColor : null;
    } else if (b.activePlayer) {
      const name = b.activePlayer.name;
      text = b.busy ? `${name} spara…` : b.phase === "fire" ? `${name}, spara il laser!` : `Turno di ${name}`;
      color = b.activePlayer.pColor;
    }
    const status = text + color;
    if (status !== this.shown.status) {
      this.shown.status = status;
      this.el.status.textContent = text;
      this.el.dot.hidden = !color;
      if (color) {
        this.el.dot.style.background = `rgb(${color.join(",")})`;
        this.el.fireBtn.style.setProperty("--player", `rgb(${color.join(",")})`);
      }
    }

    const fire = b.canFire;
    if (fire !== this.shown.fire) {
      this.shown.fire = fire;
      this.el.fireBtn.disabled = !fire;
      this.el.fireBtn.classList.toggle("ready", fire);
    }

    const undo = b.canUndo;
    if (undo !== this.shown.undo) {
      this.shown.undo = undo;
      this.el.undoBtn.disabled = !undo;
    }

    const claim = b.drawClaimable && b.phase === "move" && !b.busy && !b.gameOver;
    if (claim !== this.shown.claim) {
      this.shown.claim = claim;
      this.el.drawBtn.hidden = !claim;
    }

    if (b.historyVersion !== this.shown.historyVersion) {
      this.shown.historyVersion = b.historyVersion;
      this.renderHistory();
    }

    if (b.gameOver !== this.shown.gameOver) {
      this.shown.gameOver = b.gameOver;
      this.renderGameOver();
    }
  }

  // Eventi della board che riguardano la UI
  onEvent(name) {
    if (name === "needFire") {
      // Click sulla board con la mossa già fatta: il pulsante SPARA attira l'attenzione
      const btn = this.el.fireBtn;
      btn.classList.remove("nudge");
      void btn.offsetWidth; // riavvia l'animazione
      btn.classList.add("nudge");
    }
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
    this.el.goNew.focus();
  }
}
