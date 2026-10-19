![CatWifGIF](https://github.com/user-attachments/assets/16b9ae3a-4783-4c88-88ce-ea28a65f8430)


ISTRUZIONI BELLISSIMEEEEE 🚀🤖:
https://legacy.thinkfun.com/wp-content/uploads/2017/10/LaserCh-1034-Instructions.pdf

## Come si gioca

- **Tocca o clicca** un tuo pezzo per vedere dove può andare
- **Trascinalo** su una casella evidenziata per muoverlo
- **Tasto destro** o **tieni premuto** sul pezzo per il menu di rotazione
- Poi premi **SPARA** (oppure **Spazio**, o tocca il tuo laser): colpisci il King avversario per vincere!
- **Esc** annulla, **R** ricomincia
- Se la stessa posizione si ripete tre volte puoi **dichiarare patta** dalla barra laterale

Funziona anche da telefono: in verticale la board gira di 90° per essere più grande.
Dalla barra laterale si attivano le **varianti** con i pezzi inventati (Prism e specchio semitrasparente) e si spegne l'audio.

Per giocare in locale basta aprire `index.html` nel browser (p5.js arriva dal CDN).

## Struttura

```
index.html            pagina del gioco (carica tutti gli script, in ordine)
css/style.css         layout, barra laterale, pulsanti
assets/icon.ico       icona
js/
  sketch.js           avvio p5: setup/draw, input (mouse e touch), adattamento allo schermo
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
  ui/
    GameUI.js         barra laterale: stato, SPARA, storico, varianti, fine partita
    ActionMenu.js     menu del pezzo (rotazioni)
```

Per aggiungere un pezzo inventato: crea la sua classe in `js/pieces/variants/`, aggiungila in
`index.html` e mettila tra le `VARIANTS` in `js/config/setups.js`.
