# Test nel browser

Aprono il gioco in Firefox (senza finestra) e lo usano come una persona: clic sulla board,
pulsanti, finestre, pagina ricaricata. `test_online.py` apre due Firefox che giocano tra loro
attraverso il server pubblico di PeerJS, quindi serve internet.

Servono Firefox, geckodriver e Selenium:

```
python3 -m venv .venv && .venv/bin/pip install selenium
python3 -m http.server 8765 --bind 127.0.0.1     # dalla cartella principale del gioco
cd tests/e2e
../../.venv/bin/python test_single.py   # computer, in due, nomi, configurazioni, telefono
../../.venv/bin/python test_online.py   # due browser online
```

Variabili utili: `LASERCHESS_URL` (indirizzo del gioco), `GECKODRIVER` (percorso di geckodriver),
`LASERCHESS_SHOTS` (cartella degli screenshot, di default `tests/e2e/screenshots`).
Con Firefox installato come snap, i profili temporanei devono stare nella home:
`TMPDIR=~/snap/firefox/common/tmp`.
