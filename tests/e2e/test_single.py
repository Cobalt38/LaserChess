"""Partita contro il computer e in due sullo stesso schermo, finestre, nomi, configurazioni,
ripresa dopo il ricaricamento, layout su telefono."""
import sys
import time

from helpers import Page, settle


def step(msg):
    print(f"- {msg}", flush=True)


def main():
    p = Page(1280, 800, "desktop")
    try:
        p.open()
        step("prima visita: si apre la finestra Nuova partita con le istruzioni")
        assert p.js("document.getElementById('dlg-new').open"), "finestra iniziale chiusa"
        assert p.visible("#intro"), "istruzioni iniziali nascoste"
        assert p.js("document.querySelector('#new-form').elements.mode.value") == "ai"
        assert p.js("!!document.getElementById('setup-preview').src"), "anteprima della disposizione mancante"
        p.shot("01-benvenuto")

        step("contro il computer (medio), si gioca col blu")
        p.click("#new-start")
        p.wait("!document.getElementById('dlg-new').open")
        assert p.js("game.mode") == "ai" and p.js("board.localIndex") == 0
        assert p.js("game.ai.side") == 1
        assert "Tocca uno dei tuoi pezzi blu" in p.text("#hint"), p.text("#hint")

        step("tocco un pezzo avversario: il suggerimento spiega cos'è")
        p.tap_cell("h5")  # Deflector arancione in ACE
        p.wait("document.getElementById('hint').textContent.includes('Deflector di Computer')", 3)

        step("tocco un mio Deflector: suggerimento, caselle evidenziate, ↺ ↻ attivi")
        p.tap_cell("h2")
        p.wait("board.selected && board.selected.name === 'h2'", 3)
        assert "Deflector" in p.text("#hint")
        assert p.js("!document.getElementById('btn-rot-cw').disabled")
        assert p.js("board.cellByName('h3').highlight")
        assert p.js("board.laserPreview() !== null"), "anteprima del laser assente"
        p.shot("02-selezione")

        step("tocco una casella evidenziata: il pezzo si sposta (tocco-tocco, senza trascinare)")
        p.tap_cell("h3")
        p.wait("board.phase === 'fire'", 3)
        assert p.js("board.cellByName('h3').piece && board.cellByName('h3').piece.type") == "Deflector"
        assert p.js("!document.getElementById('btn-fire').disabled")
        assert p.js("document.getElementById('step-fire').classList.contains('active')")
        assert p.js("board.laserPreview().segments.length") > 0
        time.sleep(0.4)
        p.shot("03-anteprima-laser")

        step("annullo e ruoto invece con il pulsante ↻")
        p.click("#btn-undo")
        p.wait("board.phase === 'move' && board.cellByName('h2').piece", 3)
        p.tap_cell("h2")
        p.wait("board.rotatable !== null", 3)
        rot = p.js("board.cellByName('h2').piece.rot")
        p.click("#btn-rot-cw")
        p.wait("board.phase === 'fire'", 3)
        assert p.js("board.cellByName('h2').piece.rot") != rot

        step("sparo; il computer risponde da solo")
        p.click("#btn-fire")
        p.wait("board.turn === 1", 10, "turno del computer")
        p.wait("board.turn === 0 && board.phase === 'move' && !board.busy", 20, "risposta del computer")
        assert p.js("board.history.length") == 2
        assert p.js("board.history[1].player.name") == "Computer"
        p.shot("04-dopo-il-computer")

        step("fine partita: l'anteprima segna il King colpito, vinco e chiedo la rivincita")
        snap = p.js("board.snapshot()")
        p.js("""board.restore({ setup: 'ACE', players: board.players.map(p => p.baseName), turn: 0, phase: 'move',
            history: [], lastMove: null, positions: [], drawClaimable: false, gameOver: null,
            pieces: [['Laser', 0, 10, 1, 'N'], ['Laser', 1, 1, 8, 'S'], ['King', 0, 5, 3, 'N'], ['King', 1, 5, 1, 'N']] }); 0""")
        p.tap_cell("j1")
        p.click("#btn-rot-ccw")
        p.wait("board.phase === 'fire'", 3)
        assert p.js("board.laserPreview().events.some(e => e.effect === 'king')"), "l'anteprima non segna il King"
        p.shot("06-mira-sul-king")
        p.click("#btn-fire")
        p.wait("!!board.gameOver && !document.getElementById('gameover').hidden", 10)
        assert "vince" in p.text("#go-title"), p.text("#go-title")
        p.shot("07-vittoria")
        p.click("#go-new")
        p.wait("!board.gameOver && board.history.length === 0 && board.pieces.length === 26", 5)
        assert p.js("game.mode") == "ai" and p.js("!!game.ai")
        p.js(f"board.restore({__import__('json').dumps(snap)}); 0")

        step("nomi: uguale a Computer non va, poi salvo Mario")
        p.click("[data-open=dlg-names]")
        assert p.js("document.getElementById('name-1').readOnly"), "il nome del computer non deve essere modificabile"
        p.fill("#name-0", "computer")
        p.click("#names-form button[type=submit]")
        assert p.visible("#names-error"), "manca l'errore per i nomi uguali"
        p.fill("#name-0", "Mario")
        p.click("#names-form button[type=submit]")
        p.wait("!document.getElementById('dlg-names').open", 3)
        assert p.visible("#toast") and "salvati" in p.text("#toast")
        assert p.js("board.players[0].name") == "Mario"
        assert p.js("settings.myName") == "Mario"

        step("ricarico la pagina: la partita riprende da dove era")
        state = "board.positionKey() + '|' + board.turn + board.phase"
        key = p.js(state)
        p.d.refresh()
        p.wait("typeof board === 'object' && board.players.length === 2", 20)
        assert p.js(state) == key, "posizione diversa dopo il ricaricamento"
        assert p.js("board.history.length") == 2
        assert p.js("game.mode") == "ai" and p.js("!!game.ai")
        assert not p.js("document.getElementById('dlg-new').open"), "la finestra iniziale non deve riaprirsi"

        step("nuova partita in due: nomi uguali rifiutati, poi GRAIL")
        p.click("#btn-new")
        p.wait("document.getElementById('dlg-new').open", 3)
        assert not p.visible("#intro"), "le istruzioni iniziali si vedono solo la prima volta"
        p.click("input[name=mode][value=local] + span")
        p.fill("input[name=name0]", "Anna")
        p.fill("input[name=name1]", "anna ")
        p.click("#new-start")
        assert p.visible("#new-error")
        p.fill("input[name=name1]", "Bruno")
        p.d.execute_script("const s = document.getElementById('setup-select'); s.value = 'GRAIL'; s.dispatchEvent(new Event('change', {bubbles: true}));")
        p.wait("document.getElementById('setup-desc').textContent.includes('seconda fila')", 3)
        p.click("#new-start")
        p.wait("document.getElementById('dlg-ask').open", 3, "conferma per la partita in corso")
        p.click("#ask-yes")
        p.wait("board.setupName === 'GRAIL' && game.mode === 'local'", 5)
        assert p.js("board.players.map(p => p.name).join()") == "Anna,Bruno"
        assert p.js("board.localIndex") is None and p.js("game.ai") is None
        p.shot("05-grail-in-due")

        step("in due: trascino un pezzo blu, sparo, poi muove l'arancione")
        # Trascinamento: il King blu in e2 sale in e3? In GRAIL e3 è occupata: provo f2
        p.tap_cell("e2")
        p.wait("board.selected && board.selected.piece && board.selected.piece.type === 'King'", 3)
        target = p.js("board.neighbors(board.cellByName('e2')).find(c => c.highlight).name")
        p.tap_cell(target)
        p.wait("board.phase === 'fire'", 3)
        p.click("#btn-fire")
        settle(p)
        p.wait("board.turn === 1", 5)
        assert "Bruno" in p.text("#status-text")

        step("tutte le configurazioni si avviano, con e senza varianti")
        for name in ["ACE", "CURIOSITY", "GRAIL", "MERCURY", "SOPHIE"]:
            for variants in ["false", "true"]:
                p.js(f"settings.setup = '{name}'; settings.variants = {{ prism: {variants}, halfMirror: {variants} }}; newGame('local'); 0")
                n = p.js("board.pieces.length")
                assert n == (30 if variants == "true" else 26), (name, variants, n)
        p.check_no_errors()
    finally:
        p.quit()

    step("telefono in verticale e in orizzontale")
    for w, h, label in [(390, 844, "verticale"), (844, 390, "orizzontale")]:
        m = Page(w, h, f"telefono-{label}")
        try:
            m.open()
            m.click("#new-start")
            m.wait("!document.getElementById('dlg-new').open")
            m.tap_cell("h2")
            m.wait("board.selected !== null", 3)
            # Niente scorrimento orizzontale e board intera nel canvas
            assert m.js("document.documentElement.scrollWidth <= window.innerWidth + 1"), "la pagina scorre in orizzontale"
            assert m.js("(() => { const r = document.querySelector('#stage canvas').getBoundingClientRect(); return r.bottom <= window.innerHeight + 1; })()"), "la board esce dallo schermo"
            assert m.visible("#btn-fire") and m.visible("#hint"), "SPARA o suggerimento non visibili"
            fire = m.js("document.getElementById('btn-fire').getBoundingClientRect().bottom")
            assert fire <= h, f"SPARA fuori dallo schermo ({fire} > {h})"
            m.shot("layout")
            m.check_no_errors()
        finally:
            m.quit()
    print("OK: test_single")


if __name__ == "__main__":
    sys.exit(main())
