// Configurazioni iniziali del manuale: [classe, giocatore (0 = primo, 1 = secondo), colonna, riga, rotazione].
// I Laser e le caselle riservate li aggiunge addPlayer.
// TODO: CURIOSITY, GRAIL, MERCURY, SOPHIE
const SETUPS = {
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
};

// Pezzi inventati, attivabili dalla barra laterale. Per un pezzo nuovo basta aggiungere una voce.
const VARIANTS = {
  prism: {
    label: "Prism",
    description: "Divide il raggio: prosegue dritto e si apre ai due lati",
    pieces: [
      [Prism, 0, 9, 7, "S"],
      [Prism, 1, 2, 2, "S"],
    ],
  },
  halfMirror: {
    label: "Specchio semitrasparente",
    description: "Metà del raggio passa, metà viene riflessa. Non può essere eliminato",
    pieces: [
      [HalfMirror, 0, 7, 2, "NE"],
      [HalfMirror, 1, 4, 7, "NE"],
    ],
  },
};
