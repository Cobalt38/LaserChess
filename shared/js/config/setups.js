// Configurazioni iniziali del manuale: [classe, giocatore (0 = blu, 1 = arancione), colonna, riga, rotazione].
// I Laser e le caselle riservate li aggiunge addPlayer.
// Sono tutte simmetriche: il pezzo arancione in (11 - x, 9 - y) è quello blu girato di 180°
// (lo controlla tests/rules.test.js). Fonte: manuale ThinkFun (LaserCh-1034-Instructions.pdf),
// nella trascrizione di github.com/kishannareshpal/laserchess (docs/Guide.md, tabelle dei pezzi).
const SETUPS = {
  // Inventata per questo gioco (non è nel manuale), con i pezzi inventati già dentro: lo specchio
  // semitrasparente accanto al Laser manda metà del raggio sul Prism al centro, che lo apre su tre
  // lati. Controllata come le altre: alla prima mossa nessuno può eliminare un pezzo avversario.
  PRISMA: [
    [Defender, 0, 4, 1, "N"],
    [King, 0, 5, 1, "N"],
    [Defender, 0, 6, 1, "N"],
    [Deflector, 0, 3, 2, "NW"],
    [Switch, 0, 5, 2, "NE"],
    [Deflector, 0, 8, 2, "NW"],
    [Deflector, 0, 2, 3, "NW"],
    [Deflector, 0, 7, 3, "NE"],
    [Deflector, 0, 9, 3, "NW"],
    [Deflector, 0, 3, 4, "NW"],
    [Switch, 0, 4, 4, "NE"],
    [Prism, 0, 6, 4, "N"],
    [HalfMirror, 0, 10, 4, "NE"],

    [Defender, 1, 5, 8, "S"],
    [King, 1, 6, 8, "S"],
    [Defender, 1, 7, 8, "S"],
    [Deflector, 1, 3, 7, "SE"],
    [Switch, 1, 6, 7, "SW"],
    [Deflector, 1, 8, 7, "SE"],
    [Deflector, 1, 2, 6, "SE"],
    [Deflector, 1, 4, 6, "SW"],
    [Deflector, 1, 9, 6, "SE"],
    [HalfMirror, 1, 1, 5, "SW"],
    [Prism, 1, 5, 5, "S"],
    [Switch, 1, 7, 5, "SW"],
    [Deflector, 1, 8, 5, "SE"],
  ],
  ACE: [
    //player1
    [Deflector, 0, 3, 1, "NW"],
    [Defender, 0, 4, 1, "N"],
    [King, 0, 5, 1, "NW"],
    [Defender, 0, 6, 1, "N"],
    [Deflector, 0, 8, 2, "NE"],
    [Deflector, 0, 3, 4, "NW"],
    [Switch, 0, 5, 4, "NW"],
    [Switch, 0, 6, 4, "NE"],
    [Deflector, 0, 10, 4, "SW"],
    [Deflector, 0, 3, 5, "SW"],
    [Deflector, 0, 10, 5, "NW"],
    [Deflector, 0, 4, 6, "NW"],

    //player2
    [Deflector, 1, 8, 8, "SE"],
    [Defender, 1, 7, 8, "S"],
    [King, 1, 6, 8, "S"],
    [Defender, 1, 5, 8, "S"],
    [Deflector, 1, 3, 7, "SW"],
    [Deflector, 1, 1, 5, "NE"],
    [Switch, 1, 5, 5, "SW"],
    [Switch, 1, 6, 5, "SE"],
    [Deflector, 1, 8, 5, "SE"],
    [Deflector, 1, 1, 4, "SE"],
    [Deflector, 1, 8, 4, "NE"],
    [Deflector, 1, 7, 3, "SE"],
  ],
  CURIOSITY: [
    [Switch, 0, 3, 1, "NW"],
    [Defender, 0, 4, 1, "N"],
    [King, 0, 5, 1, "N"],
    [Defender, 0, 6, 1, "N"],
    [Deflector, 0, 4, 3, "SW"],
    [Deflector, 0, 2, 4, "NW"],
    [Switch, 0, 5, 4, "NW"],
    [Deflector, 0, 10, 4, "SW"],
    [Deflector, 0, 2, 5, "SW"],
    [Deflector, 0, 5, 5, "SE"],
    [Deflector, 0, 10, 5, "NW"],
    [Deflector, 0, 4, 6, "NW"],

    [Deflector, 1, 7, 3, "SE"],
    [Deflector, 1, 1, 4, "SE"],
    [Deflector, 1, 6, 4, "NW"],
    [Deflector, 1, 9, 4, "NE"],
    [Deflector, 1, 1, 5, "NE"],
    [Switch, 1, 6, 5, "NW"],
    [Deflector, 1, 9, 5, "SE"],
    [Deflector, 1, 7, 6, "NE"],
    [Defender, 1, 5, 8, "S"],
    [King, 1, 6, 8, "N"],
    [Defender, 1, 7, 8, "S"],
    [Switch, 1, 8, 8, "NW"],
  ],
  GRAIL: [
    [Deflector, 0, 4, 1, "NW"],
    [Defender, 0, 5, 1, "N"],
    [Deflector, 0, 6, 1, "NE"],
    [King, 0, 5, 2, "N"],
    [Switch, 0, 4, 3, "NW"],
    [Defender, 0, 5, 3, "N"],
    [Deflector, 0, 6, 3, "NE"],
    [Deflector, 0, 10, 3, "SW"],
    [Switch, 0, 8, 4, "NE"],
    [Deflector, 0, 10, 4, "NW"],
    [Deflector, 0, 5, 5, "NW"],
    [Deflector, 0, 7, 5, "SE"],

    [Deflector, 1, 4, 4, "NW"],
    [Deflector, 1, 6, 4, "SE"],
    [Deflector, 1, 1, 5, "SE"],
    [Switch, 1, 3, 5, "NE"],
    [Deflector, 1, 1, 6, "NE"],
    [Deflector, 1, 5, 6, "SW"],
    [Defender, 1, 6, 6, "S"],
    [Switch, 1, 7, 6, "NW"],
    [King, 1, 6, 7, "N"],
    [Deflector, 1, 5, 8, "SW"],
    [Defender, 1, 6, 8, "S"],
    [Deflector, 1, 7, 8, "SE"],
  ],
  MERCURY: [
    [Deflector, 0, 4, 1, "NW"],
    [King, 0, 5, 1, "N"],
    [Deflector, 0, 6, 1, "NE"],
    [Deflector, 0, 4, 2, "NW"],
    [Defender, 0, 5, 2, "N"],
    [Defender, 0, 5, 3, "N"],
    [Switch, 0, 7, 3, "NW"],
    [Deflector, 0, 10, 3, "NW"],
    [Deflector, 0, 10, 4, "SW"],
    [Deflector, 0, 5, 5, "NW"],
    [Deflector, 0, 9, 5, "SW"],
    [Switch, 0, 10, 8, "NW"],

    [Switch, 1, 1, 1, "NW"],
    [Deflector, 1, 2, 4, "NE"],
    [Deflector, 1, 6, 4, "SE"],
    [Deflector, 1, 1, 5, "NE"],
    [Deflector, 1, 1, 6, "SE"],
    [Switch, 1, 4, 6, "NW"],
    [Defender, 1, 6, 6, "S"],
    [Defender, 1, 6, 7, "S"],
    [Deflector, 1, 7, 7, "SE"],
    [Deflector, 1, 5, 8, "SW"],
    [King, 1, 6, 8, "N"],
    [Deflector, 1, 7, 8, "SE"],
  ],
  SOPHIE: [
    [Deflector, 0, 4, 1, "NW"],
    [King, 0, 6, 1, "N"],
    [Defender, 0, 5, 2, "W"],
    [Defender, 0, 7, 2, "N"],
    [Deflector, 0, 5, 3, "NW"],
    [Deflector, 0, 6, 3, "NE"],
    [Deflector, 0, 10, 3, "SW"],
    [Switch, 0, 3, 4, "NE"],
    [Switch, 0, 8, 6, "NW"],
    [Deflector, 0, 10, 6, "NW"],
    [Deflector, 0, 10, 7, "SW"],
    [Deflector, 0, 6, 8, "NW"],

    [Deflector, 1, 5, 1, "SE"],
    [Deflector, 1, 1, 2, "NE"],
    [Deflector, 1, 1, 3, "SE"],
    [Switch, 1, 3, 3, "NW"],
    [Switch, 1, 8, 5, "NE"],
    [Deflector, 1, 1, 6, "NE"],
    [Deflector, 1, 5, 6, "SW"],
    [Deflector, 1, 6, 6, "SE"],
    [Defender, 1, 4, 7, "S"],
    [Defender, 1, 6, 7, "E"],
    [King, 1, 5, 8, "N"],
    [Deflector, 1, 7, 8, "SE"],
  ],
};

// La descrizione di ogni configurazione è nei testi (js/i18n), chiave setup.<nome>

// Tutte le classi dei pezzi per nome: servono per ricostruire una partita ricevuta online.
// Un pezzo nuovo va aggiunto anche qui.
const PIECE_TYPES = { Laser, King, Defender, Deflector, Switch, Prism, HalfMirror };

// Pezzi inventati, attivabili dalla finestra "Nuova partita". Per un pezzo nuovo basta aggiungere
// una voce: il primo pezzo è del blu, il secondo dell'arancione nella casella a specchio. Nome e
// descrizione sono nei testi (js/i18n): variant.<chiave>.label / .desc, piece.<classe>, info.<classe>.
// Una variante non si aggiunge alle disposizioni che hanno già quel pezzo (es. PRISMA).
// La casella indicata è quella preferita: se in una configurazione è occupata, o se da lì
// qualcuno potrebbe eliminare un pezzo avversario alla prima mossa, il pezzo va nella casella
// libera più vicina dove questo non succede (vedi Board.placeVariants).
const VARIANTS = {
  prism: {
    pieces: [
      [Prism, 0, 9, 7, "S"],
      [Prism, 1, 2, 2, "S"],
    ],
  },
  halfMirror: {
    pieces: [
      [HalfMirror, 0, 7, 2, "NE"],
      [HalfMirror, 1, 4, 7, "NE"],
    ],
  },
};
