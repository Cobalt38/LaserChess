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

    p = Page(1100, 760, "update")
    try:
        step("la copia pubblicata ha la versione negli indirizzi degli script e nella pagina")
        p.open(f"http://127.0.0.1:{PORT}/index.html")
        assert p.js("document.querySelector('meta[name=version]').content") == "aaa1111"
        srcs = p.js("[...document.scripts].map(s => s.getAttribute('src')).filter(s => s && s.startsWith('js/'))")
        assert srcs and all(s.endswith("?v=aaa1111") for s in srcs), srcs
        assert p.js("document.querySelector('link[rel=stylesheet]').getAttribute('href')") == "css/style.css?v=aaa1111"
        assert p.js("document.getElementById('app-version').textContent") == "aaa1111"

        step("sul sito c'è l'APK: nel benvenuto il link per scaricare l'app per Android")
        p.wait("!document.querySelector('.welcome [data-app-download]').hidden", 5, "link dell'app")
        assert p.js("document.querySelector('.welcome a.download-app').getAttribute('href')") == "download/laserchess.apk?v=99"
        assert "4.0 MB" in p.text(".welcome a.download-app"), p.text(".welcome a.download-app")

        step("stessa versione sul server: nessun avviso")
        p.click("#welcome-play")
        p.click("#new-start")
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
        p.check_no_errors()
        print("OK: test_update")
    finally:
        p.quit()
        server.shutdown()
        shutil.rmtree(site, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
