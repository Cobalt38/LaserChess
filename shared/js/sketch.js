let board, sfx, ui, online, onlinePanel, tutorial;
// Partita in corso: "ai" contro il computer, "local" in due sullo stesso schermo, "online",
// "tutorial" (le lezioni di js/ui/Tutorial.js)
const game = { mode: "local", ai: null };

// Come la board finisce nel canvas: spostamento, zoom e quarti di giro in senso orario (0 o 2).
// Si gira di 180° per chi gioca con l'arancione (online o contro il computer), così ognuno vede i
// propri pezzi in basso. Di 90° mai, neanche sui telefoni in verticale: il laser blu spara sempre
// verso l'alto dello schermo, come sulla board vera.
const view = { x: 0, y: 0, scale: 1, turns: 0 };
// Deve combaciare con la media query del layout "a colonna" in style.css
const STACKED_QUERY = "(max-width: 760px) and (orientation: portrait)";
const SETTINGS_KEY = "laserchess.settings"; // dove: Platform.settingsStorage()
// Da aumentare quando cambia un'impostazione predefinita da applicare anche a chi le ha già salvate
// (2: la disposizione predefinita diventa PRISMA; 3: torna ACE, più semplice per chi inizia)
const SETTINGS_VERSION = 3;
const GAME_KEY = "laserchess.game"; // partita in corso (non online), in Platform.gameStorage()
const RUN_KEY = "laserchess.run"; // in sessionStorage: questa scheda (o avvio dell'app) è già partita
const settings = loadSettings();
applyLanguage(); // i testi della pagina nella lingua scelta (js/i18n), prima che si veda
// Scheda nuova o app appena avviata (non una pagina ricaricata): si parte dal benvenuto
const firstRun = startRun();
let activePointer = null; // un solo dito/puntatore alla volta sulla board
let savedVersion = -1; // board.version dell'ultima partita salvata
const previews = new Map(); // immagini delle disposizioni iniziali

function loadSettings() {
  const defaults = {
    muted: false,
    mode: "ai", // modalità della prossima partita: "ai" o "local" (online si sceglie a parte)
    aiLevel: "easy", // per chi non ha mai giocato; chi ha già scelto un livello lo tiene
    humanSide: 0, // contro il computer: 0 blu (muove per primo), 1 arancione
    setup: "ACE",
    variants: { prism: false, halfMirror: false },
    names: ["", ""], // partita sullo stesso schermo (vuoto: "Giocatore 1" nella lingua scelta)
    lang: "auto", // lingua: "auto" (quella del dispositivo) o una di LANGUAGES (js/i18n)
    myName: "", // contro il computer e online
    preview: true, // linea tratteggiata del laser
    coach: true, // suggerimenti sotto la board
    haptics: true, // vibrazione (solo nell'app)
    version: SETTINGS_VERSION,
  };
  try {
    const storage = Platform.settingsStorage();
    // Nel browser le impostazioni non restano più tra una scheda e l'altra: via quelle vecchie
    if (storage !== window.localStorage) localStorage.removeItem(SETTINGS_KEY);
    const saved = JSON.parse(storage.getItem(SETTINGS_KEY)) || {};
    const s = { ...defaults, ...saved, variants: { ...defaults.variants, ...saved.variants } };
    if (!(saved.version >= 3)) s.setup = defaults.setup;
    s.version = SETTINGS_VERSION;
    if (!SETUPS[s.setup]) s.setup = defaults.setup;
    if (!AI_LEVELS[s.aiLevel]) s.aiLevel = defaults.aiLevel;
    if (s.mode !== "ai" && s.mode !== "local") s.mode = defaults.mode;
    if (s.humanSide !== 0 && s.humanSide !== 1) s.humanSide = 0;
    if (!Array.isArray(s.names) || s.names.length !== 2) s.names = defaults.names;
    // I nomi predefiniti di prima erano scritti in italiano: ora vuoti, così seguono la lingua
    s.names = s.names.map((name, i) => (name === `Giocatore ${i + 1}` ? "" : name));
    if (s.lang !== "auto" && !LANGUAGES[s.lang]) s.lang = "auto";
    return s;
  } catch (e) {
    return defaults;
  }
}

function saveSettings() {
  try {
    Platform.settingsStorage().setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // storage non disponibile (navigazione privata...): le impostazioni valgono solo per questa sessione
  }
}

function startRun() {
  try {
    const first = !sessionStorage.getItem(RUN_KEY);
    sessionStorage.setItem(RUN_KEY, "1");
    return first;
  } catch (e) {
    return true;
  }
}

function myName() {
  return settings.myName.trim() || t("name.default");
}

function setup() {
  const stage = document.getElementById("stage");
  const canvas = createCanvas(Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight));
  canvas.parent(stage);
  // Oltre 2x non si vede differenza, ma su telefoni 3x i pixel da disegnare sarebbero più del doppio
  pixelDensity(Math.min(2, displayDensity()));
  const el = canvas.elt;
  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId === activePointer || (activePointer === null && e.pointerType === "mouse")) {
      board.pointerMove(toBoard(e.offsetX, e.offsetY));
    }
  });
  el.addEventListener("pointerup", (e) => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    board.pointerUp(toBoard(e.offsetX, e.offsetY));
  });
  el.addEventListener("pointercancel", (e) => {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    board.pointerCancel();
  });
  el.addEventListener("pointerleave", () => {
    if (activePointer === null) board.pointer = null; // via l'hover del menu
  });
  // Anche il primo click su un pulsante HTML (es. SPARA) deve poter sbloccare l'audio
  document.addEventListener("pointerdown", () => sfx.unlock(), { capture: true });
  strokeJoin(ROUND);

  sfx = new SoundFX(settings.muted);
  board = new Board();
  board.onEvent = (name, data) => {
    sfx.play(name, data);
    ui.onEvent(name, data);
    tutorial.onEvent(name, data);
    if (settings.haptics) haptic(name, data);
    if (name === "desync") online.onDesync();
  };
  board.onFireRequest = () => ui.requestFire();
  online = new Online(board, {
    myName,
    newGame: () => newGame("online"),
    onNewGameRequest(name) {
      if (board.gameOver || board.history.length === 0) {
        online.answerNewGame(true);
        return;
      }
      ui.ask(t("ask.newGameRequest.title"), t("ask.newGameRequest.text", { name }), t("ask.newGameRequest.yes"), t("ask.newGameRequest.no"))
        .then((ok) => online.answerNewGame(ok));
    },
    onNewGameReply(accepted) {
      ui.toast(accepted ? t("toast.newGame") : t("toast.declined", { name: online.opponentName || t("name.theOpponent") }));
    },
    onChange() {
      syncMode();
      onlinePanel.render();
      // Diventare (o smettere di essere) l'arancione online gira la board
      if (view.side !== board.localIndex) fitCanvas();
    },
  });
  game.mode = settings.mode;
  ui = new GameUI(board, online, {
    settings,
    game,
    saveSettings,
    newGame,
    applyOptions,
    pieceIcon,
    setupPreview,
    welcomeArt,
    startTutorial,
    relayout: fitCanvas,
    // Centro e lato di una casella in pixel dentro #stage, e la casella in un punto di #stage
    // (per frecce di rotazione ed etichette)
    cellOnScreen(cell) {
      const p = boardToScreen(cell.center.x, cell.center.y);
      return { x: p.x, y: p.y, size: cell.size * view.scale };
    },
    cellAtScreen: (x, y) => board.cellAt(toBoard(x, y)),
    stageSize: () => ({ w: width, h: height }),
    setMuted(muted) {
      settings.muted = muted;
      sfx.setMuted(muted);
      saveSettings();
    },
  });
  onlinePanel = new OnlinePanel(online, {
    settings,
    saveSettings,
    myName,
    onEvent: (name) => sfx.play(name),
    toast: (text) => ui.toast(text),
    ask: (...args) => ui.ask(...args),
  });
  tutorial = new Tutorial(board, {
    myName,
    relayout: fitCanvas,
    begin() {
      game.mode = "tutorial";
      game.ai = null;
      forgetLocalGame(); // la partita di prima non si riprende più
      for (const dlg of document.querySelectorAll("dialog[open]")) dlg.close();
    },
    end(play) {
      if (play) {
        settings.mode = "ai";
        saveSettings();
        newGame("ai");
      } else {
        newGame(settings.mode);
        ui.openNewGame();
      }
    },
  });
  ui.tutorial = tutorial;
  applyOptions();
  Platform.start();
  Platform.onBack(onBack);

  // Si riprende la partita di prima, altrimenti se ne prepara una nuova. Pagina ricaricata: si
  // continua e basta. Scheda nuova o app appena aperta: benvenuto, con "Riprendi la partita" se
  // ce n'era una (scegliendo altro, la nuova partita prende il suo posto).
  // Aperto da un link d'invito (?partita=CODICE): si propone di entrare, a meno che questa
  // scheda non fosse già in quella partita
  const resumable = restoreLocalGame();
  if (!resumable) newGame();
  const code = new URLSearchParams(location.search).get("partita");
  const saved = online.savedSession();
  if (saved && (!code || normalizeCode(code) === saved.code)) online.resume();
  else if (code) onlinePanel.openInvite(code);
  else if (firstRun) ui.openWelcome(resumable);
  fitCanvas();
  Platform.ready();
}

// Vibrazione nell'app per gli eventi della board
function haptic(name, data) {
  if (name === "select") Platform.haptic("tap");
  else if (name === "move" || name === "rotate") Platform.haptic("move");
  else if (name === "fire") Platform.haptic("fire");
  else if (name === "destroy" || name === "king") Platform.haptic("hit");
  else if (name === "gameover" && board.localIndex !== null) {
    Platform.haptic(data.winner === board.localPlayer ? "win" : data.winner ? "lose" : "warn");
  }
}

// Tasto indietro di Android: chiude quello che è aperto, poi deseleziona; altrimenti l'app va in
// secondo piano (la partita resta salvata)
function onBack() {
  const dialogs = [...document.querySelectorAll("dialog[open]")];
  if (dialogs.length > 0) {
    const dlg = dialogs[dialogs.length - 1];
    if (dlg.id === "dlg-ask") ui.cancelAsk();
    else dlg.close();
    return;
  }
  const over = document.getElementById("gameover");
  if (!over.hidden) {
    over.hidden = true;
    return;
  }
  if (board.selected || board.menu) {
    board.cancelSelection();
    return;
  }
  if (tutorial.active) {
    tutorial.exit(false);
    return;
  }
  Platform.leave();
}

// Tutorial dall'inizio. Online no: la partita è con l'amico
async function startTutorial() {
  if (online.active) {
    ui.toast(t("toast.leaveOnlineFirst"));
    return;
  }
  if (game.mode !== "tutorial" && !(await ui.confirmLoseGame())) return;
  tutorial.start();
}

// Allinea la modalità della partita allo stato online
function syncMode() {
  if (online.active) {
    // Si ricorda la partita di prima, per tornarci se online non si gioca (codice sbagliato...)
    if (game.mode !== "online") game.before = { mode: game.mode, ai: game.ai, version: board.version };
    game.mode = "online";
    game.ai = null;
  } else if (game.mode === "online") {
    const before = game.before;
    game.before = null;
    if (before && before.version === board.version) {
      // La board non è cambiata: si riprende la partita di prima, col computer se c'era
      game.mode = before.mode;
      game.ai = before.ai;
      board.localIndex = before.ai ? 1 - before.ai.side : null;
      board.opponentReady = !!before.ai;
    } else {
      // Usciti da una partita online: la board resta e si continua in due su questo schermo
      game.mode = "local";
      board.localIndex = null;
      board.opponentReady = false;
    }
  }
}

// Nuova partita con le scelte attuali. mode: "ai", "local" o "online" (di solito quella in corso)
function newGame(mode = game.mode) {
  if (online.role === "guest") {
    online.requestNewGame(); // online la nuova partita la crea chi ospita
    return;
  }
  if (online.active) mode = "online";
  if (mode !== "ai" && mode !== "local" && mode !== "online") mode = settings.mode;
  tutorial.stop();
  const variants = Object.keys(VARIANTS).filter((k) => settings.variants[k]);
  game.mode = mode;
  game.ai = null;
  let names;
  if (mode === "online") {
    names = [myName(), online.opponentName || t("name.opponent")];
  } else if (mode === "ai") {
    const human = settings.humanSide;
    const computer = t("name.computer");
    names = human === 0 ? [myName(), computer] : [computer, myName()];
    board.localIndex = human;
    board.opponentReady = true;
    game.ai = new AIPlayer(board, 1 - human, settings.aiLevel);
  } else {
    names = settings.names.map((name, i) => name || t("name.player", { n: i + 1 }));
    board.localIndex = null;
    board.opponentReady = false;
  }
  board.setup(settings.setup, names, variants);
  board.start();
  online.sendSync();
  saveLocalGame();
  fitCanvas();
}

// ---------- Partita salvata (in due o contro il computer) ----------

function saveLocalGame() {
  savedVersion = board.version;
  if (online.active || game.mode === "tutorial") return; // la partita online la salva Online.js
  const storage = Platform.gameStorage();
  if (!storage) return;
  try {
    storage.setItem(GAME_KEY, JSON.stringify({
      mode: game.mode,
      ai: game.ai && { side: game.ai.side, level: game.ai.level },
      snapshot: board.snapshot(),
    }));
  } catch (e) {
    // storage non disponibile: ricaricando si ricomincia
  }
}

function forgetLocalGame() {
  try {
    Platform.gameStorage().removeItem(GAME_KEY);
  } catch (e) {
    // storage non disponibile: non c'è niente da dimenticare
  }
}

// Partita salvata da riprendere: solo se è iniziata e non è finita
function restoreLocalGame() {
  try {
    const saved = JSON.parse(Platform.gameStorage().getItem(GAME_KEY));
    if (!saved || !saved.snapshot || saved.snapshot.gameOver || saved.snapshot.history.length === 0) return false;
    board.restore(saved.snapshot);
    if (saved.mode === "ai" && saved.ai) {
      game.mode = "ai";
      board.localIndex = 1 - saved.ai.side;
      board.opponentReady = true;
      game.ai = new AIPlayer(board, saved.ai.side, saved.ai.level);
    } else {
      game.mode = "local";
      board.localIndex = null;
      game.ai = null;
    }
    savedVersion = board.version;
    return true;
  } catch (e) {
    return false; // dati vecchi o rovinati: nuova partita
  }
}

// ---------- Opzioni ----------

function applyOptions() {
  board.showPreview = settings.preview;
  document.getElementById("coach").hidden = !settings.coach;
  fitCanvas();
}

// ---------- Immagini disegnate con p5 (legenda, anteprime) ----------

// Disegna con drawFn sul canvas principale e restituisce un'immagine (data URL) del riquadro
// w×h in alto a sinistra, ingrandito k volte. Il canvas viene ridisegnato al frame dopo.
function renderToImage(w, h, k, drawFn) {
  const d = pixelDensity();
  const src = drawingContext.canvas;
  k = Math.min(k, src.width / (w * d), src.height / (h * d));
  if (!(k > 0)) return null;
  push();
  resetMatrix();
  clear();
  scale(k);
  drawFn();
  pop();
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w * k * d));
  out.height = Math.max(1, Math.round(h * k * d));
  out.getContext("2d").drawImage(src, 0, 0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL();
}

// Immagine di un pezzo, disegnato come sulla board
function pieceIcon(PieceClass, player, rot = null) {
  const piece = new PieceClass(player);
  piece.cell = new Cell(0, CELL_SIZE); // la casella in alto a sinistra
  piece.board = board;
  piece.rot = rot || "N";
  try {
    for (const d of DIRS) piece.hit(d);
  } catch (e) {
    piece.rot = "NW"; // pezzo con le rotazioni in diagonale (Deflector)
  }
  return renderToImage(CELL_SIZE, CELL_SIZE, 1.2, () => piece.draw());
}

// Immagine per la finestra di benvenuto: la prima lezione del tutorial risolta, con il raggio
// che rimbalza sullo specchio e colpisce il King arancione
function welcomeArt() {
  const k = 0.7;
  const tmp = new Board();
  const { pieces, hint } = LESSONS[0];
  tmp.setup("", ["", ""], [], pieces);
  tmp.cellByName(hint.at).piece.rot = hint.rot;
  tmp.beam = new LaserBeam(tmp, tmp.players[0].laser);
  tmp.beam.progress = tmp.beam.duration;
  tmp.setRenderScale(k);
  const url = renderToImage(tmp.width + 1, tmp.height + 1, k, () => tmp.show());
  tmp.invalidateGrid();
  return url;
}

// Immagine della board con una disposizione iniziale
function setupPreview(name, variants) {
  const key = `${name}|${variants.join(",")}`;
  if (!previews.has(key)) {
    const k = 0.7;
    const tmp = new Board();
    tmp.setup(name, ["", ""], variants);
    tmp.setRenderScale(k);
    const url = renderToImage(tmp.width + 1, tmp.height + 1, k, () => tmp.show());
    tmp.invalidateGrid();
    if (!url) return null;
    previews.set(key, url);
  }
  return previews.get(key);
}

// ---------- Input e layout ----------

function onPointerDown(e) {
  e.preventDefault();
  if (activePointer !== null || (e.button !== 0 && e.button !== 2)) return;
  activePointer = e.pointerId;
  // Così il trascinamento continua anche se il dito/mouse esce dal canvas
  e.currentTarget.setPointerCapture(e.pointerId);
  board.pointerDown(toBoard(e.offsetX, e.offsetY), e.button);
}

// Da pixel del canvas a coordinate board (l'inverso della trasformazione in draw)
function toBoard(px, py) {
  const u = (px - view.x) / view.scale;
  const v = (py - view.y) / view.scale;
  const W = board.width;
  const H = board.height;
  return view.turns === 2 ? { x: W - u, y: H - v } : { x: u, y: v };
}

// Da coordinate board a pixel del canvas
function boardToScreen(bx, by) {
  const W = board.width;
  const H = board.height;
  const [u, v] = view.turns === 2 ? [W - bx, H - by] : [bx, by];
  return { x: view.x + u * view.scale, y: view.y + v * view.scale };
}

// Adatta canvas e board allo spazio disponibile
function fitCanvas() {
  if (!board) return;
  const stage = document.getElementById("stage");
  const stacked = matchMedia(STACKED_QUERY).matches;
  const pad = stacked ? 6 : 24;
  // Altezza utile: lo schermo meno i bordi riservati a notch e barre di sistema (padding di #app)
  const app = document.getElementById("app");
  const css = getComputedStyle(app);
  const screenH = app.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
  const w = stage.clientWidth;
  const fit = (W, H) => Math.min((W - 2 * pad) / board.width, (H - 2 * pad) / board.height);

  let h;
  if (stacked) {
    // Lascia spazio a stato, suggerimenti, comandi, menu e almeno la riga "Mosse" (lo storico
    // prende lo spazio che avanza, quindi conta solo la sua intestazione)
    // (con lo storico aperto, posto per qualche mossa)
    const reserved = ["status", "coach", "controls", "menu"]
      .reduce((sum, id) => sum + document.getElementById(id).offsetHeight, 0) +
      document.querySelector("#history-box summary").offsetHeight + 16 +
      (document.getElementById("history-box").open ? 120 : 0);
    view.scale = Math.max(0.3, fit(w, Math.max(200, screenH - reserved)));
    h = Math.ceil(board.height * view.scale + 2 * pad);
    stage.style.height = h + "px";
  } else {
    stage.style.height = "";
    h = Math.min(stage.clientHeight, screenH); // se la barra laterale non ci sta, la board resta nello schermo
    view.scale = Math.max(0.3, Math.min(2, fit(w, h)));
  }
  view.side = board.localIndex;
  view.turns = board.localIndex === 1 ? 2 : 0;

  resizeCanvas(w, h);
  view.x = Math.floor((w - board.width * view.scale) / 2);
  view.y = Math.floor((h - board.height * view.scale) / 2);
  board.setRenderScale(view.scale);
}

function windowResized() {
  fitCanvas();
}

function draw() {
  // Limita dt: dopo un cambio di scheda deltaTime può essere enorme
  const dt = Math.min(deltaTime, 50) / 1000;
  // Mentre si sceglie la nuova partita la board è vuota e il computer aspetta
  const choosing = document.getElementById("dlg-new").open;
  board.update(dt);
  // Il computer aspetta anche dietro il benvenuto (la partita ripresa resta com'era)
  if (game.ai && !choosing && !document.getElementById("dlg-welcome").open) game.ai.update(dt);
  online.update();
  ui.update();
  if (!online.active && !board.busy && board.version !== savedVersion) saveLocalGame();
  background(10);
  translate(view.x, view.y);
  scale(view.scale);
  if (view.turns === 2) {
    translate(board.width, board.height);
    rotate(PI);
  }
  if (choosing) board.showEmpty();
  else board.show();
}

function keyPressed() {
  const el = document.activeElement;
  // Mentre si scrive (nomi, codice) o con una finestra aperta i tasti non comandano il gioco
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
  if (document.querySelector("dialog[open]")) return;
  const onControl = el && ["BUTTON", "SUMMARY"].includes(el.tagName);
  if ((key === " " || keyCode === ENTER) && onControl) return; // ci pensa il pulsante col focus
  if (key === " " || key === "f" || key === "F") {
    ui.requestFire();
    return false;
  }
  if ((key === "z" || key === "Z") && (keyIsDown(CONTROL) || keyIsDown(91) || keyIsDown(93))) {
    board.undoMove(); // Ctrl+Z (Cmd+Z su Mac)
    return false;
  }
  if (key === "q" || key === "Q") board.rotateSelected(-1);
  else if (key === "e" || key === "E") board.rotateSelected(1);
  else if (key === "r" || key === "R") ui.confirmNewGame();
  else if (keyCode === ESCAPE) {
    // Prima di sparare Esc annulla la mossa, altrimenti la selezione
    if (board.localCanUndo) board.undoMove();
    else board.cancelSelection();
  }
}
