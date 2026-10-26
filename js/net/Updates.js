// Avvisa quando è stata pubblicata una versione nuova del gioco. GitHub Pages fa tenere le pagine
// in cache per 10 minuti, quindi dopo un aggiornamento qualcuno potrebbe continuare a usare la
// versione vecchia (e online due versioni diverse non si capiscono).
// La versione è il commit: la scrive tools/stamp-version.sh durante il deploy, nel
// <meta name="version"> di index.html e in version.json. In locale vale "dev" e non si controlla.
const UPDATE_CHECK_EVERY = 5 * 60 * 1000; // ms

class UpdateCheck {
  constructor() {
    const meta = document.querySelector('meta[name="version"]');
    this.current = meta ? meta.content : "dev";
    this.found = false;
    const label = document.getElementById("app-version");
    if (label) label.textContent = this.current;
    document.getElementById("update-reload").addEventListener("click", () => location.reload());
    if (this.current === "dev" || location.protocol === "file:") return;
    const check = () => this.check();
    setTimeout(check, 3000);
    setInterval(check, UPDATE_CHECK_EVERY);
    // Tornando sulla scheda (es. dopo aver letto il messaggio con il link) si controlla subito
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) check();
    });
  }

  async check() {
    if (this.found) return;
    try {
      // ?t=...: indirizzo sempre diverso, così né il browser né la CDN rispondono con la copia vecchia
      const res = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const { version } = await res.json();
      if (!version || version === this.current) return;
      this.found = true;
      document.getElementById("update-banner").hidden = false;
    } catch (e) {
      // senza rete: si riprova al prossimo controllo
    }
  }
}
