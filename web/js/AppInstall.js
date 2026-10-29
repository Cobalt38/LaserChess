// Il gioco come app, dal browser (nel benvenuto e in ⚙️ Opzioni, elementi con data-get-app):
// - Android: "📱 Installa l'app", senza APK e senza avvisi di sicurezza (manifest.webmanifest e sw.js,
//   che la fa funzionare anche senza internet). Se il browser è pronto (Chrome manda
//   beforeinstallprompt solo dopo un po' che si usa il sito; Firefox mai) apre la sua finestra di
//   installazione, altrimenti spiega come farlo dal menu del browser;
// - computer: lo stesso pulsante, solo se il browser offre l'installazione;
// - iPhone e iPad: come aggiungerla alla schermata Home da Safari;
// - nelle Opzioni, su Android, anche l'APK (download/latest.json, lo mette il workflow di GitHub
//   Pages con app/publish-apk.mjs).
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
    this.android = /Android/.test(navigator.userAgent);
    this.howto = false; // pulsante toccato quando il browser non offriva l'installazione
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
    if (!this.installed && this.android) this.loadApk();
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
    if (!installPrompt) {
      this.howto = true; // come installarla dal menu del browser
      this.render();
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    installPrompt = null; // si può usare una volta sola
    if (outcome === "accepted") this.installed = true;
    this.render();
  }

  render() {
    for (const box of this.boxes) {
      const canInstall = !this.installed && (this.android || !!installPrompt);
      const iosHint = !this.installed && this.ios;
      const apk = !this.installed && this.android && !!this.apk && box.dataset.getApp === "all";
      box.querySelector(".install-app").hidden = !canInstall;
      box.querySelector(".install-howto").hidden = !(canInstall && this.howto && !installPrompt);
      box.querySelector(".install-ios").hidden = !iosHint;
      const link = box.querySelector(".download-app");
      if (link) link.hidden = !apk;
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
