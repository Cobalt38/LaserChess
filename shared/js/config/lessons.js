// Lezioni del tutorial (js/ui/Tutorial.js). Si gioca col blu, l'arancione non muove: ogni lezione
// si vince con una sola mossa che manda il raggio sul King arancione. Il blu vede la board dritta
// (vedi view in sketch.js), quindi il suo laser spara sempre verso l'alto.
// pieces: come in SETUPS (i Laser li aggiunge la board, nei soliti angoli).
// hint: la soluzione, mostrata da "Aiuto": il pezzo in "at", da ruotare verso "rot" o spostare in "to".
// id: titolo e testo sono nei testi (js/i18n), chiavi lesson.<id>.title e lesson.<id>.text.
// tests/rules.test.js controlla che all'inizio il raggio non vinca e che la soluzione vinca.
const LESSONS = [
  {
    id: "rotate",
    pieces: [
      [Deflector, 0, 10, 5, "SE"],
      [King, 0, 6, 1, "N"],
      [King, 1, 4, 5, "S"],
    ],
    hint: { at: "j5", rot: "SW" },
  },
  {
    id: "move",
    pieces: [
      [Deflector, 0, 9, 6, "SW"],
      [King, 0, 6, 1, "N"],
      [King, 1, 5, 6, "S"],
    ],
    hint: { at: "i6", to: "j6" },
  },
  {
    id: "ownKing",
    pieces: [
      [Deflector, 0, 10, 5, "SW"],
      [Deflector, 0, 5, 5, "SE"],
      [King, 0, 5, 1, "N"],
      [King, 1, 5, 8, "S"],
    ],
    hint: { at: "e5", rot: "NE" },
  },
  {
    id: "shield",
    pieces: [
      [Deflector, 0, 10, 4, "SW"],
      [Deflector, 0, 8, 3, "NE"],
      [Deflector, 0, 8, 6, "SW"],
      [Deflector, 0, 5, 6, "SE"],
      [King, 0, 7, 1, "N"],
      [Defender, 1, 6, 4, "E"],
      [King, 1, 5, 4, "S"],
    ],
    hint: { at: "h3", to: "h4" },
  },
];
