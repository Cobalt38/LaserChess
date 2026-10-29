// App per Android e iOS (Capacitor): quello che il codice comune in shared/ chiede alla
// piattaforma. La versione per il browser ha lo stesso oggetto Platform in web/js/Platform.js.
// I plugin di Capacitor (window.Capacitor.Plugins) li aggiunge app/build.mjs prima di questo file.

// Gioco pubblicato su GitHub Pages: nell'app la pagina è "https://localhost", quindi i link
// d'invito e la pagina della privacy puntano qui (l'amico può giocare dal browser, senza l'app)
const PUBLIC_URL = "https://cobalt38.github.io/LaserChess/";

const Platform = {
  isApp: true,

  plugin(name) {
    const cap = window.Capacitor;
    return cap && cap.Plugins ? cap.Plugins[name] || null : null;
  },

  // Chiama un metodo di un plugin senza far fallire il gioco se manca o dà errore
  call(name, method, options) {
    const p = this.plugin(name);
    if (!p || typeof p[method] !== "function") return Promise.resolve(null);
    try {
      return Promise.resolve(p[method](options)).catch(() => null);
    } catch (e) {
      return Promise.resolve(null);
    }
  },

  start() {
    document.documentElement.classList.add("app");
  },

  // Gioco pronto sullo schermo: via la schermata iniziale, barra di stato scura
  ready() {
    this.call("StatusBar", "setStyle", { style: "DARK" });
    this.call("StatusBar", "setBackgroundColor", { color: "#0a0a0a" });
    this.call("SplashScreen", "hide");
  },

  // Vibrazione breve. kind: "tap", "move", "fire", "hit", "win", "lose", "warn"
  haptic(kind) {
    const impact = { tap: "LIGHT", move: "MEDIUM", fire: "MEDIUM", hit: "HEAVY" }[kind];
    if (impact) this.call("Haptics", "impact", { style: impact });
    const note = { win: "SUCCESS", lose: "ERROR", warn: "WARNING" }[kind];
    if (note) this.call("Haptics", "notification", { type: note });
  },

  inviteBase() {
    return PUBLIC_URL;
  },

  privacyUrl: PUBLIC_URL + "privacy.html",

  canShare() {
    return true;
  },

  async share({ title, text, url }) {
    return (await this.call("Share", "share", { title, text, url, dialogTitle: title })) !== null;
  },

  async copy(text) {
    return (await this.call("Clipboard", "write", { string: text })) !== null;
  },

  // Tasto "indietro" di Android
  onBack(handler) {
    const app = this.plugin("App");
    if (app) app.addListener("backButton", handler);
  },

  // Indietro quando non c'è nulla da chiudere: l'app va in secondo piano (la partita resta)
  leave() {
    this.call("App", "minimizeApp");
  },

  // Impostazioni (audio, vibrazione, nomi...): l'app le ricorda
  settingsStorage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  },

  // Partita in corso: resta anche chiudendo l'app, per "Riprendi la partita" nel benvenuto
  gameStorage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  },
};
