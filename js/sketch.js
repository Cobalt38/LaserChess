let board, sfx, ui, online, onlinePanel;
// Partita in corso: "ai" contro il computer, "local" in due sullo stesso schermo, "online"
const game = { mode: "local", ai: null };

// Come la board finisce nel canvas: spostamento, zoom e quarti di giro in senso orario.
// Si gira di 90° sui telefoni in verticale e di 180° per chi gioca con l'arancione (online o
// contro il computer), così ognuno vede i propri pezzi in basso.
const view = { x: 0, y: 0, scale: 1, turns: 0 };
// Deve combaciare con la media query del layout "a colonna" in style.css
const STACKED_QUERY = "(max-width: 760px) and (orientation: portrait)";
const SETTINGS_KEY = "laserchess.settings";
// Da aumentare quando cambia un'impostazione predefinita da applicare anche a chi le ha già salvate
// (2: la disposizione predefinita diventa PRISMA)
const SETTINGS_VERSION = 2;
const GAME_KEY = "laserchess.game"; // partita in corso (non online), per riprenderla ricaricando
const settings = loadSettings();
let activePointer = null; // un solo dito/puntatore alla volta sulla board
let savedVersion = -1; // board.version dell'ultima partita salvata
const previews = new Map(); // immagini delle disposizioni iniziali

function loadSettings() {
  const defaults = {
    muted: false,
    mode: "ai", // modalità della prossima partita: "ai" o "local" (online si sceglie a parte)
    aiLevel: "medium",
    humanSide: 0, // contro il computer: 0 blu (muove per primo), 1 arancione
    setup: "PRISMA",
    variants: { prism: false, halfMirror: false },
    names: ["Giocatore 1", "Giocatore 2"], // partita sullo stesso schermo
    myName: "", // contro il computer e online
    preview: true, // linea tratteggiata del laser
    coach: true, // suggerimenti sotto la board
    seenIntro: false, // la finestra iniziale con le istruzioni è già stata vista
    version: SETTINGS_VERSION,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    const s = { ...defaults, ...saved, variants: { ...defaults.variants, ...saved.variants } };
    if (!(saved.version >= 2)) s.setup = defaults.setup;
    s.version = SETTINGS_VERSION;
    if (!SETUPS[s.setup]) s.setup = defaults.setup;
    if (!AI_LEVELS[s.aiLevel]) s.aiLevel = defaults.aiLevel;
    if (s.mode !== "ai" && s.mode !== "local") s.mode = defaults.mode;
    if (s.humanSide !== 0 && s.humanSide !== 1) s.humanSide = 0;
    if (!Array.isArray(s.names) || s.names.length !== 2) s.names = defaults.names;
    return s;
  } catch (e) {
    return defaults;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // storage non disponibile (navigazione privata...): le impostazioni valgono solo per questa sessione
  }
}

function myName() {
  return settings.myName.trim() || "Giocatore";
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
    if (name === "desync") online.onDesync();
  };
  online = new Online(board, {
    myName,
    newGame: () => newGame("online"),
    onNewGameRequest(name) {
      if (board.gameOver || board.history.length === 0) {
        online.answerNewGame(true);
        return;
      }
      ui.ask("Nuova partita?", `${name} vuole ricominciare da capo. Accetti?`, "Accetta", "Rifiuta")
        .then((ok) => online.answerNewGame(ok));
    },
    onNewGameReply(accepted) {
      ui.toast(accepted ? "Nuova partita!" : `${online.opponentName || "L'avversario"} preferisce finire questa partita.`);
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
    relayout: fitCanvas,
    // Centro e lato di una casella in pixel dentro #stage (per le frecce di rotazione)
    cellOnScreen(cell) {
      const p = boardToScreen(cell.center.x, cell.center.y);
      return { x: p.x, y: p.y, size: cell.size * view.scale };
    },
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
  applyOptions();

  // Si riprende la partita di prima (pagina ricaricata), altrimenti se ne prepara una nuova.
  // Aperto da un link d'invito (?partita=CODICE): si propone di entrare, a meno che questa
  // scheda non fosse già in quella partita
  if (!restoreLocalGame()) newGame();
  const code = new URLSearchParams(location.search).get("partita");
  const saved = online.savedSession();
  if (saved && (!code || normalizeCode(code) === saved.code)) online.resume();
  else if (code) onlinePanel.openInvite(code);
  else if (!settings.seenIntro) ui.openNewGame();
  fitCanvas();
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
  const variants = Object.keys(VARIANTS).filter((k) => settings.variants[k]);
  game.mode = mode;
  game.ai = null;
  let names;
  if (mode === "online") {
    names = [myName(), online.opponentName || "Avversario"];
  } else if (mode === "ai") {
    const human = settings.humanSide;
    names = human === 0 ? [myName(), "Computer"] : ["Computer", myName()];
    board.localIndex = human;
    board.opponentReady = true;
    game.ai = new AIPlayer(board, 1 - human, settings.aiLevel);
  } else {
    names = [...settings.names];
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
  if (online.active) return; // la partita online la salva Online.js
  try {
    sessionStorage.setItem(GAME_KEY, JSON.stringify({
      mode: game.mode,
      ai: game.ai && { side: game.ai.side, level: game.ai.level },
      snapshot: board.snapshot(),
    }));
  } catch (e) {
    // storage non disponibile: ricaricando si ricomincia
  }
}

function restoreLocalGame() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(GAME_KEY));
    if (!saved || !saved.snapshot) return false;
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
  switch (view.turns) {
    case 1: return { x: v, y: H - u };
    case 2: return { x: W - u, y: H - v };
    case 3: return { x: W - v, y: u };
    default: return { x: u, y: v };
  }
}

// Da coordinate board a pixel del canvas
function boardToScreen(bx, by) {
  const W = board.width;
  const H = board.height;
  const [u, v] = [[bx, by], [H - by, bx], [W - bx, H - by], [by, W - bx]][view.turns];
  return { x: view.x + u * view.scale, y: view.y + v * view.scale };
}

// Adatta canvas e board allo spazio disponibile
function fitCanvas() {
  if (!board) return;
  const stage = document.getElementById("stage");
  const stacked = matchMedia(STACKED_QUERY).matches;
  const pad = stacked ? 6 : 24;
  const w = stage.clientWidth;
  const size = (sideways) => sideways
    ? { w: board.height, h: board.width }
    : { w: board.width, h: board.height };
  const fit = (W, H, sideways) => {
    const s = size(sideways);
    return Math.min((W - 2 * pad) / s.w, (H - 2 * pad) / s.h);
  };

  let h;
  let sideways = false;
  if (stacked) {
    // Lascia spazio a stato, suggerimenti, comandi, menu e almeno la riga "Mosse" (lo storico
    // prende lo spazio che avanza, quindi conta solo la sua intestazione)
    const reserved = ["status", "coach", "controls", "menu"]
      .reduce((sum, id) => sum + document.getElementById(id).offsetHeight, 0) +
      document.querySelector("#history-box summary").offsetHeight + 16;
    const maxH = Math.max(200, window.innerHeight - reserved);
    const normal = fit(w, maxH, false);
    const turned = fit(w, maxH, true);
    sideways = turned > normal * 1.08; // in verticale di solito la board ci sta meglio girata
    view.scale = Math.max(0.3, sideways ? turned : normal);
    h = Math.ceil(size(sideways).h * view.scale + 2 * pad);
    stage.style.height = h + "px";
  } else {
    stage.style.height = "";
    h = Math.min(stage.clientHeight, window.innerHeight); // se la barra laterale non ci sta, la board resta nello schermo
    view.scale = Math.max(0.3, Math.min(2, fit(w, h, false)));
  }
  view.side = board.localIndex;
  view.turns = ((sideways ? 1 : 0) + (board.localIndex === 1 ? 2 : 0)) % 4;

  resizeCanvas(w, h);
  const s = size(sideways);
  view.x = Math.floor((w - s.w * view.scale) / 2);
  view.y = Math.floor((h - s.h * view.scale) / 2);
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
  if (game.ai && !choosing) game.ai.update(dt);
  online.update();
  ui.update();
  if (!online.active && !board.busy && board.version !== savedVersion) saveLocalGame();
  background(10);
  translate(view.x, view.y);
  scale(view.scale);
  if (view.turns === 1) {
    translate(board.height, 0);
    rotate(HALF_PI);
  } else if (view.turns === 2) {
    translate(board.width, board.height);
    rotate(PI);
  } else if (view.turns === 3) {
    translate(0, board.width);
    rotate(-HALF_PI);
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
    board.fireLaser();
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
