// Prepara app/www, la copia del gioco che finisce dentro l'app (Android e iOS, con Capacitor).
// Il gioco è in ../shared (lo stesso della versione web); qui lo si copia e lo si completa per l'app:
// - <!-- @libs -->: p5 e PeerJS da file locali (www/vendor) invece che dal CDN, così contro il
//   computer si gioca anche senza internet;
// - <!-- @platform -->: gli script di Capacitor (core e plugin: vibrazione, condivisione, tasto
//   Indietro...), che registrano i plugin in window.Capacitor.Plugins, e poi i file di app/js
//   (l'adattatore del gioco per l'app), copiati in www/platform;
// - la versione negli indirizzi degli script e in version.json (package.json + commit), il numero
//   di build (quanti commit ci sono: cresce sempre) e il canale (APP_CHANNEL: "github" per l'APK
//   pubblicato sul sito, che controlla da solo se ne è uscito uno più nuovo; "local" se manca);
// - niente zoom con due dita.
// Poi scrive id, nome e versione nel progetto iOS (Android li legge da solo in app/build.gradle).
// Uso, dalla cartella app/: node build.mjs (oppure npm run app:www)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = dirname(fileURLToPath(import.meta.url));
const SHARED = join(APP, "..", "shared");
const WWW = join(APP, "www");
const pkg = JSON.parse(readFileSync(join(APP, "package.json"), "utf8"));
const cap = JSON.parse(readFileSync(join(APP, "capacitor.config.json"), "utf8"));
const modules = (...p) => join(APP, "node_modules", ...p);

function fail(message) {
  console.error(`build.mjs: ${message}`);
  process.exit(1);
}

if (!existsSync(modules("@capacitor", "core"))) fail("mancano le dipendenze: prima npm install (dalla cartella app/)");
if (!existsSync(join(SHARED, "index.html"))) fail(`non trovo ${join(SHARED, "index.html")}`);

// Versione: quella di package.json più il commit, es. "1.0.0-2dfea9d"
const [major, minor, patch] = pkg.version.split(/[.-]/).map(Number);
if (!(minor < 100 && patch < 100)) fail(`package.json: minor e patch devono essere sotto 100 (${pkg.version})`);
let commit = "nogit";
let build = 0;
try {
  const git = (args) => execSync(`git ${args}`, { cwd: APP, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  commit = git("rev-parse --short HEAD");
  build = Number(git("rev-list --count HEAD"));
} catch (e) {
  // non è un repository git: basta la versione di package.json
}
const version = `${pkg.version}-${commit}`;
const channel = process.env.APP_CHANNEL || "local";
if (!/^[a-z]+$/.test(channel)) fail(`APP_CHANNEL non valido: ${channel}`);
const v = `?v=${version}`;

// 1. Il gioco, così com'è
rmSync(WWW, { recursive: true, force: true });
cpSync(SHARED, WWW, { recursive: true });

// 2. Adattatore per l'app
const platform = existsSync(join(APP, "js"))
  ? readdirSync(join(APP, "js")).filter((f) => f.endsWith(".js")).sort()
  : [];
mkdirSync(join(WWW, "platform"), { recursive: true });
for (const f of platform) cpSync(join(APP, "js", f), join(WWW, "platform", f));

// 3. Librerie e Capacitor al posto dei segnaposto
let html = readFileSync(join(WWW, "index.html"), "utf8");

function placeholder(name, files) {
  const re = new RegExp(`^([ \\t]*)<!-- @${name} -->[ \\t]*$`, "m");
  const m = html.match(re);
  if (!m) fail(`in shared/index.html non trovo la riga <!-- @${name} -->`);
  if (html.match(new RegExp(re.source, "gm")).length > 1) fail(`in shared/index.html <!-- @${name} --> c'è più di una volta`);
  html = html.replace(re, files.map((f) => `${m[1]}<script src="${f}${v}"></script>`).join("\n"));
}

mkdirSync(join(WWW, "vendor", "capacitor"), { recursive: true });
cpSync(modules("p5", "lib", "p5.min.js"), join(WWW, "vendor", "p5.min.js"));
cpSync(modules("peerjs", "dist", "peerjs.min.js"), join(WWW, "vendor", "peerjs.min.js"));
placeholder("libs", ["vendor/p5.min.js", "vendor/peerjs.min.js"]);

// Prima il core (crea window.Capacitor), poi un file per plugin: ognuno chiama registerPlugin,
// che lo mette in window.Capacitor.Plugins (es. Capacitor.Plugins.Haptics). Poi l'adattatore.
const NATIVE = new Set(["@capacitor/core", "@capacitor/cli", "@capacitor/android", "@capacitor/ios"]);
const plugins = Object.keys(pkg.dependencies).filter((d) => d.startsWith("@capacitor/") && !NATIVE.has(d)).sort();
const capFiles = ["vendor/capacitor/core.js"];
cpSync(modules("@capacitor", "core", "dist", "capacitor.js"), join(WWW, "vendor", "capacitor", "core.js"));
for (const dep of plugins) {
  const name = dep.split("/")[1];
  const src = modules("@capacitor", name, "dist", "plugin.js");
  if (!existsSync(src)) fail(`${dep} non ha dist/plugin.js`);
  cpSync(src, join(WWW, "vendor", "capacitor", `${name}.js`));
  capFiles.push(`vendor/capacitor/${name}.js`);
}
placeholder("platform", [...capFiles, ...platform.map((f) => `platform/${f}`)]);

// 4. Versione, come fa la build web per GitHub Pages
html = html.replaceAll('?v=dev"', `${v}"`);
if (!html.includes('<meta name="version" content="dev">')) fail('in shared/index.html non trovo <meta name="version" content="dev">');
html = html.replace('<meta name="version" content="dev">', `<meta name="version" content="${version}">
    <meta name="app-build" content="${build}">
    <meta name="app-channel" content="${channel}">`);

// 5. Niente zoom con due dita (la board si adatta già allo schermo)
const viewport = /<meta name="viewport" content="([^"]*)"/;
if (!viewport.test(html)) fail('in shared/index.html non trovo <meta name="viewport">');
html = html.replace(viewport, (tag, content) =>
  content.includes("user-scalable") ? tag : `<meta name="viewport" content="${content}, maximum-scale=1, user-scalable=no"`);

writeFileSync(join(WWW, "index.html"), html);
writeFileSync(join(WWW, "version.json"), JSON.stringify({ version, build, channel }) + "\n");
console.log(`www/ pronta: versione ${version}, build ${build}, canale ${channel}, plugin ${plugins.map((p) => p.split("/")[1]).join(", ")}, ` +
  `adattatore ${platform.join(", ") || "(nessun file in app/js)"}`);

// Progetto iOS: id, nome e versione presi da capacitor.config.json e package.json, come fa
// android/app/build.gradle per Android (così si cambiano in un posto solo)
const IOS_PROJECT = join(APP, "ios", "App", "App.xcodeproj", "project.pbxproj");
const IOS_PLIST = join(APP, "ios", "App", "App", "Info.plist");
if (existsSync(IOS_PROJECT) && existsSync(IOS_PLIST)) {
  const build = major * 10000 + minor * 100 + patch; // lo stesso versionCode di Android
  const project = readFileSync(IOS_PROJECT, "utf8")
    .replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${cap.appId};`)
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${major}.${minor}.${patch};`)
    .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
  writeFileSync(IOS_PROJECT, project);
  const name = cap.appName.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const plist = readFileSync(IOS_PLIST, "utf8")
    .replace(/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${name}$2`);
  writeFileSync(IOS_PLIST, plist);
}
