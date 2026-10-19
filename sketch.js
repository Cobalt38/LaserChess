let board, sfx, ui;

// Come la board finisce nel canvas: spostamento, zoom e rotazione (telefono in verticale)
const view = { x: 0, y: 0, scale: 1, rotated: false };
// Deve combaciare con la media query del layout "a colonna" in style.css
const STACKED_QUERY = "(max-width: 760px) and (orientation: portrait)";
const SETTINGS_KEY = "laserchess.settings";
const settings = loadSettings();
let activePointer = null; // un solo dito/puntatore alla volta sulla board

function loadSettings() {
  const defaults = { muted: false, variants: { prism: true, halfMirror: true } };
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
  };
  ui = new GameUI(board, {
    settings,
    newGame,
    setMuted(muted) {
      settings.muted = muted;
      sfx.setMuted(muted);
      saveSettings();
    },
    setVariant(key, on) {
      settings.variants[key] = on;
      saveSettings();
    },
  });
  newGame();
  fitCanvas();
}

function newGame() {
  const variants = Object.keys(VARIANTS).filter((k) => settings.variants[k]);
  board.setup("ACE", ["Mario", "Luigi"], variants);
  board.start();
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
  return view.rotated ? { x: v, y: board.height - u } : { x: u, y: v };
}

// Adatta canvas e board allo spazio disponibile. Su telefono in verticale la board gira di 90°
// se così viene più grande
function fitCanvas() {
  const stage = document.getElementById("stage");
  const stacked = matchMedia(STACKED_QUERY).matches;
  const pad = stacked ? 6 : 24;
  const w = stage.clientWidth;
  const size = (rotated) => rotated
    ? { w: board.height, h: board.width }
    : { w: board.width, h: board.height };
  const fit = (W, H, rotated) => {
    const s = size(rotated);
    return Math.min((W - 2 * pad) / s.w, (H - 2 * pad) / s.h);
  };

  let h;
  if (stacked) {
    // Lascia spazio a stato, comandi e qualche riga di storico
    const reserved = ["status", "controls"]
      .reduce((sum, id) => sum + document.getElementById(id).offsetHeight, 0) + 110;
    const maxH = Math.max(200, window.innerHeight - reserved);
    const normal = fit(w, maxH, false);
    const rotated = fit(w, maxH, true);
    view.rotated = rotated > normal * 1.08;
    view.scale = Math.max(0.3, view.rotated ? rotated : normal);
    h = Math.ceil(size(view.rotated).h * view.scale + 2 * pad);
    stage.style.height = h + "px";
  } else {
    stage.style.height = "";
    h = stage.clientHeight;
    view.rotated = false;
    view.scale = Math.max(0.3, Math.min(2, fit(w, h, false)));
  }

  resizeCanvas(w, h);
  const s = size(view.rotated);
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
  ui.update();
  background(10);
  translate(view.x, view.y);
  scale(view.scale);
  if (view.rotated) {
    translate(board.height, 0);
    rotate(HALF_PI);
  }
  board.show();
}

function keyPressed() {
  const onControl = ["BUTTON", "INPUT", "SUMMARY"].includes(document.activeElement?.tagName);
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
    if (board.canUndo) board.undoMove();
    else board.cancelSelection();
  }
}
