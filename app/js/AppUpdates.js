// App scaricata dal sito (canale "github", vedi app/build.mjs): all'avvio, e tornando nell'app dopo
// un po', legge download/latest.json sul sito (lo scrive app/publish-apk.mjs). Se c'è una build più
// nuova compare una barra con "Scarica": l'APK si apre nel browser, che lo scarica, e lo si installa
// sopra questa (la partita salvata resta). Le altre app (provate in locale, da Google Play) non
// controllano: quella di Google Play la aggiorna lo store.
const APP_UPDATE_CHECK_EVERY = 60 * 60 * 1000; // ms tra un controllo e l'altro, tornando nell'app
const SKIPPED_BUILD_KEY = "laserchess.skippedBuild"; // build per cui si è scelto "Più tardi"

class AppUpdateCheck {
  constructor() {
    const meta = (name) => document.querySelector(`meta[name="${name}"]`);
    this.build = Number(meta("app-build") && meta("app-build").content) || 0;
    this.lastCheck = 0;
    this.shown = false;
    if (!(meta("app-channel") && meta("app-channel").content === "github")) return;
    this.check();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - this.lastCheck > APP_UPDATE_CHECK_EVERY) this.check();
    });
  }

  async check() {
    if (this.shown) return;
    this.lastCheck = Date.now();
    try {
      // ?t=...: indirizzo sempre diverso, così nessuna cache risponde con la copia vecchia
      const res = await fetch(`${PUBLIC_URL}download/latest.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const latest = await res.json();
      if (!(latest.build > this.build) || String(latest.build) === localStorage.getItem(SKIPPED_BUILD_KEY)) return;
      this.showBanner(latest);
    } catch (e) {
      // senza rete: si riprova la prossima volta
    }
  }

  // Barra in alto, con lo stesso aspetto dell'avviso della versione web (shared/css/style.css)
  showBanner(latest) {
    this.shown = true;
    const bar = document.createElement("div");
    bar.id = "update-banner";
    bar.setAttribute("role", "status");
    const text = document.createElement("span");
    text.textContent = t("update.app.banner");
    const button = (label, className, run) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = className;
      btn.textContent = label;
      btn.addEventListener("click", () => {
        run();
        bar.remove();
      });
      return btn;
    };
    const download = button(t("update.app.download"), "accent",
      () => Platform.openExternal(`${PUBLIC_URL}${latest.url}?v=${latest.build}`));
    const later = button(t("update.app.later"), "", () => {
      try {
        localStorage.setItem(SKIPPED_BUILD_KEY, String(latest.build));
      } catch (e) {
        // storage non disponibile: la barra torna al prossimo avvio
      }
    });
    bar.append(text, download, later);
    document.body.append(bar);
  }
}
