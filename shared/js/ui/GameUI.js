// Collega la parte HTML (stato, suggerimenti, comandi, storico, finestre, fine partita) alla board.
// update() gira a ogni frame ma tocca il DOM solo quando qualcosa è cambiato.

// Nome del pezzo e cosa fa (nei suggerimenti quando lo si tocca e nella legenda delle regole),
// nella lingua scelta: chiavi piece.<tipo> e info.<tipo> in js/i18n
const pieceName = (type) => t(`piece.${type}`);
const pieceInfo = (type) => t(`info.${type}`);
// "Deflector di Mario"
const pieceOf = (piece) => t("piece.of", { piece: pieceName(piece.type), name: piece.player.name });
// "blu" / "arancione"
const colorName = (board, player) => t(player === board.players[0] ? "color.blue" : "color.orange");

// Per quanto si vedono le etichette sui King all'inizio di una partita (ms)
const KING_TAG_TIME = 6000;

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
    this.$("welcome-play").textContent = t(resumable ? "welcome.newGame" : "welcome.play");
    if (resumable) {
      const n = this.board.history.length;
      resume.querySelector(".sub").textContent = `${this.subText()} · ${n === 1 ? t("moves.one") : t("moves.many", { n })}`;
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
        this.toast(b.activePlayer ? t("toast.waitTurn", { name: b.activePlayer.name }) : t("toast.notStarted"));
        this.nudge(this.$("status"));
      } else {
        this.toast(t("toast.moveFirst"));
        this.nudge(this.el.stepMove);
      }
      return;
    }
    const question = this.ownLossQuestion();
    if (question) {
      Platform.haptic("warn");
      if (!(await this.ask(question.title, question.text, t("ask.fireAnyway"), t("ask.undoMove")))) {
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
        ? { title: t("ask.bothKings.title"), text: t("ask.bothKings.text") }
        : { title: t("ask.ownKing.title"), text: t("ask.ownKing.text") };
    }
    const pieces = listText(own.map((e) => pieceName(e.piece.type)));
    return { title: t("ask.ownPiece.title"), text: t("ask.ownPiece.text", { pieces }) };
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
      opt.textContent = name === "PRISMA" || name === "ACE" ? t(`setup.option.${name}`) : t("setup.option.manual", { name });
      select.append(opt);
    }
    const list = this.$("variant-list");
    for (const key of Object.keys(VARIANTS)) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "variant";
      input.value = key;
      const name = document.createElement("strong");
      name.textContent = t(`variant.${key}.label`);
      const desc = document.createElement("small");
      desc.textContent = t(`variant.${key}.desc`);
      const note = document.createElement("small");
      note.className = "included-note";
      note.textContent = t("variant.included");
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
    f.name0.value = settings.names[0]; // vuoti: si vede il nome predefinito
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
    this.$("setup-desc").textContent = t(`setup.${f.setup.value}`);
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
      ? t("new.restartOnline")
      : t(mode === "online" ? "new.continue" : "new.start");
  }

  async submitNewGame() {
    const { settings } = this.actions;
    const f = this.newForm.elements;
    const error = this.$("new-error");
    const mode = this.online.active ? "online" : f.mode.value;
    const name0 = f.name0.value.trim() || t("name.player", { n: 1 });
    const name1 = f.name1.value.trim() || t("name.player", { n: 2 });
    if (mode === "local" && sameName(name0, name1)) {
      error.textContent = t("error.sameNames");
      error.hidden = false;
      f.name1.focus();
      return;
    }
    if (mode === "ai" && sameName(f.myName.value.trim() || t("name.default"), t("name.computer"))) {
      error.textContent = t("error.notComputer", { name: t("name.computer") });
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
      settings.names = [f.name0.value.trim(), f.name1.value.trim()]; // vuoti: nome predefinito
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
  async confirmLoseGame(text = t("ask.restart.text")) {
    const b = this.board;
    if (b.history.length === 0 || b.gameOver) return true;
    return this.ask(t("ask.restart.title"), text, t("ask.restart.yes"), t("ask.restart.no"));
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
      this.toast(t("toast.notConnected"));
      return;
    }
    const b = this.board;
    if (ask && b.history.length > 0 && !b.gameOver &&
      !(await this.ask(t("ask.requestNew.title"), t("ask.requestNew.text", { name: o.opponentName || t("name.host") }),
        t("ask.requestNew.yes"), t("common.cancel")))) return;
    if (o.requestNewGame()) this.toast(t("toast.requestSent", { name: o.opponentName || t("name.host") }));
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
      input.value = player ? player.baseName : settings.names[i] || t("name.player", { n: i + 1 });
      input.readOnly = !editable.includes(i);
    });
    const note = this.$("names-note");
    note.hidden = this.mode === "local";
    note.textContent = this.mode === "online" ? t("names.noteOnline") : t("names.noteAi", { name: t("name.computer") });
    this.$("names-error").hidden = true;
  }

  saveNames() {
    const { settings } = this.actions;
    const editable = this.editableNames();
    const values = this.names.map((input) => input.value.trim());
    editable.forEach((i) => {
      if (!values[i]) values[i] = this.mode === "local" ? t("name.player", { n: i + 1 }) : t("name.default");
    });
    const error = this.$("names-error");
    if (sameName(values[0], values[1])) {
      error.textContent = editable.length === 2 ? t("error.sameNames") : t("error.nameTaken");
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
    this.toast(t("toast.namesSaved"));
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
    // Lingua: si ricarica la pagina (la partita riprende da dove era), così cambiano tutti i testi
    const lang = this.$("opt-lang");
    for (const [code, name] of [["auto", t("opt.lang.auto")], ...Object.entries(LANGUAGES)]) {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = name;
      lang.append(opt);
    }
    lang.value = settings.lang;
    lang.addEventListener("change", () => {
      settings.lang = lang.value;
      this.actions.saveSettings();
      location.reload();
    });
  }

  renderLegend() {
    const ul = this.$("legend");
    if (ul.childElementCount > 0) return;
    const player = new Player("", PLAYER_SLOTS[0].color);
    // Prima i pezzi del manuale, poi quelli inventati delle varianti
    const types = ["King", "Laser", "Deflector", "Defender", "Switch"];
    for (const variant of Object.values(VARIANTS)) {
      for (const [PieceClass] of variant.pieces) if (!types.includes(PieceClass.name)) types.push(PieceClass.name);
    }
    for (const type of types) {
      const li = document.createElement("li");
      const img = document.createElement("img");
      img.alt = "";
      img.src = this.actions.pieceIcon(PIECE_TYPES[type], player) || "";
      const title = document.createElement("strong");
      title.textContent = pieceName(type);
      const desc = document.createElement("span");
      desc.textContent = pieceInfo(type);
      const body = document.createElement("div");
      body.append(title, desc);
      li.append(img, body);
      ul.append(li);
    }
  }

  // ---------- Messaggi ----------

  // Domanda sì/no nella pagina; risolve true/false
  ask(title, text, yes = t("common.yes"), no = t("common.no")) {
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
    this.el.soundBtn.querySelector(".label").textContent = t(muted ? "sound.off" : "sound.on");
    this.el.soundBtn.setAttribute("aria-pressed", String(!muted));
  }

  // ---------- Stato e suggerimenti ----------

  statusText() {
    if (this.choosing) return { text: t("status.newGame"), color: null };
    if (this.tutorial && this.tutorial.active) return { text: this.tutorial.status(), color: PLAYER_SLOTS[0].color };
    const b = this.board;
    const o = this.online;
    const ai = this.actions.game.ai;
    if (b.gameOver) {
      const w = b.gameOver.winner;
      return { text: w ? t("status.wins", { name: w.name }) : t("status.draw"), color: w ? w.pColor : null };
    }
    const who = o.opponentName || t("name.theOpponent");
    if (o.state === "creating") return { text: t("status.creating"), color: null };
    if (o.state === "hosting") return { text: t("status.hosting"), color: null };
    if (o.state === "joining") return { text: t("status.joining"), color: null };
    if (o.state === "lost") {
      return { text: o.role === "host" ? t("status.lostHost", { name: who }) : t("status.lostGuest"), color: null };
    }
    const p = b.activePlayer;
    if (!p) return { text: "Laser Chess", color: null };
    const mine = b.localIndex !== null && p === b.localPlayer;
    const theirs = b.localIndex !== null && !mine;
    let text;
    const name = p.name;
    if (b.busy) text = t("status.fires", { name });
    else if (ai && theirs) text = t(b.phase === "fire" ? "status.aboutToFire" : "status.thinking", { name });
    else if (b.phase === "fire") text = mine ? t("status.fireNow") : t(theirs ? "status.aboutToFire" : "status.fireNamed", { name });
    else if (mine) text = t("status.yourTurn", { name });
    else if (theirs) text = t("status.turnOf", { name });
    else text = t("status.turnOfColor", { name, color: colorName(b, p) });
    return { text, color: p.pColor };
  }

  subText() {
    if (this.tutorial && this.tutorial.active) return this.tutorial.title();
    const setup = this.board.setupName || "";
    if (this.mode === "online") {
      const name = this.online.opponentName;
      return name ? t("sub.onlineWith", { name, setup }) : t("sub.online", { setup });
    }
    const ai = this.actions.game.ai;
    if (this.mode === "ai" && ai) return t("sub.ai", { level: t(`level.${ai.level}`), setup });
    return t("sub.local", { setup });
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
    const tut = this.tutorial;
    if (this.choosing || !p || b.busy || b.gameOver || !b.myTurn) return null;
    // Nel tutorial, prima della mossa conta il testo della lezione
    if (tut && tut.active && (tut.state !== "play" || b.phase !== "fire")) return null;
    const hits = b.previewHits();
    const ownKing = hits.some((h) => h.effect === "king" && h.piece.player === p);
    const enemyKing = hits.some((h) => h.effect === "king" && h.piece.player !== p);
    if (b.phase === "fire") {
      if (ownKing) return { kind: "danger", text: t("alert.fire.ownKing") };
      if (enemyKing) return { kind: "good", text: t("alert.fire.enemyKing") };
      const own = hits.filter((h) => h.piece.player === p).map((h) => t("piece.yours", { piece: pieceName(h.piece.type) }));
      if (own.length) return { kind: "danger", text: t("alert.fire.ownPiece", { pieces: listText(own) }) };
      return null;
    }
    if (b.selected && b.selected.piece) return null; // si sta scegliendo cosa fare col pezzo
    if (ownKing) return { kind: "danger", text: t("alert.move.ownKing") };
    if (enemyKing) return { kind: "good", text: t("alert.move.enemyKing") };
    return null;
  }

  coachText() {
    if (this.choosing) return { step: 0, text: t("coach.choosing") };
    if (this.tutorial && this.tutorial.active) return this.tutorial.coach();
    const b = this.board;
    const o = this.online;
    const p = b.activePlayer;
    if (b.gameOver) return { step: 0, text: t("coach.gameOver") };
    if (o.active && !o.connected) {
      let text = t("coach.waitConnection");
      if (o.state === "lost") {
        text = t(o.role === "host" ? "coach.lostHost" : "coach.lostGuest");
      } else if (o.role === "host") {
        text = t("coach.sendLink");
      }
      return { step: 0, text };
    }
    if (!p) return { step: 0, text: "" };
    if (b.busy) return { step: 2, text: t("coach.beam") };

    // Pezzo avversario appena toccato: si spiega cos'è
    if (this.inspected && this.inspected.until > Date.now() && b.pieces.includes(this.inspected.piece)) {
      const piece = this.inspected.piece;
      return { step: b.phase === "fire" ? 2 : 1, piece, text: t("coach.inspect", { piece: pieceOf(piece), info: pieceInfo(piece.type) }) };
    }
    if (!b.myTurn) {
      if (b.phase === "fire") return { step: 2, text: t("coach.opponentFiring", { name: p.name }) };
      const ai = this.actions.game.ai;
      return { step: 1, text: t(ai ? "coach.aiThinking" : "coach.waitMove", { name: p.name }) };
    }
    const color = t(p === b.players[0] ? "color.bluePieces" : "color.orangePieces");
    if (b.phase === "fire") {
      const theirs = b.previewHits().filter((h) => h.piece.player !== p).map((h) => pieceOf(h.piece));
      const aim = theirs.length ? t("coach.aim", { pieces: listText(theirs) }) : t("coach.aimLine");
      return { step: 2, text: t("coach.moved", { aim }) };
    }
    const piece = b.selected && b.selected.piece;
    if (piece) {
      const moves = piece.canBeMoved ? t("coach.canMove") : "";
      const n = piece.rotations().length;
      const rotates = n === 1 ? t("coach.canRotate1") : n > 1 ? t("coach.canRotate2") : "";
      const how = [moves, rotates].filter(Boolean).join(t("coach.or"));
      const move = how ? t("coach.yourMove", { how: how.charAt(0).toUpperCase() + how.slice(1) }) : "";
      return { step: 1, piece, text: t("coach.selected", { piece: pieceName(piece.type), info: pieceInfo(piece.type), move }).trim() };
    }
    return { step: 1, text: t("coach.start", { color }) };
  }

  pieceIconFor(piece) {
    const key = `${piece.type}|${piece.rot}|${piece.player.pColor}`;
    if (!this.icons.has(key)) this.icons.set(key, this.actions.pieceIcon(piece.constructor, piece.player, piece.rot));
    return this.icons.get(key);
  }

  // Frecce ↺ ↻ sugli angoli della casella del pezzo selezionato, dal lato (sopra, sotto, a
  // sinistra, a destra) dove coprono meno pezzi e meno raggio; a parità, sopra. Un pezzo con una
  // sola rotazione (Laser, Switch...) ha una freccia sola
  placeRotateHandles() {
    const b = this.board;
    const { el } = this;
    const piece = this.choosing || b.dragging || b.menu ? null : b.rotatable;
    let pos = null;
    if (piece) {
      const { x, y, size } = this.actions.cellOnScreen(piece.cell);
      // Il lato si sceglie una volta per pezzo e disposizione, così le frecce non saltano
      const key = `${piece.cell.name}|${b.version}|${Math.round(size)}|${this.actions.stageSize().w}`;
      if (!this.handles || this.handles.key !== key) this.handles = { key, pos: this.handlePlacement(piece, x, y, size) };
      pos = this.handles.pos;
    }
    if (!this.changed("handles", pos)) return;
    if (!pos) {
      el.ccwBtn.hidden = true;
      el.cwBtn.hidden = true;
      b.previewRotation = null;
      return;
    }
    const [d, x1, y1, x2, y2, single] = pos.split("|");
    const place = (btn, cx, cy) => {
      btn.style.width = btn.style.height = `${d}px`;
      btn.style.left = `${cx - d / 2}px`;
      btn.style.top = `${cy - d / 2}px`;
    };
    place(el.ccwBtn, +x1, +y1);
    place(el.cwBtn, +x2, +y2);
    el.ccwBtn.hidden = single === "true";
    el.cwBtn.hidden = false;
  }

  // Posizione delle frecce: "diametro|x1|y1|x2|y2|una sola freccia"
  handlePlacement(piece, x, y, size) {
    const d = Math.round(Math.max(34, Math.min(44, size * 0.75)));
    const r = d / 2;
    const { w, h } = this.actions.stageSize();
    const single = piece.rotations().length === 1;
    const gap = Math.max(size / 2, r + 3); // le due frecce mai una sopra l'altra
    const half = size / 2;
    const sides = [
      { ok: y - half - r >= 0, pts: [[x - gap, y - half], [x + gap, y - half]] },
      { ok: y + half + r <= h, pts: [[x - gap, y + half], [x + gap, y + half]] },
      { ok: x - half - r >= 0, pts: [[x - half, y - gap], [x - half, y + gap]] },
      { ok: x + half + r <= w, pts: [[x + half, y - gap], [x + half, y + gap]] },
    ];
    const beam = this.beamCells();
    let best = null;
    for (const { ok, pts } of sides) {
      if (!ok) continue;
      // Dentro lo schermo, spostando la coppia insieme
      const shift = (lo, hi, size) => Math.max(0, r - lo) - Math.max(0, hi - (size - r));
      const dx = shift(Math.min(pts[0][0], pts[1][0]), Math.max(pts[0][0], pts[1][0]), w);
      const dy = shift(Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][1], pts[1][1]), h);
      const placed = pts.map(([px, py]) => [px + dx, py + dy]);
      const covered = new Set();
      for (const [px, py] of single ? [placed[1]] : placed) {
        for (const [ox, oy] of [[0, 0], [-0.7, 0], [0.7, 0], [0, -0.7], [0, 0.7]]) {
          const cell = this.actions.cellAtScreen(px + ox * r, py + oy * r);
          if (cell && cell !== piece.cell) covered.add(cell);
        }
      }
      let score = 0;
      for (const cell of covered) score += (cell.piece ? 3 : 0) + (beam.has(cell) ? 1 : 0);
      if (!best || score < best.score) best = { score, placed };
    }
    if (!best) best = { placed: sides[0].pts }; // board minuscola: sopra comunque
    return [d, ...best.placed.flat().map(Math.round), single].join("|");
  }

  // Caselle attraversate dalla linea tratteggiata (da non coprire con frecce ed etichette)
  beamCells() {
    const cells = new Set();
    const beam = this.board.laserPreview();
    if (!beam) return cells;
    for (const s of beam.segments) {
      for (let t = 0; t <= 1; t += 0.25) {
        const cell = this.board.cellAt({ x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t });
        if (cell) cells.add(cell);
      }
    }
    return cells;
  }

  // Etichette sui King ("Il tuo King" / "King avversario", o il colore in due sullo stesso schermo):
  // per qualche secondo da quando si vede la board di una partita nuova (nel tutorial sempre),
  // nascoste mentre si sceglie una mossa. Sopra o sotto il King, dove coprono meno pezzi
  placeKingTags() {
    const b = this.board;
    const tut = this.tutorial && this.tutorial.active;
    // Con una finestra aperta il tempo non passa: le etichette si vedono dopo averla chiusa
    if (this.tagsUntil && document.querySelector("dialog[open]")) this.tagsUntil = Math.max(this.tagsUntil, Date.now() + KING_TAG_TIME);
    const show = !this.choosing && !b.gameOver && !b.busy && !b.selected &&
      (tut || (b.history.length < 2 && Date.now() < (this.tagsUntil || 0)));
    const tags = [];
    if (show) {
      const { w, h } = this.actions.stageSize();
      for (const king of b.pieces.filter((p) => p instanceof King)) {
        const i = b.players.indexOf(king.player);
        const mine = b.localIndex === null ? null : i === b.localIndex;
        const tag = tut ? (mine ? t("tag.yours") : t("tag.target"))
          : mine === null ? t("tag.color", { color: colorName(b, king.player) })
          : t(mine ? "tag.yours" : "tag.enemy");
        const label = tag.charAt(0).toUpperCase() + tag.slice(1);
        const { x, y, size } = this.actions.cellOnScreen(king.cell);
        // Pezzi nelle tre caselle sopra (dy = -1) o sotto (dy = 1) il King
        const crowd = (dy) => [-1, 0, 1].filter((dx) => {
          const cell = this.actions.cellAtScreen(x + dx * size, y + dy * size);
          return cell && cell.piece;
        }).length;
        const fitsAbove = y - size / 2 > 20;
        const fitsBelow = y + size / 2 + 20 < h;
        const above = fitsAbove && (!fitsBelow || crowd(-1) <= crowd(1));
        tags[i] = `${label}|${Math.round(x)}|${Math.round(above ? y - size / 2 - 1 : y + size / 2 + 1)}|${above}|${w}`;
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
      this.toast(t("toast.alreadyMoved"));
    }
    if (name === "notYourTurn") this.nudge(this.$("status")); // tocca all'altro
    if (name === "deny" && data && data.piece) this.inspected = { piece: data.piece, until: Date.now() + 5000 };
    if (name === "select" || name === "move" || name === "rotate") this.inspected = null;
    if (name === "deny" && data && data.fixed) this.toast(t("toast.fixed", { piece: pieceName(data.piece.type) }));
    if (name === "start") this.tagsUntil = Date.now() + KING_TAG_TIME;
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
      const name = (piece) => (piece.player === me ? t("piece.yours", { piece: pieceName(piece.type) }) : pieceOf(piece));
      const who = shot.player === me ? t("shot.yourBeam") : t("shot.beamOf", { name: shot.player.name });
      lines.push(t("shot.destroyed", { who, pieces: listText(shot.destroyed.map(name)) }));
    }
    const next = b.activePlayer;
    if (b.localIndex === null && next) lines.push(t("shot.handOff", { name: next.name, color: colorName(b, next) }));
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
    this.$("history-last").textContent = last ? `${last.player.name}: ${this.moveText(last)}` : "";
    ol.replaceChildren();
    if (history.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = t("history.empty");
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
      head.append(n, " ", who, " ", this.moveText(entry));
      li.append(head);
      for (const hit of entry.hits) {
        const div = document.createElement("div");
        div.className = "hit";
        div.textContent = this.hitText(hit);
        li.append(div);
      }
      ol.append(li);
    });
    ol.scrollTop = ol.scrollHeight;
  }

  // Testo di una mossa dello storico nella lingua scelta (una partita salvata da una versione
  // precedente ha già il testo, in italiano)
  moveText(entry) {
    const m = entry.move;
    if (!m) return entry.text || "";
    if (m.type === "rotate") return t("history.rotate", { piece: pieceName(m.piece), at: m.at, from: m.from, to: m.to });
    if (m.type === "swap") return t("history.swap", { piece: pieceName(m.piece), from: m.from, other: pieceName(m.other), to: m.to });
    return t("history.move", { piece: pieceName(m.piece), from: m.from, to: m.to });
  }

  // Pezzo eliminato da una mossa: "💥 Deflector di Mario (h2)"
  hitText(hit) {
    if (typeof hit === "string") return hit;
    const owner = this.board.players[hit.owner];
    const name = t("piece.of", { piece: pieceName(hit.piece), name: owner ? owner.name : "?" });
    return `${hit.king ? "👑" : "💥"} ${name} (${hit.cell})`;
  }

  renderGameOver() {
    const go = this.board.gameOver;
    // Nel tutorial l'esito lo racconta la lezione
    this.el.gameover.hidden = !go || !!(this.tutorial && this.tutorial.active);
    if (this.el.gameover.hidden) return;
    const w = go.winner;
    this.el.goTitle.textContent = w ? t("go.wins", { name: w.name }) : t("go.draw");
    if (go.reason === "repetition") {
      this.el.goText.textContent = t("go.repetition");
    } else if (w) {
      const loser = this.board.players.find((p) => p !== w);
      this.el.goText.textContent = t("go.kingHit", { name: loser.name });
    } else {
      this.el.goText.textContent = t("go.bothKings");
    }
    this.el.goNew.textContent = t(this.online.role === "guest" ? "go.askRematch" : "go.rematch");
    this.el.goNew.focus();
  }
}
