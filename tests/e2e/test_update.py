"""Versione pubblicata: indirizzi di JS e CSS con la versione (tools/stamp-version.sh) e avviso
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
    for name in ["index.html", "css", "js", "assets", "tools"]:
        src = os.path.join(ROOT, name)
        (shutil.copytree if os.path.isdir(src) else shutil.copy)(src, os.path.join(site, name))
    subprocess.run(["sh", "tools/stamp-version.sh", "aaa1111"], cwd=site, check=True)
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

        step("stessa versione sul server: nessun avviso")
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
        p.wait("!document.getElementById('update-banner').hidden", 5, "avviso della versione nuova")
        p.shot("avviso")

        step("Aggiorna ricarica la pagina e la partita riprende da dove era")
        p.click("#update-reload")
        p.wait("typeof board === 'object' && board.players.length === 2 && document.getElementById('update-banner').hidden", 20)
        assert p.js("board.positionKey() + board.phase") == key, "partita diversa dopo l'aggiornamento"
        p.check_no_errors()
        print("OK: test_update")
    finally:
        p.quit()
        server.shutdown()
        shutil.rmtree(site, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
