"""Strumenti per i test nel browser (Firefox + Selenium).

I test aprono il gioco servito da un server HTTP locale (vedi README.md in questa cartella),
leggono lo stato del gioco con JavaScript e cliccano la board come farebbe una persona.
"""
import json
import os
import time

from selenium import webdriver
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

URL = os.environ.get("LASERCHESS_URL", "http://127.0.0.1:8765/index.html")
GECKODRIVER = os.environ.get("GECKODRIVER", "/snap/bin/geckodriver")
SHOTS = os.environ.get("LASERCHESS_SHOTS", os.path.join(os.path.dirname(__file__), "screenshots"))


class Page:
    def __init__(self, width=1280, height=800, name="page"):
        options = Options()
        options.add_argument("-headless")
        options.enable_bidi = True
        # Il gioco segue la lingua del browser: i test controllano i testi in italiano
        options.set_preference("intl.accept_languages", "it-IT, it")
        self.name = name
        self.errors = []
        self.d = webdriver.Firefox(options=options, service=Service(GECKODRIVER))
        self.d.set_window_size(width, height)
        # Errori JavaScript della pagina: un test fallisce se ce ne sono
        self.d.script.add_javascript_error_handler(lambda e: self.errors.append(e.text))

    def open(self, url=URL):
        self.d.get(url)
        self.wait("typeof board === 'object' && board.players.length === 2", 20)

    def js(self, expr):
        """Valuta un'espressione nella pagina (le variabili del gioco sono globali)."""
        return self.d.execute_script("return window.eval(arguments[0])", expr)

    def wait(self, expr, timeout=10, what=None):
        end = time.time() + timeout
        while time.time() < end:
            try:
                # !!: un oggetto del gioco (es. un pezzo) non si può passare a Python
                if self.js(f"!!({expr})"):
                    return
            except Exception:
                pass
            time.sleep(0.1)
        raise AssertionError(f"[{self.name}] timeout: {what or expr}")

    def click(self, css):
        # I pulsanti si attivano al frame successivo a quello in cui cambia lo stato: si aspetta
        # (SPARA non è mai disabled, così toccandolo spiega perché non si può ancora: aria-disabled)
        self.wait(f"(e => !e.disabled && !e.hidden && e.getAttribute('aria-disabled') !== 'true')(document.querySelector({json.dumps(css)}))", 5, f"{css} attivo")
        self.d.find_element(By.CSS_SELECTOR, css).click()

    def visible(self, css):
        els = self.d.find_elements(By.CSS_SELECTOR, css)
        return bool(els) and els[0].is_displayed()

    def text(self, css):
        return self.d.find_element(By.CSS_SELECTOR, css).text

    def fill(self, css, value):
        el = self.d.find_element(By.CSS_SELECTOR, css)
        el.clear()
        el.send_keys(value)

    def tap_cell(self, name):
        """Click al centro di una casella (es. "h2"), qualunque sia l'orientamento della board."""
        x, y = self.js(f"""(() => {{
            const c = board.cellByName({json.dumps(name)}).center;
            const p = boardToScreen(c.x, c.y);
            return [p.x, p.y];
        }})()""")
        canvas = self.d.find_element(By.CSS_SELECTOR, "#stage canvas")
        w, h = canvas.size["width"], canvas.size["height"]
        ActionChains(self.d).move_to_element_with_offset(canvas, x - w / 2, y - h / 2).click().perform()

    def pixel(self, name):
        """Colore [r, g, b] del canvas al centro di una casella."""
        return self.js(f"""(() => {{
            const c = board.cellByName({json.dumps(name)}).center;
            const p = boardToScreen(c.x, c.y), d = pixelDensity();
            return [...drawingContext.getImageData(Math.round(p.x * d), Math.round(p.y * d), 1, 1).data].slice(0, 3);
        }})()""")

    def shot(self, label):
        os.makedirs(SHOTS, exist_ok=True)
        path = os.path.join(SHOTS, f"{self.name}-{label}.png")
        self.d.save_screenshot(path)
        return path

    def check_no_errors(self):
        assert not self.errors, f"[{self.name}] errori JavaScript: {self.errors}"

    def quit(self):
        try:
            self.d.quit()
        except Exception:
            pass  # geckodriver di snap a volte non si lascia chiudere: il browser è già chiuso


def settle(page, timeout=20):
    """Aspetta che il laser abbia finito e che non ci siano azioni in coda."""
    page.wait("!board.busy && board.remoteQueue.length === 0", timeout, "laser fermo")
