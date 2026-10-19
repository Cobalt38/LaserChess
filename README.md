![CatWifGIF](https://github.com/user-attachments/assets/16b9ae3a-4783-4c88-88ce-ea28a65f8430)


ISTRUZIONI BELLISSIMEEEEE 🚀🤖:
https://legacy.thinkfun.com/wp-content/uploads/2017/10/LaserCh-1034-Instructions.pdf

## Come si gioca

- **Tocca o clicca** un tuo pezzo per vedere dove può andare
- **Trascinalo** su una casella evidenziata per muoverlo
- **Tasto destro** o **tieni premuto** sul pezzo per il menu di rotazione
- Poi premi **SPARA** (oppure **Spazio**, o tocca il tuo laser): colpisci il King avversario per vincere!
- **↶** (o **Ctrl+Z**) annulla la mossa finché non spari
- **Esc** annulla, **R** ricomincia
- Se la stessa posizione si ripete tre volte puoi **dichiarare patta** dalla barra laterale

Funziona anche da telefono: in verticale la board gira di 90° per essere più grande.
Dalla barra laterale si cambiano i **nomi**, si attivano le **varianti** con i pezzi inventati
(Prism e specchio semitrasparente) e si spegne l'audio.

## Giocare online

1. **🌐 Online** → scrivi il tuo nome → **Crea link partita**
2. Manda il link al tuo amico (o dettagli il codice di 6 lettere)
3. Quando lo apre e preme **Entra**, la partita parte: chi crea il link gioca col blu

Non serve scambiarsi indirizzi IP. I due browser si collegano direttamente con WebRTC
(connessione cifrata) grazie a [PeerJS](https://peerjs.com), una libreria open source: il suo
server pubblico serve solo a far trovare i due giocatori tramite il codice. Come in ogni gioco
con collegamento diretto, l'altro giocatore può vedere il tuo indirizzo IP.

Il link funziona dalla versione pubblicata su GitHub Pages: se apri `index.html` dal disco,
il link punta a un file sul tuo computer e il tuo amico non può aprirlo.

Per giocare in locale basta aprire `index.html` nel browser (p5.js arriva dal CDN).

## Struttura

```
index.html            pagina del gioco (carica tutti gli script, in ordine)
css/style.css         layout, barra laterale, pulsanti
assets/icon.ico       icona
js/
  sketch.js           avvio p5: setup/draw, input (mouse e touch), adattamento allo schermo, impostazioni
  config/
    constants.js      dimensioni, direzioni, colori, velocità del laser, caselle riservate
    setups.js         configurazioni iniziali (ACE...) e varianti con i pezzi inventati
  core/
    Board.js          regole e stato della partita: turni, mosse, annulla, patta, disegno
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
  net/
    Online.js         partita online: collegamento con PeerJS, invio delle mosse, risincronizzazione
  ui/
    GameUI.js         barra laterale: stato, SPARA, storico, nomi, varianti, fine partita
    OnlinePanel.js    finestra "Gioca online": generatore del link, ingresso, stato connessione
    ActionMenu.js     menu del pezzo (rotazioni)
```

Per aggiungere un pezzo inventato: crea la sua classe in `js/pieces/variants/`, aggiungila in
`index.html` e in `js/config/setups.js` (tra i `PIECE_TYPES` e nelle `VARIANTS`).
