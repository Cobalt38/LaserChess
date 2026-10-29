// Versione per il browser (GitHub Pages): quello che il codice comune in shared/ chiede alla
// piattaforma. L'app per Android e iOS ha lo stesso oggetto Platform in app/js/Platform.js.
const Platform = {
  isApp: false,

  // All'avvio del gioco (setup): controllo delle versioni nuove pubblicate (Updates.js) e link
  // per scaricare l'app per Android, se sul sito c'è (AppDownload.js)
  start() {
    new UpdateCheck();
    new AppDownload();
  },

  // Gioco pronto sullo schermo
  ready() { },

  // Vibrazione: solo nell'app
  haptic(kind) { },

  // Indirizzo da cui partono i link d'invito: questa pagina
  inviteBase() {
    return location.href.split(/[?#]/)[0];
  },

  privacyUrl: "privacy.html",

  // Apre un indirizzo fuori dal gioco, in una scheda nuova
  openExternal(url) {
    window.open(url, "_blank", "noopener");
  },

  canShare() {
    return !!navigator.share;
  },

  // Finestra "condividi" del sistema. Restituisce false se non c'è o se non è andata
  async share({ title, text, url }) {
    if (!navigator.share) return false;
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (e) {
      return false;
    }
  },

  // Copia negli appunti. Restituisce false se non si può (il chiamante seleziona il testo)
  async copy(text) {
    if (!navigator.clipboard || !window.isSecureContext) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  },

  // Tasto "indietro" di Android: nel browser lo gestisce il browser
  onBack(handler) { },

  leave() { },

  // Impostazioni (nomi, livello, opzioni): valgono finché la scheda resta aperta, una scheda nuova
  // riparte da capo
  settingsStorage() {
    try {
      return window.sessionStorage;
    } catch (e) {
      return null;
    }
  },

  // Partita in corso: resta anche chiudendo la scheda, per "Riprendi la partita" nel benvenuto
  gameStorage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  },
};
