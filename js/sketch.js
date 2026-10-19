let board, sfx, ui, online, onlinePanel;

// Come la board finisce nel canvas: spostamento, zoom e quarti di giro in senso orario.
// Si gira di 90° sui telefoni in verticale e di 180° per chi gioca online con l'arancione,
// così ognuno vede i propri pezzi in basso.
const view = { x: 0, y: 0, scale: 1, turns: 0 };
// Deve combaciare con la media query del layout "a colonna" in style.css
const STACKED_QUERY = "(max-width: 760px) and (orientation: portrait)";
const SETTINGS_KEY = "laserchess.settings";
const settings = loadSettings();
let activePointer = null; // un solo dito/puntatore alla volta sulla board

function loadSettings() {
  const defaults = {
    muted: false,
    variants: { prism: true, halfMirror: true },
    names: ["Giocatore 1", "Giocatore 2"], // partita sullo stesso schermo
    myName: "", // partita online
  };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    return { ...defaults, ...saved, variants: { ...defaults.variants, ...saved.variants } };
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
    newGame,
    onNewGameRequest(name) {
      if (board.gameOver || board.history.length === 0 ||
        confirm(`${name} vuole iniziare una nuova partita. Accetti?`)) newGame();
    },
    onChange() {
      onlinePanel.render();
      // Diventare (o smettere di essere) l'arancione online gira la board
      if (view.side !== board.localIndex) fitCanvas();
    },
  });
  ui = new GameUI(board, online, {
    settings,
    newGame,
    saveSettings,
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
  });
  newGame();
  fitCanvas();

  // Aperto da un link d'invito (?partita=CODICE): si propone di entrare
  const code = new URLSearchParams(location.search).get("partita");
  if (code) onlinePanel.openInvite(code);
}

function newGame() {
  if (online.role === "guest") {
    online.requestNewGame(); // online la nuova partita la crea chi ospita
    return;
  }
  const variants = Object.keys(VARIANTS).filter((k) => settings.variants[k]);
  const names = online.active ? [myName(), online.opponentName || "Avversario"] : settings.names;
  board.setup("ACE", names, variants);
  board.start();
  online.sendSync();
}

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
    // Lascia spazio a stato, comandi e qualche riga di storico
    const reserved = ["status", "controls"]
      .reduce((sum, id) => sum + document.getElementById(id).offsetHeight, 0) + 110;
    const maxH = Math.max(200, window.innerHeight - reserved);
    const normal = fit(w, maxH, false);
    const turned = fit(w, maxH, true);
    sideways = turned > normal * 1.08; // in verticale di solito la board ci sta meglio girata
    view.scale = Math.max(0.3, sideways ? turned : normal);
    h = Math.ceil(size(sideways).h * view.scale + 2 * pad);
    stage.style.height = h + "px";
  } else {
    stage.style.height = "";
    h = stage.clientHeight;
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
  board.update(Math.min(deltaTime, 50) / 1000);
  online.update();
  ui.update();
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
  board.show();
}

function keyPressed() {
  const el = document.activeElement;
  // Mentre si scrive (nomi, codice) o con una finestra aperta i tasti non comandano il gioco
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
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
  if (key === "r" || key === "R") ui.confirmNewGame();
  else if (keyCode === ESCAPE) {
    // Prima di sparare Esc annulla la mossa, altrimenti la selezione
    if (board.localCanUndo) board.undoMove();
    else board.cancelSelection();
  }
}
