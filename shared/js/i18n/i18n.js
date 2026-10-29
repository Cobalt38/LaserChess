// Testi in più lingue. L'italiano della pagina resta in shared/index.html: gli elementi da tradurre
// hanno data-i18n="chiave" (il contenuto) o data-i18n-title / -aria-label / -placeholder / -alt
// (gli attributi). L'italiano dei testi scritti dal codice è in it.js. Le altre lingue (en.js...)
// traducono entrambi; tests/rules.test.js controlla che non manchi nessuna chiave.
// Per aggiungere una lingua: un file come en.js, il suo <script> in index.html e una voce in LANGUAGES.
//
// La lingua si sceglie in Regole › Opzioni; "auto" (predefinita) segue quella del dispositivo.
// Cambiandola la pagina si ricarica (la partita riprende da dove era), così anche i testi calcolati
// all'avvio sono nella lingua nuova.

const LANGUAGES = { it: "Italiano", en: "English" }; // codice -> nome nella sua lingua
const STRINGS = {}; // codice -> { chiave: testo }, riempito da it.js, en.js...

// Lingua da usare: quella scelta nelle impostazioni, altrimenti la prima del dispositivo che c'è,
// altrimenti l'inglese
function pickLanguage() {
  let chosen = "auto";
  try {
    // (stessa chiave di SETTINGS_KEY in sketch.js, che però si carica dopo)
    const saved = JSON.parse(Platform.settingsStorage().getItem("laserchess.settings"));
    if (saved && saved.lang) chosen = saved.lang;
  } catch (e) {
    // senza impostazioni (o fuori dal browser, nei test): automatica
  }
  if (LANGUAGES[chosen]) return chosen;
  if (typeof navigator === "undefined") return "it";
  for (const tag of navigator.languages || [navigator.language || ""]) {
    const code = String(tag).slice(0, 2).toLowerCase();
    if (LANGUAGES[code]) return code;
  }
  return "en";
}

const LANG = pickLanguage();

// Testo della chiave nella lingua scelta (o in italiano, se manca), con {nome} sostituiti da params
function t(key, params = {}) {
  let text = STRINGS[LANG] && STRINGS[LANG][key];
  if (text === undefined) text = STRINGS.it && STRINGS.it[key];
  if (text === undefined) return key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? params[name] : match));
}

// Elenco con la "e" della lingua: "A, B e C"
function listText(items) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")}${t("list.and")}${items[items.length - 1]}`;
}

// Traduce la pagina (in italiano è già scritta così)
function applyLanguage() {
  document.documentElement.lang = LANG;
  const dict = STRINGS[LANG];
  if (LANG === "it" || !dict) return;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    if (dict[el.dataset.i18n] !== undefined) el.innerHTML = dict[el.dataset.i18n];
  }
  for (const attr of ["title", "aria-label", "placeholder", "alt"]) {
    for (const el of document.querySelectorAll(`[data-i18n-${attr}]`)) {
      const text = dict[el.getAttribute(`data-i18n-${attr}`)];
      if (text !== undefined) el.setAttribute(attr, text);
    }
  }
}
