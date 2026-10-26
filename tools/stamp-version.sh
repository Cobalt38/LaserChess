#!/bin/sh
# Scrive la versione (di solito il commit) negli indirizzi di JS e CSS di index.html e in
# version.json. GitHub Pages fa tenere i file in cache 10 minuti: con indirizzi nuovi a ogni
# pubblicazione, ricaricando la pagina il browser scarica sempre i file nuovi, tutti insieme.
# version.json serve a js/net/Updates.js per accorgersi che è uscita una versione nuova.
# Uso, dalla cartella principale del gioco: sh tools/stamp-version.sh <versione>
set -eu
v="$1"
sed -i "s/?v=dev\"/?v=$v\"/g; s/<meta name=\"version\" content=\"dev\">/<meta name=\"version\" content=\"$v\">/" index.html
printf '{ "version": "%s" }\n' "$v" > version.json
# Se i segnaposto "dev" in index.html sono spariti, fallisce invece di pubblicare senza versione
grep -q "<meta name=\"version\" content=\"$v\">" index.html
