// Il gioco come app, dal browser, senza APK e senza avvisi di sicurezza (manifest.webmanifest e sw.js,
// che la fa funzionare anche senza internet):
// - nel benvenuto "📱 Installa l'app": se il browser offre l'installazione (Chrome ed Edge mandano
//   beforeinstallprompt, ma solo dopo un po' che si usa il sito; Firefox e Safari mai) apre la sua
//   finestra, altrimenti apre la sezione Installa in ⚙️ Opzioni;
// - la sezione Installa (elementi con data-get-app="all") dice quale browser e sistema si stanno
//   usando e i passi per installarla lì; su Android c'è anche l'APK (download/latest.json, lo mette
//   il workflow di GitHub Pages con app/publish-apk.mjs).
// Già aperto come app installata: nel benvenuto niente, nella sezione "già installata".

// Chrome offre l'installazione con un evento che può arrivare prima dell'avvio del gioco
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // niente barra di Chrome: c'è il nostro pulsante
  installPrompt = e;
  if (window.appInstall) window.appInstall.render();
});

// Sistema e browser dal nome che il browser dà di sé (navigator.userAgent)
function detectPlatform(ua) {
  // (gli iPad recenti si presentano come un Mac, ma col touch)
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const os = ios ? "ios" : /Android/.test(ua) ? "android" : /Windows/.test(ua) ? "windows"
    : /Mac OS X|Macintosh/.test(ua) ? "mac" : /Linux|CrOS/.test(ua) ? "linux" : "other";
  const browser = /SamsungBrowser/.test(ua) ? "samsung" : /EdgA|EdgiOS|Edg\//.test(ua) ? "edge"
    : /OPR\/|Opera/.test(ua) ? "opera" : /FxiOS|Firefox\//.test(ua) ? "firefox"
      : /CriOS|Chrome\//.test(ua) ? "chrome" : /Safari\//.test(ua) ? "safari" : "other";
  return { os, browser };
}

// Chiave dei passi (install.steps.<chiave> in js/i18n) per sistema e browser
function installSteps({ os, browser }) {
  if (os === "ios") return browser === "safari" ? "safariIos" : "otherIos";
  if (os === "android") {
    return { chrome: "chromeAndroid", firefox: "firefoxAndroid", samsung: "samsung", edge: "edgeAndroid" }[browser] || "otherAndroid";
  }
  return { chrome: "chromeDesktop", opera: "chromeDesktop", edge: "edgeDesktop", safari: "safariMac", firefox: "firefoxDesktop" }[browser]
    || "otherDesktop";
}

const BROWSER_NAMES = { chrome: "Chrome", firefox: "Firefox", samsung: "Samsung Internet", edge: "Edge", opera: "Opera", safari: "Safari" };
const OS_NAMES = { android: "Android", ios: "iPhone/iPad", windows: "Windows", mac: "macOS", linux: "Linux" };

class AppInstall {
  constructor() {
    window.appInstall = this;
    this.boxes = [...document.querySelectorAll("[data-get-app]")];
    this.section = document.getElementById("install-section");
    this.apk = null; // contenuto di download/latest.json, se c'è
    this.installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    this.platform = detectPlatform(navigator.userAgent);
    this.steps = installSteps(this.platform);
    // Firefox e altri browser sul computer non installano le app web: lì c'è solo la spiegazione
    this.installable = !["firefoxDesktop", "otherDesktop"].includes(this.steps);
    for (const box of this.boxes) {
      box.querySelector(".install-app").addEventListener("click", () => this.install());
    }
    window.addEventListener("appinstalled", () => {
      this.installed = true;
      this.renderSteps();
      this.render();
    });
    // Copia per giocare senza internet: solo nella versione pubblicata (in locale i file cambiano)
    const version = document.querySelector('meta[name="version"]');
    if ("serviceWorker" in navigator && version && version.content !== "dev") {
      navigator.serviceWorker.register("sw.js").catch(() => { });
    }
    if (!this.installed && this.platform.os === "android") this.loadApk();
    this.renderSteps();
    this.render();
  }

  async loadApk() {
    try {
      const res = await fetch(`download/latest.json?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) this.apk = await res.json();
    } catch (e) {
      // niente APK sul sito (o niente rete)
    }
    this.render();
  }

  // Browser e sistema riconosciuti, e i passi per installare il gioco lì
  renderSteps() {
    const { os, browser } = this.platform;
    this.section.querySelector(".install-where").textContent = this.installed ? t("install.installed")
      : t("install.where", { browser: BROWSER_NAMES[browser] || t("install.otherBrowser"), os: OS_NAMES[os] || t("install.otherOs") });
    const list = this.section.querySelector(".install-steps");
    list.replaceChildren();
    if (this.installed) return;
    for (const step of t(`install.steps.${this.steps}`).split("|")) {
      const li = document.createElement("li");
      li.textContent = step;
      list.append(li);
    }
  }

  async install() {
    if (!installPrompt) {
      // Niente finestra del browser: i passi, nelle Opzioni
      const dialog = document.getElementById("dlg-settings");
      if (!dialog.open) dialog.showModal();
      this.section.scrollIntoView({ block: "start" });
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null; // si può usare una volta sola
    if (outcome === "accepted") this.installed = true;
    this.renderSteps();
    this.render();
  }

  render() {
    for (const box of this.boxes) {
      const inSection = box === this.section;
      const apk = !this.installed && !!this.apk && inSection;
      // Nel benvenuto il pulsante apre l'installazione o i passi; nella sezione solo se il browser la offre
      box.querySelector(".install-app").hidden = this.installed || !(inSection ? installPrompt : this.installable);
      const link = box.querySelector(".download-app");
      if (link) link.hidden = !apk;
      const note = box.querySelector(".download-note");
      if (note) note.hidden = !apk;
      if (apk) {
        // ?v=: dopo ogni pubblicazione un indirizzo nuovo, così il browser non dà l'APK vecchio
        link.href = `${this.apk.url}?v=${this.apk.build}`;
        link.querySelector(".download-size").textContent = t("download.size", { mb: (this.apk.size / 1048576).toFixed(1) });
      }
      box.hidden = inSection ? false : this.installed || !this.installable;
    }
  }
}
