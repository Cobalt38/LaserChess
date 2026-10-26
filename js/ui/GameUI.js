// Collega la parte HTML (stato, suggerimenti, comandi, storico, finestre, fine partita) alla board.
// update() gira a ogni frame ma tocca il DOM solo quando qualcosa è cambiato.

// Cosa fa ogni pezzo: nei suggerimenti quando lo si tocca e nella legenda delle regole
const PIECE_INFO = {
  King: "Se il laser lo colpisce, da qualunque lato, la partita è persa. Si sposta di una casella ma non ruota.",
  Laser: "Spara il raggio. Non si sposta e non può essere eliminato, ma si può girare.",
  Deflector: "Lo specchio verde devia il raggio di 90°. Se il raggio lo colpisce sugli altri lati, viene eliminato.",
  Defender: "Lo scudo davanti ferma il raggio. Se il raggio lo colpisce di lato o da dietro, viene eliminato.",
  Switch: "Specchio su entrambi i lati: devia sempre il raggio e non può essere eliminato. Può scambiarsi di posto con un Deflector o un Defender vicino.",
};
for (const variant of Object.values(VARIANTS)) {
  const text = variant.description.charAt(0).toLowerCase() + variant.description.slice(1);
  for (const [PieceClass] of variant.pieces) PIECE_INFO[PieceClass.name] = `${variant.label} (variante): ${text}.`;
}

class GameUI {
  constructor(board, online, actions) {
    this.board = board;
    this.online = online;
    // { settings, game: { mode, ai }, saveSettings(), newGame(), setMuted(bool), applyOptions(),
    //   pieceIcon(classe, giocatore), setupPreview(nome, varianti), relayout() }
    this.actions = actions;
    const $ = (id) => document.getElementById(id);
    this.$ = $;
    this.el = {
      statusText: $("status-text"),
      statusSub: $("status-sub"),
      dot: $("status-dot"),
      coach: $("coach"),
      stepMove: $("step-move"),
      stepFire: $("step-fire"),
      hint: $("hint"),
      hintIcon: $("hint-icon"),
      history: $("history"),
      historyBox: $("history-box"),
      historyCount: $("history-count"),
      fireBtn: $("btn-fire"),
      undoBtn: $("btn-undo"),
      ccwBtn: $("btn-rot-ccw"),
      cwBtn: $("btn-rot-cw"),
      newBtn: $("btn-new"),
      soundBtn: $("btn-sound"),
      drawBtn: $("btn-draw"),
      gameover: $("gameover"),
      goTitle: $("go-title"),
      goText: $("go-text"),
      goNew: $("go-new"),
      goClose: $("go-close"),
      toast: $("toast"),
    };
    this.shown = {};
    this.inspected = null; // pezzo avversario toccato: { piece, until }
    this.icons = new Map(); // immagini dei pezzi per i suggerimenti

    const { el } = this;
    el.fireBtn.addEventListener("click", () => board.fireLaser());
    el.undoBtn.addEventListener("click", () => board.undoMove());
    // Frecce di rotazione sulla board: col mouse sopra, l'anteprima mostra il raggio dopo la rotazione
    [[el.ccwBtn, -1], [el.cwBtn, 1]].forEach(([btn, step]) => {
      btn.addEventListener("click", () => board.rotateSelected(step));
      btn.addEventListener("pointerenter", (e) => {
        const piece = board.rotatable;
        if (piece && e.pointerType === "mouse") board.previewRotation = { piece, rot: board.rotationFor(piece, step) };
      });
      btn.addEventListener("pointerleave", () => (board.previewRotation = null));
    });
    el.newBtn.addEventListener("click", () => this.openNewGame());
    el.goNew.addEventListener("click", () => this.rematch());
    el.goClose.addEventListener("click", () => (el.gameover.hidden = true));
    el.drawBtn.addEventListener("click", () => board.claimDraw());
    el.soundBtn.addEventListener("click", () => {
      actions.setMuted(!actions.settings.muted);
      this.renderSound();
    });

    // Pulsanti che aprono le finestre (data-open="id della <dialog>")
    for (const btn of document.querySelectorAll("[data-open]")) {
      btn.addEventListener("click", () => this.openDialog(btn.dataset.open));
    }

    this.initNewGameForm();
    this.initNamesForm();
    this.initOptions();
    this.renderSound();
    // Storico aperto se c'è spazio (barra laterale), chiuso sul telefono in verticale
    el.historyBox.open = !matchMedia(STACKED_QUERY).matches;
    el.historyBox.addEventListener("toggle", () => actions.relayout());
  }

  get mode() {
    return this.online.active ? "online" : this.actions.game.mode;
  }

  openDialog(id) {
    if (id === "dlg-names") this.renderNames();
    if (id === "dlg-help") this.renderLegend();
    const dlg = this.$(id);
    if (!dlg.open) dlg.showModal();
  }

  // ---------- Nuova partita ----------

  initNewGameForm() {
    const form = this.$("new-form");
    this.newForm = form;
    const select = this.$("setup-select");
    for (const name of Object.keys(SETUPS)) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name === "PRISMA" ? "PRISMA (inventata, con i pezzi nuovi)"
        : name === "ACE" ? "ACE (manuale, consigliata per iniziare)" : `${name} (manuale)`;
      select.append(opt);
    }
    const list = this.$("variant-list");
    for (const [key, variant] of Object.entries(VARIANTS)) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "variant";
      input.value = key;
      const name = document.createElement("strong");
      name.textContent = variant.label;
      const desc = document.createElement("small");
      desc.textContent = variant.description;
      const note = document.createElement("small");
      note.className = "included-note";
      note.textContent = "Già nella disposizione scelta.";
      const text = document.createElement("span");
      text.append(name, desc, note);
      const label = document.createElement("label");
      label.append(input, text);
      list.append(label);
    }
    form.addEventListener("change", (e) => {
      // Scelta delle varianti fatta qui (vale solo per le disposizioni che non le hanno già)
      if (e.target.name === "variant" && !e.target.disabled) this.variantChoice[e.target.value] = e.target.checked;
      this.renderNewGameForm();
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.submitNewGame();
    });
  }

  // Apre la finestra con le scelte attuali. Il guest online non sceglie: chiede all'host
  openNewGame() {
    if (this.online.role === "guest") {
      this.requestNewGame();
      return;
    }
    const { settings } = this.actions;
    const f = this.newForm.elements;
    f.mode.value = this.online.active ? "online" : settings.mode;
    f.level.value = settings.aiLevel;
    f.side.value = String(settings.humanSide);
    f.myName.value = settings.myName;
    f.name0.value = settings.names[0];
    f.name1.value = settings.names[1];
    f.setup.value = settings.setup;
    this.variantChoice = { ...settings.variants };
    this.$("intro").hidden = settings.seenIntro;
    this.$("new-error").hidden = true;
    this.renderNewGameForm();
    this.openDialog("dlg-new");
  }

  renderNewGameForm() {
    const f = this.newForm.elements;
    const onlineGame = this.online.active;
    const mode = onlineGame ? "online" : f.mode.value;
    // Online (host) si sceglie solo disposizione e varianti della prossima partita
    this.newForm.querySelector(".modes").hidden = onlineGame;
    for (const box of this.newForm.querySelectorAll("[data-mode]")) box.hidden = onlineGame || box.dataset.mode !== mode;
    this.$("setup-desc").textContent = SETUP_INFO[f.setup.value] || "";
    // Le varianti che la disposizione ha già (PRISMA) sono incluse e non si possono togliere
    const present = new Set(SETUPS[f.setup.value].map(([PieceClass]) => PieceClass));
    for (const input of this.newForm.querySelectorAll("[name=variant]")) {
      const included = VARIANTS[input.value].pieces.some(([PieceClass]) => present.has(PieceClass));
      input.disabled = included;
      input.checked = included || !!this.variantChoice[input.value];
      input.closest("label").classList.toggle("included", included);
    }
    const variants = [...this.newForm.querySelectorAll("[name=variant]:checked:not(:disabled)")].map((i) => i.value);
    const img = this.$("setup-preview");
    const src = this.actions.setupPreview(f.setup.value, variants);
    if (src) img.src = src;
    img.hidden = !src;
    this.$("new-start").textContent = onlineGame
      ? "Ricomincia la partita online"
      : mode === "online" ? "Continua" : "Inizia la partita";
  }

  async submitNewGame() {
    const { settings } = this.actions;
    const f = this.newForm.elements;
    const error = this.$("new-error");
    const mode = this.online.active ? "online" : f.mode.value;
    const name0 = f.name0.value.trim() || "Giocatore 1";
    const name1 = f.name1.value.trim() || "Giocatore 2";
    if (mode === "local" && sameName(name0, name1)) {
      error.textContent = "I due giocatori devono avere nomi diversi.";
      error.hidden = false;
      f.name1.focus();
      return;
    }
    if (mode === "ai" && sameName(f.myName.value.trim() || "Giocatore", "Computer")) {
      error.textContent = "Scegli un nome diverso da “Computer”.";
      error.hidden = false;
      f.myName.focus();
      return;
    }
    error.hidden = true;
    settings.setup = f.setup.value;
    settings.variants = { ...this.variantChoice };
    settings.seenIntro = true;
    if (!this.online.active) {
      settings.mode = mode === "online" ? settings.mode : mode;
      settings.aiLevel = f.level.value;
      settings.humanSide = Number(f.side.value);
      settings.myName = f.myName.value.trim();
      settings.names = [name0, name1];
    }
    this.actions.saveSettings();
    this.$("dlg-new").close();
    if (mode === "online" && !this.online.active) {
      this.openDialog("dlg-online");
      return;
    }
    if (await this.confirmLoseGame()) this.actions.newGame(mode === "online" ? null : mode);
  }

  // Chiede conferma solo se c'è una partita in corso
  async confirmLoseGame(text = "La partita in corso andrà persa.") {
    const b = this.board;
    if (b.history.length === 0 || b.gameOver) return true;
    return this.ask("Ricominciare?", text, "Sì, ricomincia", "No, continuo");
  }

  // Tasto R: ricomincia con le stesse scelte
  async confirmNewGame() {
    if (this.online.role === "guest") {
      this.requestNewGame();
      return;
    }
    if (await this.confirmLoseGame()) this.actions.newGame();
  }

  // Fine partita: la rivincita (stesse scelte), online la chiede il guest
  rematch() {
    if (this.online.role === "guest") this.requestNewGame(false);
    else this.actions.newGame();
  }

  async requestNewGame(ask = true) {
    const o = this.online;
    if (!o.connected) {
      this.toast("Non sei collegato all'altro giocatore.");
      return;
    }
    const b = this.board;
    if (ask && b.history.length > 0 && !b.gameOver &&
      !(await this.ask("Nuova partita?", `Chiedo a ${o.opponentName || "chi ospita"} di ricominciare?`, "Chiedi", "Annulla"))) return;
    if (o.requestNewGame()) this.toast(`Richiesta mandata a ${o.opponentName || "chi ospita"}…`);
  }

  // ---------- Nomi ----------

  initNamesForm() {
    this.names = [this.$("name-0"), this.$("name-1")];
    const dots = [this.$("name-dot-0"), this.$("name-dot-1")];
    dots.forEach((d, i) => (d.style.background = `rgb(${PLAYER_SLOTS[i].color.join(",")})`));
    this.$("names-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveNames();
    });
    this.$("names-cancel").addEventListener("click", () => this.$("dlg-names").close());
  }

  // Indici dei giocatori di cui si può cambiare il nome da qui
  editableNames() {
    const mode = this.mode;
    if (mode === "local") return [0, 1];
    const mine = mode === "online" ? this.online.myIndex : this.board.localIndex;
    return mine === null || mine === undefined ? [0, 1] : [mine];
  }

  renderNames() {
    const editable = this.editableNames();
    const { settings } = this.actions;
    this.names.forEach((input, i) => {
      const player = this.board.players[i];
      input.value = player ? player.baseName : settings.names[i];
      input.readOnly = !editable.includes(i);
    });
    const note = this.$("names-note");
    note.hidden = this.mode === "local";
    note.textContent = this.mode === "online"
      ? "Puoi cambiare solo il tuo nome: l'altro lo sceglie il tuo amico."
      : "Puoi cambiare il tuo nome; il computer si chiama Computer.";
    this.$("names-error").hidden = true;
  }

  saveNames() {
    const { settings } = this.actions;
    const editable = this.editableNames();
    const values = this.names.map((input) => input.value.trim());
    editable.forEach((i) => {
      if (!values[i]) values[i] = this.mode === "local" ? `Giocatore ${i + 1}` : "Giocatore";
    });
    const error = this.$("names-error");
    if (sameName(values[0], values[1])) {
      error.textContent = editable.length === 2
        ? "I due giocatori devono avere nomi diversi."
        : "L'altro giocatore si chiama già così: scegli un nome diverso.";
      error.hidden = false;
      return;
    }
    error.hidden = true;
    const mode = this.mode;
    if (mode === "local") {
      settings.names = [values[0], values[1]];
      editable.forEach((i) => this.board.renamePlayer(i, values[i]));
    } else {
      const i = editable[0];
      settings.myName = values[i];
      if (mode === "online") this.online.rename(values[i]);
      else this.board.renamePlayer(i, values[i]);
    }
    this.actions.saveSettings();
    this.$("dlg-names").close();
    this.toast("Nomi salvati ✓");
  }

  // ---------- Regole e opzioni ----------

  initOptions() {
    const { settings } = this.actions;
    const preview = this.$("opt-preview");
    const coach = this.$("opt-coach");
    preview.checked = settings.preview;
    coach.checked = settings.coach;
    preview.addEventListener("change", () => {
      settings.preview = preview.checked;
      this.actions.saveSettings();
      this.actions.applyOptions();
    });
    coach.addEventListener("change", () => {
      settings.coach = coach.checked;
      this.actions.saveSettings();
      this.actions.applyOptions();
    });
  }

  renderLegend() {
    const ul = this.$("legend");
    if (ul.childElementCount > 0) return;
    const player = new Player("", PLAYER_SLOTS[0].color);
    for (const [name, text] of Object.entries(PIECE_INFO)) {
      const li = document.createElement("li");
      const img = document.createElement("img");
      img.alt = "";
      img.src = this.actions.pieceIcon(PIECE_TYPES[name], player) || "";
      const title = document.createElement("strong");
      title.textContent = name;
      const desc = document.createElement("span");
      desc.textContent = text;
      const body = document.createElement("div");
      body.append(title, desc);
      li.append(img, body);
      ul.append(li);
    }
  }

  // ---------- Messaggi ----------

  // Domanda sì/no nella pagina; risolve true/false
  ask(title, text, yes = "Sì", no = "No") {
    const dlg = this.$("dlg-ask");
    if (this.pendingAsk) this.pendingAsk(false);
    this.$("ask-title").textContent = title;
    this.$("ask-text").textContent = text;
    this.$("ask-yes").textContent = yes;
    this.$("ask-no").textContent = no;
    return new Promise((resolve) => {
      const done = (value) => {
        if (this.pendingAsk !== done) return;
        this.pendingAsk = null;
        if (dlg.open) dlg.close();
        resolve(value);
      };
      this.pendingAsk = done;
      this.$("ask-yes").onclick = () => done(true);
      this.$("ask-no").onclick = () => done(false);
      dlg.oncancel = () => done(false); // Esc
      if (!dlg.open) dlg.showModal();
      this.$("ask-yes").focus();
    });
  }

  toast(text, ms = 2600) {
    const t = this.el.toast;
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (t.hidden = true), ms);
  }

  renderSound() {
    const muted = this.actions.settings.muted;
    this.el.soundBtn.querySelector(".ico").textContent = muted ? "🔇" : "🔊";
    this.el.soundBtn.querySelector(".label").textContent = muted ? "Muto" : "Audio";
    this.el.soundBtn.setAttribute("aria-pressed", String(!muted));
  }

  // ---------- Stato e suggerimenti ----------

  statusText() {
    if (this.choosing) return { text: "Nuova partita", color: null };
    const b = this.board;
    const o = this.online;
    const ai = this.actions.game.ai;
    if (b.gameOver) {
      const w = b.gameOver.winner;
      return { text: w ? `${w.name} vince!` : "Patta", color: w ? w.pColor : null };
    }
    const who = o.opponentName || "L'avversario";
    if (o.state === "creating") return { text: "Creo la partita…", color: null };
    if (o.state === "hosting") return { text: "In attesa dell'avversario…", color: null };
    if (o.state === "joining") return { text: "Collegamento alla partita…", color: null };
    if (o.state === "lost") {
      return { text: o.role === "host" ? `${who} si è disconnesso…` : "Connessione persa: mi ricollego…", color: null };
    }
    const p = b.activePlayer;
    if (!p) return { text: "Laser Chess", color: null };
    const mine = b.localIndex !== null && p === b.localPlayer;
    const theirs = b.localIndex !== null && !mine;
    let text;
    if (b.busy) text = `${p.name} spara…`;
    else if (ai && theirs) text = b.phase === "fire" ? `${p.name} sta per sparare…` : `${p.name} pensa…`;
    else if (b.phase === "fire") text = mine ? "Spara il laser!" : theirs ? `${p.name} sta per sparare…` : `${p.name}, spara il laser!`;
    else text = mine ? `Tocca a te, ${p.name}` : `Turno di ${p.name}`;
    return { text, color: p.pColor };
  }

  subText() {
    const setup = this.board.setupName || "";
    if (this.mode === "online") return `Online${this.online.opponentName ? ` con ${this.online.opponentName}` : ""} · ${setup}`;
    const ai = this.actions.game.ai;
    if (this.mode === "ai" && ai) return `Contro il computer · ${AI_LEVELS[ai.level].label} · ${setup}`;
    return `In due sullo stesso schermo · ${setup}`;
  }

  // Cosa fare adesso: passo del turno (1 o 2), testo e pezzo da mostrare
  coach() {
    if (this.choosing) return { step: 0, text: "Scegli come giocare nella finestra “Nuova partita”." };
    const b = this.board;
    const o = this.online;
    const p = b.activePlayer;
    if (b.gameOver) return { step: 0, text: "Partita finita. Premi “Nuova partita” per giocarne un'altra." };
    if (o.active && !o.connected) {
      let text = "Aspetta il collegamento con l'altro giocatore.";
      if (o.state === "lost") {
        text = o.role === "host"
          ? "L'altro giocatore si è disconnesso: può rientrare con lo stesso link. La partita resta com'è."
          : "Connessione persa: mi ricollego da solo, la partita resta com'è.";
      } else if (o.role === "host") {
        text = "Manda il link al tuo amico (finestra 🌐 Online). La partita parte appena entra.";
      }
      return { step: 0, text };
    }
    if (!p) return { step: 0, text: "" };
    if (b.busy) return { step: 2, text: "Il raggio viaggia: gli specchi lo deviano, i pezzi colpiti dove non c'è specchio vengono eliminati." };

    // Pezzo avversario appena toccato: si spiega cos'è
    if (this.inspected && this.inspected.until > Date.now() && b.pieces.includes(this.inspected.piece)) {
      const piece = this.inspected.piece;
      return { step: b.phase === "fire" ? 2 : 1, piece, text: `${piece.type} di ${piece.player.name}: ${PIECE_INFO[piece.type] || ""} Puoi muovere solo i tuoi pezzi.` };
    }
    if (!b.myTurn) {
      if (b.phase === "fire") return { step: 2, text: `${p.name} ha mosso e sta per sparare: la linea tratteggiata mostra dove andrà il raggio.` };
      const ai = this.actions.game.ai;
      return { step: 1, text: ai ? `${p.name} sta pensando alla sua mossa…` : `Aspetta la mossa di ${p.name}.` };
    }
    const color = p === b.players[0] ? "blu" : "arancioni";
    if (b.phase === "fire") {
      return { step: 2, text: "Mossa fatta! Premi SPARA (o tocca il tuo Laser). La linea tratteggiata mostra dove andrà il raggio; se non ti piace, ↶ annulla la mossa." };
    }
    const piece = b.selected && b.selected.piece;
    if (piece) {
      const moves = piece.canBeMoved ? "Tocca una casella gialla per spostarlo" : "";
      const rotates = piece.rotations().length > 0 ? "con le frecce ↺ ↻ accanto al pezzo lo ruoti" : "";
      const how = [moves, rotates].filter(Boolean).join(", oppure ");
      return { step: 1, piece, text: `${piece.type}: ${PIECE_INFO[piece.type] || ""} ${how ? how.charAt(0).toUpperCase() + how.slice(1) + "." : ""}` };
    }
    return { step: 1, text: `Tocca uno dei tuoi pezzi ${color}: puoi spostarlo di una casella (anche in diagonale) oppure ruotarlo.` };
  }

  pieceIconFor(piece) {
    const key = `${piece.type}|${piece.rot}|${piece.player.pColor}`;
    if (!this.icons.has(key)) this.icons.set(key, this.actions.pieceIcon(piece.constructor, piece.player, piece.rot));
    return this.icons.get(key);
  }

  // Frecce ↺ ↻ sugli angoli in alto della casella del pezzo selezionato (in basso se in alto non
  // c'è spazio). Un pezzo con una sola rotazione (Laser, Switch...) ha una freccia sola
  placeRotateHandles() {
    const b = this.board;
    const { el } = this;
    const piece = this.choosing || b.dragging || b.menu ? null : b.rotatable;
    let pos = null;
    if (piece) {
      const { x, y, size } = this.actions.cellOnScreen(piece.cell);
      const d = Math.round(Math.max(34, Math.min(46, size * 0.62)));
      const w = this.actions.stageSize().w;
      const top = y - size / 2 - d / 2 >= 0;
      const cy = top ? y - size / 2 : y + size / 2;
      const clampX = (cx) => Math.max(d / 2, Math.min(w - d / 2, cx));
      const single = piece.rotations().length === 1;
      pos = `${d}|${Math.round(clampX(x - size / 2))}|${Math.round(clampX(x + size / 2))}|${Math.round(cy)}|${single}`;
    }
    if (!this.changed("handles", pos)) return;
    if (!pos) {
      el.ccwBtn.hidden = true;
      el.cwBtn.hidden = true;
      b.previewRotation = null;
      return;
    }
    const [d, left, right, cy, single] = pos.split("|");
    const place = (btn, cx) => {
      btn.style.width = btn.style.height = `${d}px`;
      btn.style.left = `${cx - d / 2}px`;
      btn.style.top = `${cy - d / 2}px`;
    };
    place(el.ccwBtn, +left);
    place(el.cwBtn, +right);
    el.ccwBtn.hidden = single === "true";
    el.cwBtn.hidden = false;
  }

  // Aggiorna un pezzo di DOM solo se il valore è cambiato
  changed(key, value) {
    if (this.shown[key] === value) return false;
    this.shown[key] = value;
    return true;
  }

  update() {
    this.choosing = this.$("dlg-new").open; // si sta scegliendo la nuova partita: la board è vuota
    const b = this.board;
    const { el } = this;

    const { text, color } = this.statusText();
    if (this.changed("status", text + color)) {
      el.statusText.textContent = text;
      el.dot.hidden = !color;
      if (color) {
        el.dot.style.background = `rgb(${color.join(",")})`;
        el.fireBtn.style.setProperty("--player", `rgb(${color.join(",")})`);
      }
    }
    const sub = this.subText();
    if (this.changed("sub", sub)) el.statusSub.textContent = sub;

    const coach = this.coach();
    if (this.changed("coachStep", coach.step)) {
      el.stepMove.classList.toggle("active", coach.step === 1);
      el.stepFire.classList.toggle("active", coach.step === 2);
      el.stepMove.classList.toggle("done", coach.step === 2);
    }
    if (this.changed("coachText", coach.text)) el.hint.textContent = coach.text;
    const icon = coach.piece ? this.pieceIconFor(coach.piece) : null;
    if (this.changed("coachIcon", icon)) {
      el.hintIcon.hidden = !icon;
      if (icon) el.hintIcon.src = icon;
    }

    const fire = b.localCanFire;
    if (this.changed("fire", fire)) {
      el.fireBtn.disabled = !fire;
      el.fireBtn.classList.toggle("ready", fire);
    }
    if (this.changed("undo", b.localCanUndo)) el.undoBtn.disabled = !b.localCanUndo;
    this.placeRotateHandles();

    const claim = b.drawClaimable && b.phase === "move" && b.myTurn && !b.busy && !b.gameOver;
    if (this.changed("claim", claim)) el.drawBtn.hidden = !claim;

    if (this.changed("historyVersion", b.historyVersion)) this.renderHistory();
    if (this.changed("gameOver", b.gameOver)) this.renderGameOver();
  }

  // Eventi della board che riguardano la UI
  onEvent(name, data) {
    if (name === "needFire") this.nudge(this.el.fireBtn); // mossa già fatta: si deve sparare
    if (name === "notYourTurn") this.nudge(this.$("status")); // tocca all'altro
    if (name === "deny" && data && data.piece) this.inspected = { piece: data.piece, until: Date.now() + 5000 };
    if (name === "select" || name === "move" || name === "rotate") this.inspected = null;
  }

  nudge(el) {
    el.classList.remove("nudge");
    void el.offsetWidth; // riavvia l'animazione
    el.classList.add("nudge");
  }

  renderHistory() {
    const ol = this.el.history;
    const history = this.board.history;
    this.el.historyCount.textContent = history.length ? `(${history.length})` : "";
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
    this.el.goNew.textContent = this.online.role === "guest" ? "Chiedi la rivincita" : "Rivincita";
    this.el.goNew.focus();
  }
}
