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
      kingTags: [$("king-tag-0"), $("king-tag-1")],
    };
    this.shown = {};
    this.inspected = null; // pezzo avversario toccato: { piece, until }
    this.icons = new Map(); // immagini dei pezzi per i suggerimenti
    this.shot = null; // colpo in corso: { player, destroyed: [pezzi] }, riassunto alla fine
    this.tutorial = null; // Tutorial, collegato da sketch.js

    const { el } = this;
    el.fireBtn.addEventListener("click", () => this.requestFire());
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
    // Benvenuto: "Riprendi" lascia la partita salvata com'è; le altre scelte la sostituiscono
    $("welcome-resume").addEventListener("click", () => $("dlg-welcome").close());
    $("welcome-learn").addEventListener("click", () => {
      $("dlg-welcome").close();
      if (this.resumable) actions.newGame();
      actions.startTutorial();
    });
    $("welcome-play").addEventListener("click", () => {
      $("dlg-welcome").close();
      if (this.resumable) actions.newGame();
      this.openNewGame();
    });
    $("new-tutorial").addEventListener("click", () => {
      $("dlg-new").close();
      actions.startTutorial();
    });
    $("help-tutorial").addEventListener("click", () => {
      $("dlg-help").close();
      actions.startTutorial();
    });
    $("privacy-link").href = Platform.privacyUrl; // nell'app: la pagina del sito pubblicato
    const version = document.querySelector('meta[name="version"]');
    $("app-version").textContent = version ? version.content : "dev";
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

  // Scheda nuova o app appena aperta: obiettivo e scelta tra tutorial e partita, più "Riprendi la
  // partita" se ce n'è una salvata (resumable). Al posto dell'immagine, la partita da riprendere
  // si vede già sulla board dietro la finestra
  openWelcome(resumable) {
    this.resumable = resumable;
    const art = this.$("welcome-art");
    const src = resumable ? null : this.actions.welcomeArt();
    if (src) art.src = src;
    art.hidden = !src;
    const resume = this.$("welcome-resume");
    resume.hidden = !resumable;
    this.$("welcome-learn").classList.toggle("accent", !resumable);
    this.$("welcome-play").textContent = resumable ? "➕ Nuova partita" : "▶ Gioca subito";
    if (resumable) {
      const n = this.board.history.length;
      resume.querySelector(".sub").textContent = `${this.subText()} · ${n} ${n === 1 ? "mossa" : "mosse"}`;
    }
    this.openDialog("dlg-welcome");
  }

  // Sparo chiesto da qui (pulsante, Spazio, tocco sul Laser). Se ancora non si può, spiega perché;
  // se il raggio colpirebbe il proprio King, chiede conferma
  async requestFire() {
    const b = this.board;
    if (!b.localCanFire) {
      if (b.gameOver || b.busy || this.choosing) return;
      if (!b.myTurn) {
        this.toast(b.activePlayer ? `Aspetta: tocca a ${b.activePlayer.name}.` : "La partita non è iniziata.");
        this.nudge(this.$("status"));
      } else {
        this.toast("Prima sposta o ruota uno dei tuoi pezzi, poi spari.");
        this.nudge(this.el.stepMove);
      }
      return;
    }
    const question = this.ownLossQuestion();
    if (question) {
      Platform.haptic("warn");
      if (!(await this.ask(question.title, question.text, "Spara lo stesso", "Annulla la mossa"))) {
        b.undoMove();
        return;
      }
    }
    if (b.localCanFire) b.fireLaser();
  }

  // Il colpo di adesso eliminerebbe pezzi di chi spara? Domanda da fare prima di sparare, o null
  ownLossQuestion() {
    const b = this.board;
    const p = b.activePlayer;
    const hits = new LaserBeam(b, p.laser).events.filter((e) => e.effect === "destroy" || e.effect === "king");
    const own = hits.filter((e) => e.piece.player === p);
    if (own.length === 0) return null;
    if (own.some((e) => e.effect === "king")) {
      return hits.some((e) => e.effect === "king" && e.piece.player !== p)
        ? { title: "Colpisci tutti e due i King?", text: "Il raggio colpisce entrambi i King: la partita finisce patta." }
        : { title: "Colpisci il tuo King?", text: "Con questa mossa il tuo raggio colpisce il tuo King e perdi la partita." };
    }
    const names = own.map((e) => e.piece.type).join(" e ");
    return { title: "Elimini un tuo pezzo?", text: `Con questa mossa il tuo raggio elimina il tuo ${names}.` };
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
    this.$("new-tutorial").hidden = this.online.active;
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
    this.$("setup-name").textContent = f.setup.value;
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
    const haptics = this.$("opt-haptics");
    preview.checked = settings.preview;
    coach.checked = settings.coach;
    haptics.checked = settings.haptics;
    haptics.addEventListener("change", () => {
      settings.haptics = haptics.checked;
      this.actions.saveSettings();
    });
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

  // Tasto indietro con una domanda aperta: vale come "no"
  cancelAsk() {
    if (this.pendingAsk) this.pendingAsk(false);
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
    if (this.tutorial && this.tutorial.active) return { text: this.tutorial.status(), color: PLAYER_SLOTS[0].color };
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
    else if (mine) text = `Tocca a te, ${p.name}`;
    else if (theirs) text = `Turno di ${p.name}`;
    else text = `Turno di ${p.name} (${p === b.players[0] ? "blu" : "arancione"})`;
    return { text, color: p.pColor };
  }

  subText() {
    if (this.tutorial && this.tutorial.active) return this.tutorial.title();
    const setup = this.board.setupName || "";
    if (this.mode === "online") return `Online${this.online.opponentName ? ` con ${this.online.opponentName}` : ""} · ${setup}`;
    const ai = this.actions.game.ai;
    if (this.mode === "ai" && ai) return `Contro il computer · ${AI_LEVELS[ai.level].label} · ${setup}`;
    return `In due sullo stesso schermo · ${setup}`;
  }

  // Cosa fare adesso: passo del turno (1 o 2), testo, pezzo da mostrare e tono del messaggio
  // (kind: "danger" avviso rosso, "good" verde). L'anteprima del laser dà gli avvisi più importanti:
  // il raggio sul proprio King (si perde) o su quello avversario (si vince)
  coach() {
    const base = this.coachText();
    const alert = this.previewAlert();
    if (!alert || base.kind) return base;
    return { ...base, text: alert.text, kind: alert.kind, piece: null };
  }

  previewAlert() {
    const b = this.board;
    const p = b.activePlayer;
    const t = this.tutorial;
    if (this.choosing || !p || b.busy || b.gameOver || !b.myTurn) return null;
    // Nel tutorial, prima della mossa conta il testo della lezione
    if (t && t.active && (t.state !== "play" || b.phase !== "fire")) return null;
    const hits = b.previewHits();
    const ownKing = hits.some((h) => h.effect === "king" && h.piece.player === p);
    const enemyKing = hits.some((h) => h.effect === "king" && h.piece.player !== p);
    if (b.phase === "fire") {
      if (ownKing) return { kind: "danger", text: "⚠️ Attento: se spari, il raggio colpisce il tuo King e perdi! Premi ↶ Annulla e prova un'altra mossa." };
      if (enemyKing) return { kind: "good", text: "🎯 Il raggio colpirà il King avversario: premi SPARA e vinci!" };
      const own = hits.filter((h) => h.piece.player === p).map((h) => `il tuo ${h.piece.type}`);
      if (own.length) return { kind: "danger", text: `⚠️ Il mirino rosso è su un tuo pezzo: sparando elimini ${own.join(" e ")}. Se non ti va, premi ↶ Annulla.` };
      return null;
    }
    if (b.selected && b.selected.piece) return null; // si sta scegliendo cosa fare col pezzo
    if (ownKing) return { kind: "danger", text: "⚠️ Adesso il tuo raggio colpirebbe il tuo King (mirino rosso): sposta o ruota un pezzo per deviarlo." };
    if (enemyKing) return { kind: "good", text: "🎯 Il tuo raggio arriva già sul King avversario! Fai una mossa che non lo devia, poi spara." };
    return null;
  }

  coachText() {
    if (this.choosing) return { step: 0, text: "Scegli come giocare nella finestra “Nuova partita”." };
    if (this.tutorial && this.tutorial.active) return this.tutorial.coach();
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
      const theirs = b.previewHits().filter((h) => h.piece.player !== p).map((h) => `${h.piece.type} di ${h.piece.player.name}`);
      const aim = theirs.length ? ` Il mirino rosso segna cosa elimini: ${theirs.join(", ")}.` : " La linea tratteggiata mostra dove andrà il raggio.";
      return { step: 2, text: `Mossa fatta! Premi SPARA (o tocca il tuo Laser).${aim} Se non ti piace, ↶ Annulla.` };
    }
    const piece = b.selected && b.selected.piece;
    if (piece) {
      const moves = piece.canBeMoved ? "Tocca una casella gialla per spostarlo" : "";
      const n = piece.rotations().length;
      const rotates = n === 1 ? "con la freccia gialla accanto al pezzo lo giri (ha due posizioni)"
        : n > 1 ? "con le frecce gialle ↺ ↻ accanto al pezzo lo ruoti" : "";
      const how = [moves, rotates].filter(Boolean).join(", oppure ");
      const turn = how ? ` ${how.charAt(0).toUpperCase() + how.slice(1)}: è la tua mossa del turno.` : "";
      return { step: 1, piece, text: `${piece.type}: ${PIECE_INFO[piece.type] || ""}${turn}` };
    }
    return { step: 1, text: `Tocca uno dei tuoi pezzi ${color}: puoi spostarlo di una casella (anche in diagonale) oppure ruotarlo. La linea tratteggiata mostra dove andrà il tuo raggio.` };
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
      const d = Math.round(Math.max(40, Math.min(52, size * 0.8)));
      const w = this.actions.stageSize().w;
      const top = y - size / 2 - d / 2 >= 0;
      const cy = top ? y - size / 2 : y + size / 2;
      // Sugli angoli della casella, ma mai una sopra l'altra (caselle piccole, pezzo sul bordo)
      const half = Math.max(size / 2, d / 2 + 4);
      const shift = Math.max(0, d / 2 - (x - half)) - Math.max(0, x + half - (w - d / 2));
      const single = piece.rotations().length === 1;
      pos = `${d}|${Math.round(x - half + shift)}|${Math.round(x + half + shift)}|${Math.round(cy)}|${single}`;
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

  // Etichette sopra i King finché ognuno non ha fatto la prima mossa (nel tutorial sempre):
  // "Il tuo King" / "King avversario", o il nome del giocatore in due sullo stesso schermo
  placeKingTags() {
    const b = this.board;
    const t = this.tutorial && this.tutorial.active;
    const show = !this.choosing && !b.gameOver && !b.busy && (t || b.history.length < 2);
    const tags = [];
    if (show) {
      const { w } = this.actions.stageSize();
      for (const king of b.pieces.filter((p) => p instanceof King)) {
        const i = b.players.indexOf(king.player);
        const mine = b.localIndex === null ? null : i === b.localIndex;
        const label = t ? (mine ? "Il tuo King" : "🎯 Bersaglio") : mine === null ? `King ${i === 0 ? "blu" : "arancione"}`
          : mine ? "Il tuo King" : "King avversario";
        const { x, y, size } = this.actions.cellOnScreen(king.cell);
        const above = y - size / 2 > 26;
        tags[i] = `${label}|${Math.round(x)}|${Math.round(above ? y - size / 2 - 2 : y + size / 2 + 2)}|${above}|${w}`;
      }
    }
    if (!this.changed("kingTags", tags.join("#"))) return;
    this.el.kingTags.forEach((el, i) => {
      el.hidden = !tags[i];
      if (!tags[i]) return;
      const [label, x, y, above, w] = tags[i].split("|").map((v, k) => (k === 0 || k === 3 ? v : +v));
      el.textContent = label;
      const half = el.offsetWidth / 2 + 4; // dentro lo schermo anche se il King è sul bordo
      el.style.left = `${Math.max(half, Math.min(w - half, x))}px`;
      el.style.top = `${y}px`;
      el.classList.toggle("below", above !== "true");
      el.style.setProperty("--player", `rgb(${PLAYER_SLOTS[i].color.join(",")})`);
    });
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
    if (this.changed("coachKind", coach.kind || "")) {
      el.hint.classList.toggle("danger", coach.kind === "danger");
      el.hint.classList.toggle("good", coach.kind === "good");
    }
    const icon = coach.piece ? this.pieceIconFor(coach.piece) : null;
    if (this.changed("coachIcon", icon)) {
      el.hintIcon.hidden = !icon;
      if (icon) el.hintIcon.src = icon;
    }

    const fire = b.localCanFire;
    if (this.changed("fire", fire)) {
      el.fireBtn.setAttribute("aria-disabled", String(!fire));
      el.fireBtn.classList.toggle("ready", fire);
    }
    if (this.changed("undo", b.localCanUndo)) el.undoBtn.disabled = !b.localCanUndo;
    this.placeRotateHandles();
    this.placeKingTags();

    const claim = b.drawClaimable && b.phase === "move" && b.myTurn && !b.busy && !b.gameOver;
    if (this.changed("claim", claim)) el.drawBtn.hidden = !claim;

    if (this.changed("historyVersion", b.historyVersion)) this.renderHistory();
    if (this.changed("gameOver", b.gameOver)) this.renderGameOver();
  }

  // Eventi della board che riguardano la UI
  onEvent(name, data) {
    if (name === "needFire") {
      // Mossa già fatta: si deve sparare (o annullare per cambiarla)
      this.nudge(this.el.fireBtn);
      this.toast("Hai già fatto la tua mossa: premi SPARA, oppure ↶ Annulla per cambiarla.");
    }
    if (name === "notYourTurn") this.nudge(this.$("status")); // tocca all'altro
    if (name === "deny" && data && data.piece) this.inspected = { piece: data.piece, until: Date.now() + 5000 };
    if (name === "select" || name === "move" || name === "rotate") this.inspected = null;
    if (name === "deny" && data && data.fixed) this.toast(`Il ${data.piece.type} non si sposta: puoi solo ruotarlo.`);
    if (name === "fire") this.shot = { player: data.player, destroyed: [] };
    if ((name === "destroy" || name === "king") && this.shot) this.shot.destroyed.push(data.piece);
    if (name === "turn") this.reportShot();
  }

  // Dopo un colpo che ha eliminato qualcosa: chi ha perso cosa (sul telefono lo storico è chiuso)
  // In due sullo stesso schermo dice anche a chi passare il telefono
  reportShot() {
    const shot = this.shot;
    this.shot = null;
    const b = this.board;
    if (this.tutorial && this.tutorial.active) return;
    const lines = [];
    if (shot && shot.destroyed.length > 0) {
      const me = b.localPlayer;
      const name = (piece) => (piece.player === me ? `il tuo ${piece.type}` : `${piece.type} di ${piece.player.name}`);
      const who = shot.player === me ? "Il tuo raggio" : `Il raggio di ${shot.player.name}`;
      lines.push(`💥 ${who} ha eliminato: ${shot.destroyed.map(name).join(", ")}`);
    }
    const next = b.activePlayer;
    if (b.localIndex === null && next) lines.push(`Tocca a ${next.name} (${next === b.players[0] ? "blu" : "arancione"}): passagli il telefono.`);
    if (lines.length) this.toast(lines.join("\n"), 3500);
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
    const last = history[history.length - 1];
    this.$("history-last").textContent = last ? `${last.player.name}: ${last.text}` : "";
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
    // Nel tutorial l'esito lo racconta la lezione
    this.el.gameover.hidden = !go || !!(this.tutorial && this.tutorial.active);
    if (this.el.gameover.hidden) return;
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
