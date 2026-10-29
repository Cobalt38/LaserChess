// Versione per il browser (GitHub Pages): quello che il codice comune in shared/ chiede alla
// piattaforma. L'app per Android e iOS ha lo stesso oggetto Platform in app/js/Platform.js.
const Platform = {
  isApp: false,

  // All'avvio del gioco (setup): controllo delle versioni nuove pubblicate (Updates.js)
  start() {
    new UpdateCheck();
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

  // Partita in corso: vale per la scheda, ricaricando si riprende
  gameStorage() {
    try {
      return window.sessionStorage;
    } catch (e) {
      return null;
    }
  },
};
