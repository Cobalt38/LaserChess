"""Benvenuto e tutorial, partita contro il computer e in due sullo stesso schermo, avvisi
dell'anteprima, finestre, nomi, configurazioni, ripresa dopo il ricaricamento, layout su telefono."""
import sys
import time

from helpers import Page, settle


def step(msg):
    print(f"- {msg}", flush=True)


def main():
    p = Page(1280, 800, "desktop")
    try:
        p.open()
        step("prima visita: benvenuto con l'immagine, tutorial o partita")
        assert p.js("document.getElementById('dlg-welcome').open"), "finestra di benvenuto chiusa"
        assert p.js("!!document.getElementById('welcome-art').src"), "immagine del benvenuto mancante"
        assert not p.visible("#welcome-resume"), "alla prima visita non c'è niente da riprendere"
        p.shot("00-benvenuto")

        step("tutorial: lezione 1 con l'aiuto, sparo, vinta; Esci porta alla nuova partita")
        p.click("#welcome-learn")
        p.wait("game.mode === 'tutorial' && tutorial.state === 'play' && tutorial.index === 0", 3)
        assert p.visible("#lesson-actions") and p.visible("#king-tag-1"), "comandi della lezione o etichetta del King mancanti"
        assert "Tutorial" in p.text("#status-text")
        p.click("#lesson-hint")
        assert p.js("board.hintCells.map(c => c.name).join()") == "j5"
        p.tap_cell("j5")
        p.click("#btn-rot-cw")
        p.wait("board.phase === 'fire'", 3)
        p.wait("document.getElementById('hint').classList.contains('good')", 3, "avviso verde: il raggio va sul King")
        p.click("#btn-fire")
        p.wait("tutorial.state === 'won'", 10, "lezione vinta")
        assert p.js("document.getElementById('gameover').hidden"), "nel tutorial niente finestra di fine partita"
        p.shot("00-tutorial-vinto")
        p.click("#lesson-next")
        p.wait("tutorial.index === 1 && tutorial.state === 'play'", 3)
        step("lezione 2 sbagliata apposta: si spiega e si riprova")
        p.tap_cell("i6")
        p.tap_cell("h6")
        p.click("#btn-fire")
        p.wait("tutorial.state === 'failed' && !document.getElementById('lesson-retry').hidden", 10)
        p.click("#lesson-retry")
        p.wait("tutorial.state === 'play' && board.cellByName('i6').piece", 3)
        p.click("#lesson-exit")
        p.wait("!tutorial.active && document.getElementById('dlg-new').open", 3)

        step("finestra Nuova partita: contro il computer, Facile, ACE")
        assert p.js("document.querySelector('#new-form').elements.mode.value") == "ai"
        assert p.js("document.querySelector('#new-form').elements.level.value") == "easy", "per chi inizia il livello è Facile"
        assert p.visible("#new-start"), "Inizia la partita deve essere in vista senza scorrere"
        assert p.js("!!document.getElementById('setup-preview').src"), "anteprima della disposizione mancante"
        assert p.js("document.getElementById('setup-select').value") == "ACE", "ACE deve essere la predefinita"
        assert p.js("[...document.querySelectorAll('[name=variant]')].every(i => !i.disabled && !i.checked)"), \
            "con ACE le varianti si possono scegliere e all'inizio sono spente"
        # Dietro la finestra la board è vuota: dove ci sarebbe il King blu c'è il nero della casella
        p.wait("document.getElementById('dlg-new').open && typeof board === 'object'", 3)
        assert max(p.pixel("e1")) < 40, f"la board deve essere vuota, al posto del King c'è {p.pixel('e1')}"
        p.shot("01-benvenuto")

        step("contro il computer, si gioca col blu; etichette sui King all'inizio")
        p.click("#new-start")
        p.wait("!document.getElementById('dlg-new').open")
        assert p.js("game.mode") == "ai" and p.js("board.localIndex") == 0
        assert p.js("board.setupName") == "ACE"
        assert p.js("board.pieces.filter(p => p.type === 'Prism' || p.type === 'HalfMirror').length") == 0
        p.wait("Math.max(...(" + "(() => { const c = board.cellByName('e1').center; const q = boardToScreen(c.x, c.y), d = pixelDensity(); return [...drawingContext.getImageData(Math.round(q.x * d), Math.round(q.y * d), 1, 1).data].slice(0, 3); })()" + ")) > 60", 3, "pezzi visibili dopo l'inizio")
        assert p.js("game.ai.side") == 1
        p.wait("document.getElementById('hint').textContent.includes('Tocca uno dei tuoi pezzi blu')", 3)
        assert p.text("#king-tag-0") == "Il tuo King" and p.text("#king-tag-1") == "King avversario"

        step("SPARA prima di muovere: spiega cosa fare")
        p.d.find_element("css selector", "#btn-fire").click()
        p.wait("!document.getElementById('toast').hidden && document.getElementById('toast').textContent.includes('Prima sposta')", 3)

        step("tocco un pezzo avversario: il suggerimento spiega cos'è")
        p.tap_cell("h5")  # Deflector arancione in ACE
        p.wait("document.getElementById('hint').textContent.includes('Deflector di Computer')", 3)

        step("tocco un mio Deflector: suggerimento, caselle evidenziate, ↺ ↻ attivi")
        p.tap_cell("h2")
        p.wait("board.selected && board.selected.name === 'h2'", 3)
        p.wait("document.getElementById('hint').textContent.startsWith('Deflector')", 3)
        # Le frecce di rotazione compaiono sulla board, sulla casella del pezzo selezionato
        p.wait("!document.getElementById('btn-rot-cw').hidden && !document.getElementById('btn-rot-ccw').hidden", 3)
        assert p.js("""(() => {
            const r = document.getElementById('btn-rot-cw').getBoundingClientRect();
            const s = document.querySelector('#stage canvas').getBoundingClientRect();
            const c = board.cellByName('h2').center, q = boardToScreen(c.x, c.y), half = board.cellSize * view.scale / 2;
            const bx = r.left + r.width / 2 - s.left, by = r.top + r.height / 2 - s.top;
            return Math.abs(bx - (q.x + half)) < 2 && Math.abs(Math.abs(by - q.y) - half) < 2;
        })()"""), "la freccia ↻ deve stare sull'angolo della casella del pezzo"
        assert p.js("!document.querySelector('#controls #btn-rot-cw')"), "le frecce non devono stare accanto a SPARA"
        # Col mouse sopra la freccia, l'anteprima mostra il raggio dopo la rotazione
        p.d.execute_script("document.getElementById('btn-rot-cw').dispatchEvent(new PointerEvent('pointerenter', {pointerType: 'mouse'}))")
        assert p.js("board.previewRotation && board.previewRotation.piece.cell.name === 'h2'")
        p.d.execute_script("document.getElementById('btn-rot-cw').dispatchEvent(new PointerEvent('pointerleave', {pointerType: 'mouse'}))")
        assert p.js("board.cellByName('h3').highlight")
        assert p.js("board.laserPreview() !== null"), "anteprima del laser assente"
        p.shot("02-selezione")

        step("tocco una casella evidenziata: il pezzo si sposta (tocco-tocco, senza trascinare)")
        p.tap_cell("h3")
        p.wait("board.phase === 'fire'", 3)
        assert p.js("board.cellByName('h3').piece && board.cellByName('h3').piece.type") == "Deflector"
        p.wait("document.getElementById('btn-fire').getAttribute('aria-disabled') === 'false'", 3)
        p.wait("document.getElementById('step-fire').classList.contains('active')", 3)
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
        p.click("#btn-rot-cw")
        p.wait("board.phase === 'fire'", 3)
        assert p.js("board.laserPreview().events.some(e => e.effect === 'king')"), "l'anteprima non segna il King"
        p.shot("06-mira-sul-king")
        p.click("#btn-fire")
        p.wait("!!board.gameOver && !document.getElementById('gameover').hidden", 10)
        assert "vince" in p.text("#go-title"), p.text("#go-title")
        p.shot("07-vittoria")
        p.click("#go-new")
        p.wait("!board.gameOver && board.history.length === 0 && board.pieces.length === SETUPS[board.setupName].length + 2", 5)
        assert p.js("game.mode") == "ai" and p.js("!!game.ai")

        step("il raggio colpirebbe il mio King: avviso rosso, conferma prima di sparare, Annulla la mossa")
        p.js("""board.restore({ setup: 'ACE', players: board.players.map(p => p.baseName), turn: 0, phase: 'move',
            history: [], lastMove: null, positions: [], drawClaimable: false, gameOver: null,
            pieces: [['Laser', 0, 10, 1, 'N'], ['Laser', 1, 1, 8, 'S'], ['King', 0, 5, 1, 'N'], ['King', 1, 5, 8, 'S']] }); 0""")
        p.tap_cell("j1")
        p.click("#btn-rot-cw")
        p.wait("board.phase === 'fire'", 3)
        p.wait("document.getElementById('hint').classList.contains('danger')", 3, "avviso rosso sul proprio King")
        p.click("#btn-fire")
        p.wait("document.getElementById('dlg-ask').open", 3, "conferma prima di colpire il proprio King")
        p.shot("06b-conferma-proprio-king")
        p.click("#ask-no")
        p.wait("board.phase === 'move' && board.cellByName('j1').piece.rot === 'N' && !board.gameOver", 3)
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
        assert not p.js("document.getElementById('dlg-welcome').open"), "ricaricando non si riparte dal benvenuto"

        step("chiudo la scheda e la riapro: impostazioni dimenticate, benvenuto con Riprendi la partita")
        p.js("sessionStorage.clear(); 0")  # come una scheda nuova: la partita salvata resta in localStorage
        p.d.refresh()
        p.wait("typeof board === 'object' && board.players.length === 2 && document.getElementById('dlg-welcome').open", 20)
        assert p.visible("#welcome-resume") and "2 mosse" in p.text("#welcome-resume"), p.text("#welcome-resume")
        assert p.js("settings.myName") == "", "nel browser il nome non resta tra una scheda e l'altra"
        assert p.js("localStorage.getItem('laserchess.settings')") is None
        p.shot("05a-riprendi")
        p.click("#welcome-resume")
        p.wait("!document.getElementById('dlg-welcome').open", 3)
        assert p.js(state) == key, "Riprendi deve rimettere la stessa partita"
        assert p.js("board.players[0].name") == "Mario"

        step("nuova partita in due: nomi uguali rifiutati, poi GRAIL")
        p.click("#btn-new")
        p.wait("document.getElementById('dlg-new').open", 3)
        assert p.visible("#new-tutorial"), "manca il collegamento al tutorial"
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
        p.wait("document.getElementById('status-text').textContent.includes('Bruno')", 3)

        step("contro il computer, inizia lui: io sono l'arancione e la board è girata")
        p.click("#btn-new")
        p.wait("document.getElementById('dlg-new').open", 3)
        p.click("input[name=mode][value=ai] + span")
        p.click("input[name=side][value='1'] + span")
        p.click("#new-start")
        p.wait("document.getElementById('dlg-ask').open", 3)
        p.click("#ask-yes")
        p.wait("game.mode === 'ai' && board.localIndex === 1", 5)
        assert p.js("game.ai.side") == 0 and p.js("board.players[0].name") == "Computer"
        assert p.js("view.turns") == 2, "l'arancione deve vedere i suoi pezzi in basso"
        p.wait("board.history.length === 1 && board.turn === 1 && !board.busy", 20, "prima mossa del computer")
        p.wait("document.getElementById('status-text').textContent.includes('Tocca a te')", 3)
        p.shot("08-inizia-il-computer")

        step("scheda nuova: scelgo il tutorial invece di Riprendi, la partita salvata non c'è più")
        p.js("sessionStorage.clear(); 0")
        p.d.refresh()
        p.wait("typeof board === 'object' && document.getElementById('dlg-welcome').open", 20)
        assert p.visible("#welcome-resume")
        p.click("#welcome-learn")
        p.wait("tutorial.active", 3)
        p.js("sessionStorage.clear(); 0")
        p.d.refresh()
        p.wait("typeof board === 'object' && document.getElementById('dlg-welcome').open", 20)
        assert not p.visible("#welcome-resume"), "dopo il tutorial la partita di prima non si riprende più"
        p.click("#welcome-play")
        p.wait("document.getElementById('dlg-new').open", 3)
        p.js("document.getElementById('dlg-new').close(); 0")

        step("tutte le configurazioni si avviano, con e senza varianti")
        for name in p.js("Object.keys(SETUPS)"):
            for variants in ["false", "true"]:
                p.js(f"settings.setup = '{name}'; settings.variants = {{ prism: {variants}, halfMirror: {variants} }}; newGame('local'); 0")
                n = p.js("board.pieces.length")
                base = p.js(f"SETUPS['{name}'].length + 2")
                has = p.js(f"SETUPS['{name}'].some(([c]) => c === Prism)")
                assert n == (base + 4 if variants == "true" and not has else base), (name, variants, n)

        step("lingua: dalle Regole passo all'inglese, la pagina si ricarica tradotta")
        p.js("for (const d of document.querySelectorAll('dialog[open]')) d.close(); 0")
        p.click("[data-open=dlg-help]")
        p.d.execute_script("const s = document.getElementById('opt-lang'); s.value = 'en'; s.dispatchEvent(new Event('change'));")
        p.wait("typeof board === 'object' && board.players.length === 2 && document.documentElement.lang === 'en'", 20)
        assert p.text("#btn-fire") == "FIRE", p.text("#btn-fire")
        assert p.text("[data-open=dlg-help] .label") == "Rules"
        p.wait("document.getElementById('hint').textContent.startsWith('Tap one of your blue pieces')", 5, "suggerimento in inglese")
        p.tap_cell("e2")
        p.wait("board.selected !== null", 3)
        p.shot("09-inglese")
        p.check_no_errors()
    finally:
        p.quit()

    step("telefono in verticale e in orizzontale")
    for w, h, label in [(390, 844, "verticale"), (844, 390, "orizzontale")]:
        m = Page(w, h, f"telefono-{label}")
        try:
            m.open()
            m.click("#welcome-play")
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
