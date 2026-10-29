"""Versione pubblicata: indirizzi di JS e CSS con la versione (web/build.mjs) e avviso
quando ne esce una nuova. Prepara una copia del sito come fa il deploy, la serve su una porta
sua e simula una nuova pubblicazione cambiando version.json."""
import functools
import http.server
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time

from helpers import Page

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
PORT = 8766


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def step(msg):
    print(f"- {msg}", flush=True)


def main():
    site = tempfile.mkdtemp(prefix="laserchess-site-")
    subprocess.run(["node", os.path.join(ROOT, "web", "build.mjs"), "aaa1111", site], check=True)
    # Come fa il workflow con app/publish-apk.mjs: l'APK e latest.json in download/
    os.makedirs(os.path.join(site, "download"))
    with open(os.path.join(site, "download", "laserchess.apk"), "wb") as f:
        f.write(b"apk finto")
    with open(os.path.join(site, "download", "latest.json"), "w") as f:
        f.write('{ "build": 99, "version": "1.0.0-aaa1111", "url": "download/laserchess.apk", "size": 4200000 }\n')
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=site))
    threading.Thread(target=server.serve_forever, daemon=True).start()

    # Come Firefox su Android: niente beforeinstallprompt, quindi le istruzioni dal menu del browser
    android = "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0"
    p = Page(1100, 760, "update", prefs={"general.useragent.override": android})
    try:
        step("la copia pubblicata ha la versione negli indirizzi degli script e nella pagina")
        p.open(f"http://127.0.0.1:{PORT}/index.html")
        assert p.js("document.querySelector('meta[name=version]').content") == "aaa1111"
        srcs = p.js("[...document.scripts].map(s => s.getAttribute('src')).filter(s => s && s.startsWith('js/'))")
        assert srcs and all(s.endswith("?v=aaa1111") for s in srcs), srcs
        assert p.js("document.querySelector('link[rel=stylesheet]').getAttribute('href')") == "css/style.css?v=aaa1111"
        assert p.js("document.getElementById('app-version').textContent") == "aaa1111"

        step("Android, browser senza beforeinstallprompt: Installa l'app spiega come fare dal menu")
        p.wait("!document.querySelector('.welcome .install-app').hidden", 5, "pulsante Installa l'app")
        assert not p.js("document.querySelector('.welcome .download-app')"), "nel benvenuto niente APK"
        p.click(".welcome .install-app")
        p.wait("!document.querySelector('.welcome .install-howto').hidden", 3, "istruzioni dal menu")

        step("installabile come app: manifest e service worker con il gioco salvato per giocare senza rete")
        assert p.js("document.querySelector('link[rel=manifest]').getAttribute('href')") == "manifest.webmanifest"
        cached = p.d.execute_async_script("""const done = arguments[0];
            navigator.serviceWorker.ready
              .then(() => caches.open('laserchess-aaa1111'))
              .then((c) => c.keys())
              .then((keys) => done(keys.map((r) => new URL(r.url).pathname + new URL(r.url).search)))
              .catch((e) => done(String(e)));""")
        assert isinstance(cached, list) and any(k.endswith("/js/sketch.js?v=aaa1111") for k in cached), cached
        assert any(k.endswith("/index.html") for k in cached), cached

        step("stessa versione sul server: nessun avviso; in ⚙️ Opzioni anche l'APK")
        p.click("#welcome-play")
        p.click("#new-start")
        p.click("[data-open=dlg-settings]")
        p.wait("!document.querySelector('#dlg-settings .download-app').hidden", 5, "APK nelle Opzioni")
        assert p.js("document.querySelector('#dlg-settings .download-app').getAttribute('href')") == "download/laserchess.apk?v=99"
        assert "4.0 MB" in p.text("#dlg-settings .download-app"), p.text("#dlg-settings .download-app")
        p.shot("opzioni-app")
        p.js("document.getElementById('dlg-settings').close(); 0")
        time.sleep(4)
        assert not p.visible("#update-banner")

        step("esce una versione nuova: tornando sulla scheda compare l'avviso")
        p.tap_cell("h2")
        p.wait("board.selected && board.selected.name === 'h2'", 3)
        target = p.js("board.neighbors(board.selected).find(c => c.highlight).name")
        p.tap_cell(target)
        p.wait("board.phase === 'fire'", 3)
        key = p.js("board.positionKey() + board.phase")
        with open(os.path.join(site, "version.json"), "w") as f:
            f.write('{ "version": "bbb2222" }\n')
        p.js("document.dispatchEvent(new Event('visibilitychange')); 0")
        p.wait("document.getElementById('update-banner')", 5, "avviso della versione nuova")
        p.shot("avviso")

        step("Aggiorna ricarica la pagina e la partita riprende da dove era")
        p.click("#update-reload")
        p.wait("typeof board === 'object' && board.players.length === 2 && !document.getElementById('update-banner')", 20)
        assert p.js("board.positionKey() + board.phase") == key, "partita diversa dopo l'aggiornamento"

        step("scheda nuova con il benvenuto aperto: l'avviso è dentro la finestra e Aggiorna funziona")
        p.js("sessionStorage.clear(); 0")
        p.d.refresh()
        p.wait("typeof board === 'object' && document.getElementById('dlg-welcome').open", 20)
        p.wait("(b => b && b.closest('#dlg-welcome'))(document.getElementById('update-banner'))", 10, "avviso dentro il benvenuto")
        p.shot("avviso-nel-benvenuto")
        p.click("#update-reload")
        p.wait("typeof board === 'object' && board.players.length === 2 && !document.getElementById('update-banner')", 20)
        p.check_no_errors()
        print("OK: test_update")
    finally:
        p.quit()
        server.shutdown()
        shutil.rmtree(site, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
