// Mette l'APK firmato (app-release.apk) nella versione web, così si scarica dal sito:
// <cartella web>/download/laserchess.apk e download/latest.json, che l'app pubblicata sul sito
// legge all'avvio per sapere se ne è uscita una più nuova (vedi app/js/AppUpdates.js).
// Lo usa il workflow di GitHub Pages dopo la build web e "gradlew assembleRelease".
// Uso, dalla cartella app/: node publish-apk.mjs ../web/dist
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP = dirname(fileURLToPath(import.meta.url));
const APK = join(APP, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const site = process.argv[2];
if (!site) throw new Error("Uso: node publish-apk.mjs <cartella della versione web>");
if (!existsSync(APK)) throw new Error(`Manca ${APK}: prima gradlew assembleRelease (con la chiave di firma)`);

// Versione e numero di build sono quelli scritti da build.mjs nella copia del gioco dentro l'APK
const { version, build, channel } = JSON.parse(readFileSync(join(APP, "www", "version.json"), "utf8"));
const dir = join(resolve(site), "download");
mkdirSync(dir, { recursive: true });
copyFileSync(APK, join(dir, "laserchess.apk"));
const latest = { build, version, channel, url: "download/laserchess.apk", size: statSync(APK).size };
writeFileSync(join(dir, "latest.json"), JSON.stringify(latest, null, 2) + "\n");
console.log(`publish-apk.mjs: build ${build} (${version}) in ${dir}`);
