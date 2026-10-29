// Il gioco come app, dal browser (nel benvenuto e nelle Regole, elementi con data-get-app):
// - Chrome, Edge (Android e computer): "📱 Installa l'app", un tocco e senza avvisi di sicurezza
//   (manifest.webmanifest e sw.js, che la fa funzionare anche senza internet);
// - iPhone e iPad: come aggiungerla alla schermata Home da Safari;
// - altrimenti, se sul sito c'è l'APK (download/latest.json, lo mette il workflow di GitHub Pages
//   con app/publish-apk.mjs), il link per scaricarlo. Nelle Regole c'è sempre, sotto l'installazione.
// Già aperto come app installata: niente.

// Chrome offre l'installazione con un evento che può arrivare prima dell'avvio del gioco
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // niente barra di Chrome: c'è il nostro pulsante
  installPrompt = e;
  if (window.appInstall) window.appInstall.render();
});

class AppInstall {
  constructor() {
    window.appInstall = this;
    this.boxes = [...document.querySelectorAll("[data-get-app]")];
    this.apk = null; // contenuto di download/latest.json, se c'è
    this.installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    this.ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    for (const box of this.boxes) {
      box.querySelector(".install-app").addEventListener("click", () => this.install());
    }
    window.addEventListener("appinstalled", () => {
      this.installed = true;
      this.render();
    });
    // Copia per giocare senza internet: solo nella versione pubblicata (in locale i file cambiano)
    const version = document.querySelector('meta[name="version"]');
    if ("serviceWorker" in navigator && version && version.content !== "dev") {
      navigator.serviceWorker.register("sw.js").catch(() => { });
    }
    if (!this.installed && !this.ios) this.loadApk();
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

  async install() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null; // si può usare una volta sola
    if (outcome === "accepted") this.installed = true;
    this.render();
  }

  render() {
    for (const box of this.boxes) {
      const canInstall = !this.installed && !!installPrompt;
      const iosHint = !this.installed && this.ios;
      // L'APK: dove non si può installare dal browser, e nelle Regole anche come alternativa
      const apk = !this.installed && !this.ios && !!this.apk && (!canInstall || box.dataset.getApp === "all");
      box.querySelector(".install-app").hidden = !canInstall;
      box.querySelector(".install-ios").hidden = !iosHint;
      const link = box.querySelector(".download-app");
      link.hidden = !apk;
      const note = box.querySelector(".download-note");
      if (note) note.hidden = !apk;
      if (apk) {
        // ?v=: dopo ogni pubblicazione un indirizzo nuovo, così il browser non dà l'APK vecchio
        link.href = `${this.apk.url}?v=${this.apk.build}`;
        link.querySelector(".download-size").textContent = t("download.size", { mb: (this.apk.size / 1048576).toFixed(1) });
      }
      box.hidden = !(canInstall || iosHint || apk);
    }
  }
}
