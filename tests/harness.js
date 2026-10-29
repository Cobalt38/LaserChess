// Carica gli script del gioco in Node, senza browser: le funzioni di disegno di p5 non fanno nulla.
// Gli script vengono letti da shared/index.html, nello stesso ordine del browser.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "shared");
// Interfaccia, rete, audio e avvio di p5 servono solo nel browser
const SKIP = /^js\/(sketch\.js|ui\/|net\/|fx\/Sound\.js)/;

function load() {
  const noop = () => { };
  const drawing = ["push", "pop", "fill", "stroke", "noStroke", "noFill", "strokeWeight", "rect", "ellipse",
    "line", "arc", "triangle", "translate", "rotate", "scale", "beginShape", "endShape", "vertex", "rectMode",
    "blendMode", "point", "image", "strokeCap", "background", "resetMatrix", "clear", "text", "textAlign", "textSize"];
  const ctx = {
    console, Math, Date, Error, TypeError, JSON, Map, Set, Uint8Array, Int8Array, Int32Array,
    HALF_PI: Math.PI / 2, PI: Math.PI, QUARTER_PI: Math.PI / 4, TWO_PI: Math.PI * 2,
    CENTER: "center", CORNER: "corner", CLOSE: "close", CHORD: "chord", ROUND: "round", SQUARE: "square",
    PROJECT: "project", ADD: "add", BLEND: "blend", TRIANGLE_FAN: "fan", deltaTime: 16,
    print: noop,
    millis: () => Date.now(),
    lerp: (a, b, t) => a + (b - a) * t,
    abs: Math.abs, cos: Math.cos, sin: Math.sin,
    random(a, b) {
      if (Array.isArray(a)) return a[Math.floor(Math.random() * a.length)];
      if (a === undefined) return Math.random();
      if (b === undefined) return Math.random() * a;
      return a + Math.random() * (b - a);
    },
    drawingContext: { setLineDash: noop },
    createGraphics: () => new Proxy({}, { get: () => noop }),
  };
  for (const name of drawing) ctx[name] = noop;
  vm.createContext(ctx);
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  // (senza il ?v=... che serve solo al browser per la cache)
  const scripts = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map((m) => m[1]).filter((s) => !SKIP.test(s));
  for (const file of scripts) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  }
  // Le classi e le costanti dichiarate negli script non finiscono come proprietà del contesto:
  // si leggono valutando il loro nome
  return new Proxy(ctx, { get: (target, name) => (name in target ? target[name] : vm.runInContext(String(name), ctx)) });
}

// Fa avanzare la board finché il laser non ha finito (il colpo è animato)
function settle(board) {
  for (let i = 0; i < 2000 && (board.busy || board.remoteQueue.length > 0); i++) board.update(0.05);
}

module.exports = { load, settle };
