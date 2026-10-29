// Versione per il browser: unisce il codice comune (shared/) e quello del browser (web/) in
// web/dist, la cartella che GitHub Pages pubblica (vedi .github/workflows/static.yml).
//
//   node web/build.mjs                 versione "dev": per giocare in locale (apri web/dist/index.html)
//   node web/build.mjs <versione>      come il deploy, che passa il commit
//   node web/build.mjs <versione> <cartella>   altrove (lo usa tests/e2e/test_update.py)
//
// La versione finisce negli indirizzi di JS e CSS (es. sketch.js?v=3b14d2b) e in version.json:
// GitHub Pages fa tenere i file in cache 10 minuti, ma con indirizzi nuovi basta ricaricare la
// pagina per avere tutta la versione nuova; web/js/Updates.js legge version.json per accorgersi
// che ne è uscita una.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.join(WEB, "..", "shared");
const version = process.argv[2] || "dev";
const out = path.resolve(process.argv[3] || path.join(WEB, "dist"));
if (!/^[\w.-]+$/.test(version)) throw new Error(`Versione non valida: ${version}`);

// Librerie esterne: versione fissa + firma "integrity". Se il file sul CDN venisse modificato,
// il browser si rifiuterebbe di eseguirlo. PeerJS (open source, MIT, peerjs.com) collega
// direttamente i due browser per il gioco online
const LIBS = `<script src="https://cdn.jsdelivr.net/npm/p5@1.11.5/lib/p5.min.js"
      integrity="sha384-HAhlNq60Pt8FPArO94dBFXW3Fa/5li0eyAdkD/eDtP0kwiBDXRvoz7RG9yfQemgj"
      crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js"
      integrity="sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR"
      crossorigin="anonymous"></script>`;

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(SHARED, out, { recursive: true });
fs.cpSync(path.join(WEB, "js"), path.join(out, "platform"), { recursive: true });
fs.copyFileSync(path.join(WEB, "privacy.html"), path.join(out, "privacy.html"));

const platform = fs.readdirSync(path.join(WEB, "js")).filter((f) => f.endsWith(".js")).sort()
  .map((f) => `<script src="platform/${f}?v=dev"></script>`).join("\n    ");
const file = path.join(out, "index.html");
let html = fs.readFileSync(file, "utf8");
for (const [mark, text] of [["<!-- @libs -->", LIBS], ["<!-- @platform -->", platform]]) {
  if (!html.includes(mark)) throw new Error(`${mark} non trovato in shared/index.html`);
  html = html.replace(mark, text);
}
html = html.replaceAll('?v=dev"', `?v=${version}"`)
  .replace('<meta name="version" content="dev">', `<meta name="version" content="${version}">`);
// Se il segnaposto della versione è sparito, meglio fallire che pubblicare senza versione
if (!html.includes(`<meta name="version" content="${version}">`)) throw new Error("<meta name=\"version\"> non trovato");
fs.writeFileSync(file, html);
fs.writeFileSync(path.join(out, "version.json"), `{ "version": "${version}" }\n`);
console.log(`web/build.mjs: versione ${version} in ${path.relative(process.cwd(), out) || "."}`);
