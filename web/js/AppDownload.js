// Link "Scarica l'app per Android" (nel benvenuto e nelle Regole, elementi con data-app-download):
// si vedono solo se sul sito c'è l'APK (download/latest.json, lo mette il workflow di GitHub Pages
// con app/publish-apk.mjs) e non su iPhone e iPad, dove un APK non serve.
class AppDownload {
  constructor() {
    this.boxes = [...document.querySelectorAll("[data-app-download]")];
    if (this.boxes.length === 0 || /iPhone|iPad|iPod/.test(navigator.userAgent)) return;
    this.load();
  }

  async load() {
    try {
      const res = await fetch(`download/latest.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const latest = await res.json();
      const size = t("download.size", { mb: (latest.size / 1048576).toFixed(1) });
      for (const box of this.boxes) {
        const link = box.tagName === "A" ? box : box.querySelector("a");
        // ?v=: dopo ogni pubblicazione un indirizzo nuovo, così il browser non dà l'APK vecchio
        link.href = `${latest.url}?v=${latest.build}`;
        box.querySelector(".download-size").textContent = size;
        box.hidden = false;
      }
    } catch (e) {
      // niente APK sul sito (o niente rete): i link restano nascosti
    }
  }
}
