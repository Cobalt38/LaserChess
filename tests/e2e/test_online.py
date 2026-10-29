"""Partita online tra due Firefox (serve internet: usa il server pubblico di PeerJS).
Collegamento col link, nomi uguali, mosse, nuova partita chiesta dal guest, connessione che
muore in silenzio, host che perde il server di contatto, pagina ricaricata da entrambi."""
import sys
import time

from helpers import Page, settle


_last = [time.time()]


def step(msg):
    now = time.time()
    print(f"  ({now - _last[0]:.1f} s)\n- {msg}", flush=True)
    _last[0] = now


def connected(*pages, timeout=40):
    for p in pages:
        p.wait("online.state === 'connected'", timeout, "collegati")
    # Il guest ha ricevuto la fotografia dell'host
    pages[1].wait("board.players.length === 2 && !board.busy", 10)


def same_board(a, b, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        ka, kb = a.js("board.positionKey() + '|' + board.turn + board.phase"), b.js("board.positionKey() + '|' + board.turn + board.phase")
        if ka == kb:
            return ka
        time.sleep(0.2)
    raise AssertionError("le due board sono diverse")


def play(p, frm, ok=lambda c: True):
    """Sposta il pezzo in frm su una casella evidenziata e spara."""
    p.tap_cell(frm)
    p.wait(f"board.selected && board.selected.name === '{frm}'", 5)
    target = p.js("board.neighbors(board.selected).filter(c => c.highlight).map(c => c.name)")
    p.tap_cell(target[0])
    p.wait("board.phase === 'fire'", 5)
    p.click("#btn-fire")
    p.wait("board.busy || board.phase === 'move'", 5)
    settle(p)


def main():
    a = Page(1100, 760, "host")
    b = Page(1100, 760, "guest")
    try:
        step("A: dalla finestra iniziale sceglie Online e crea il link")
        a.open()
        a.click("#welcome-play")
        a.click("input[name=mode][value=online] + span")
        a.click("#new-start")
        a.wait("document.getElementById('dlg-online').open", 5)
        a.fill("#my-name", "Anna")
        a.click("#my-name-save")
        a.click("#btn-host")
        a.wait("online.state === 'hosting'", 30, "codice registrato")
        link = a.js("online.inviteLink")
        code = a.js("online.code")
        assert a.visible("#invite-link")
        a.shot("01-link")

        step("B, mentre gioca contro il computer, prova un codice sbagliato: errore e torna alla sua partita")
        b.open()
        b.click("#welcome-play")
        b.click("#new-start")
        b.wait("game.mode === 'ai' && !document.getElementById('dlg-new').open", 5)
        b.click("#btn-online")
        b.fill("#join-code", "ZZZZZZ")
        b.d.find_element("css selector", "#join-form button").click()
        b.wait("online.state === 'error'", 30, "errore per il codice sbagliato")
        assert "non trovata" in b.text("#online-msg"), b.text("#online-msg")
        assert b.js("game.mode") == "ai" and b.js("!!game.ai") and b.js("board.localIndex") == 0
        b.js("document.getElementById('dlg-online').close(); 0")

        step("B apre il link, si chiama anche lui Anna ed entra")
        b.d.get(link)
        b.wait("typeof board === 'object' && board.players.length === 2", 20)
        b.wait("document.getElementById('dlg-online').open", 5)
        b.fill("#my-name", "anna")
        b.d.find_element("css selector", "#join-form button").click()
        connected(a, b)
        assert b.js("board.localIndex") == 1 and b.js("view.turns") == 2, "il guest deve vedere la board girata"
        names = ["Anna", "anna (2)"]
        b.wait("board.players.map(p => p.name).join() === 'Anna,anna (2)'", 5, "nomi deduplicati sul guest")
        a.wait("board.players.map(p => p.name).join() === 'Anna,anna (2)'", 5, "nomi deduplicati sull'host")
        assert b.js("game.mode") == "online" and b.js("game.ai") is None
        same_board(a, b)

        step("mosse dai due lati")
        play(a, "h2")
        b.wait("board.history.length === 1", 10)
        same_board(a, b)
        play(b, "c7")
        a.wait("board.history.length === 2", 10)
        same_board(a, b)
        b.shot("02-dopo-due-mosse")

        step("B chiede una nuova partita: A rifiuta, poi accetta")
        b.click("#btn-new")
        b.wait("document.getElementById('dlg-ask').open", 5)
        b.click("#ask-yes")
        a.wait("document.getElementById('dlg-ask').open", 10, "domanda all'host")
        a.click("#ask-no")
        b.wait("!document.getElementById('toast').hidden && document.getElementById('toast').textContent.includes('preferisce')", 10)
        assert a.js("board.history.length") == 2
        b.click("#btn-new")
        b.wait("document.getElementById('dlg-ask').open", 5)
        b.click("#ask-yes")
        a.wait("document.getElementById('dlg-ask').open", 10)
        a.click("#ask-yes")
        a.wait("board.history.length === 0", 5)
        b.wait("board.history.length === 0", 10)
        same_board(a, b)

        step("la connessione muore in silenzio: B se ne accorge e si ricollega da solo")
        play(a, "h2")
        b.wait("board.history.length === 1", 10)
        b.js("online.conn.removeAllListeners('data'); 0")  # B non riceve più nulla
        b.wait("online.state !== 'connected'", 15, "B si accorge della connessione morta")
        assert "ricollego" in b.text("#status-text").lower(), b.text("#status-text")
        connected(a, b, timeout=60)
        assert a.js("online.code") == code
        same_board(a, b)
        play(b, "c7")
        a.wait("board.history.length === 2", 10)

        step("A perde il server di contatto: si ricollega con lo stesso codice, B può rientrare")
        a.js("online.peer.disconnect(); 0")
        a.wait("online.peer && online.peer.open && !online.peer.disconnected", 60, "host di nuovo registrato")
        assert a.js("online.code") == code, "il codice non deve cambiare"
        assert a.js("online.connected"), "la partita in corso non deve cadere"
        b.click("#btn-online")
        b.click("#btn-leave")
        b.wait("document.getElementById('dlg-ask').open", 5)
        b.click("#ask-yes")
        b.wait("online.state === 'off'", 5)
        a.wait("online.state === 'lost'", 20, "A vede B uscire")
        b.d.get(link)
        b.wait("typeof board === 'object' && document.getElementById('dlg-online').open", 20)
        b.d.find_element("css selector", "#join-form button").click()
        connected(a, b, timeout=60)
        same_board(a, b)

        step("A ricarica la pagina: riprende la partita con lo stesso codice e B rientra da solo")
        key = same_board(a, b)
        a.d.refresh()
        a.wait("typeof board === 'object' && online.role === 'host'", 20)
        assert a.js("online.code") == code
        connected(a, b, timeout=120)
        assert same_board(a, b) == key, "partita diversa dopo il ricaricamento dell'host"

        step("B ricarica la pagina: rientra senza ripremere Entra")
        b.d.refresh()
        b.wait("typeof board === 'object' && online.role === 'guest'", 20)
        assert not b.js("document.getElementById('dlg-online').open"), "non deve chiedere di nuovo di entrare"
        connected(a, b, timeout=60)
        assert same_board(a, b) == key
        a.shot("03-fine")
        b.shot("03-fine")

        a.check_no_errors()
        b.check_no_errors()
        print("OK: test_online")
    finally:
        a.quit()
        b.quit()


if __name__ == "__main__":
    sys.exit(main())
