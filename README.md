![CatWifGIF](https://github.com/user-attachments/assets/16b9ae3a-4783-4c88-88ce-ea28a65f8430)


ISTRUZIONI BELLISSIMEEEEE 🚀🤖:
https://legacy.thinkfun.com/wp-content/uploads/2017/10/LaserCh-1034-Instructions.pdf

## Come si gioca

Vince chi colpisce per primo il King avversario con il proprio laser. A ogni turno si sposta
un proprio pezzo di una casella (anche in diagonale) **oppure** lo si ruota, poi si spara.

- **Tocca** un tuo pezzo, poi tocca una casella evidenziata per spostarlo (oppure **trascinalo**)
- Le frecce **↺ ↻** che compaiono accanto al pezzo selezionato lo ruotano (anche **Q**/**E**, tasto
  destro o pressione lunga sul pezzo); col mouse sopra una freccia l'anteprima mostra il raggio ruotato
- Poi premi **SPARA** (oppure **Spazio**, o tocca il tuo laser)
- Prima di sparare una **linea tratteggiata** mostra dove andrà il raggio e segna con un mirino
  i pezzi che verrebbero eliminati
- **↶** (o **Ctrl+Z**) annulla la mossa finché non spari
- **Esc** annulla, **R** ricomincia
- Se la stessa posizione si ripete tre volte puoi **dichiarare patta**

Sotto la board un riquadro spiega sempre cosa fare: i due passi del turno, il passo attuale e
cosa fa il pezzo che hai toccato (anche se è dell'avversario). Si può nascondere da **Regole**.

La finestra **Nuova partita** (aperta da sola alla prima visita) sceglie:
- **contro il computer** (Facile, Medio, Difficile; si può giocare col blu o con l'arancione),
  **in due sullo stesso schermo** oppure **online**;
- la **disposizione iniziale**: PRISMA (predefinita, inventata per questo gioco: Prism e specchio
  semitrasparente sono già in campo) oppure quelle del manuale, ACE (consigliata dal manuale per
  iniziare), CURIOSITY, GRAIL, MERCURY, SOPHIE;
- le **varianti** con i pezzi inventati (Prism e specchio semitrasparente). I loro pezzi vanno
  in caselle scelte in modo che alla prima mossa nessuno possa eliminare un pezzo avversario
  (le disposizioni del manuale sono già così).

Ricaricando la pagina la partita in corso riprende da dove era.

Funziona anche da telefono: in verticale la board gira di 90° quando così è più grande.

## Giocare online

1. **🌐 Online** → scrivi il tuo nome → **Crea link partita**
2. Manda il link al tuo amico (o dettagli il codice di 6 lettere)
3. Quando lo apre e preme **Entra**, la partita parte: chi crea il link gioca col blu

Se la connessione cade (telefono bloccato, cambio di rete) chi è entrato col link si ricollega da
solo e la partita continua; l'host resta in ascolto sullo stesso codice, quindi il link non cambia
mai. Anche ricaricando la pagina si rientra nella stessa partita. Una nuova partita la crea l'host;
l'altro giocatore la può chiedere e l'host accetta o rifiuta.

Non serve scambiarsi indirizzi IP. I due browser si collegano direttamente con WebRTC
(connessione cifrata) grazie a [PeerJS](https://peerjs.com), una libreria open source: il suo
server pubblico serve solo a far trovare i due giocatori tramite il codice. Come in ogni gioco
con collegamento diretto, l'altro giocatore può vedere il tuo indirizzo IP.

Il link funziona dalla versione pubblicata su GitHub Pages: se apri `index.html` dal disco,
il link punta a un file sul tuo computer e il tuo amico non può aprirlo.

Per giocare in locale basta aprire `index.html` nel browser (p5.js arriva dal CDN).

## Test

- Regole, configurazioni e computer, senza browser (serve Node.js 18 o più recente):
  `node --test tests/*.test.js`
- Nel browser (Firefox + Selenium), vedi [tests/e2e/README.md](tests/e2e/README.md)

## Struttura

```
index.html            pagina del gioco (carica tutti gli script, in ordine)
css/style.css         layout, barra laterale, pulsanti
assets/icon.ico       icona
js/
  sketch.js           avvio p5: setup/draw, input (mouse e touch), adattamento allo schermo, impostazioni
  config/
    constants.js      dimensioni, direzioni, colori, velocità del laser, caselle riservate
    setups.js         configurazioni iniziali del manuale e varianti con i pezzi inventati
  core/
    Board.js          regole e stato della partita: turni, mosse, annulla, patta, anteprima del laser, disegno
    Cell.js           casella della board
    Player.js         giocatore
    LaserBeam.js      percorso del raggio e sua animazione
  pieces/
    Piece.js          classe base dei pezzi
    Laser.js  King.js  Defender.js  Deflector.js  Switch.js
    variants/         pezzi inventati: Prism.js, HalfMirror.js
  fx/
    Effects.js        scintille ed esplosioni
    Sound.js          effetti sonori sintetizzati
  ai/
    Engine.js         regole su un array di numeri (lette dalle classi dei pezzi) e ricerca della mossa
    AIPlayer.js       il computer come avversario: pensa a pezzi, muove, poi spara
  net/
    Online.js         partita online: collegamento con PeerJS, ping, ricollegamento, ripresa, risincronizzazione
  ui/
    GameUI.js         barra laterale e finestre: stato, suggerimenti, comandi, storico, nuova partita, nomi, regole
    OnlinePanel.js    finestra "Gioca online": generatore del link, ingresso, stato connessione
    ActionMenu.js     menu del pezzo (rotazioni)
tests/
  harness.js          carica gli script del gioco in Node, senza p5
  rules.test.js       configurazioni, prima mossa senza catture, motore uguale alla board, computer, nomi, anteprima
  e2e/                test nel browser (Firefox + Selenium)
```

Per aggiungere un pezzo inventato: crea la sua classe in `js/pieces/variants/`, aggiungila in
`index.html` e in `js/config/setups.js` (tra i `PIECE_TYPES` e nelle `VARIANTS`). Il computer
legge le regole del pezzo (`hit`, `rotations`, `canMoveTo`) dalla classe, quindi lo usa da solo.
La casella scritta in `VARIANTS` è quella preferita: se da lì si potrebbe eliminare un pezzo
avversario alla prima mossa, il gioco sceglie la casella libera più vicina dove non succede, e
`tests/rules.test.js` lo controlla per ogni disposizione e combinazione di varianti.
