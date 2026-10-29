// Lezioni del tutorial (js/ui/Tutorial.js). Si gioca col blu, l'arancione non muove: ogni lezione
// si vince con una sola mossa che manda il raggio sul King arancione. Nei testi niente "in alto" o
// "a destra": sui telefoni in verticale la board può essere girata.
// pieces: come in SETUPS (i Laser li aggiunge la board, nei soliti angoli).
// hint: la soluzione, mostrata da "Aiuto": il pezzo in "at", da ruotare verso "rot" o spostare in "to".
// tests/rules.test.js controlla che all'inizio il raggio non vinca e che la soluzione vinca.
const LESSONS = [
  {
    title: "Ruota uno specchio",
    text: "Il raggio parte dal tuo Laser e gli specchi verdi lo deviano. Tocca il tuo Deflector e ruotalo con le frecce gialle finché la linea tratteggiata arriva al King arancione. Poi premi SPARA.",
    pieces: [
      [Deflector, 0, 10, 5, "SE"],
      [King, 0, 6, 1, "N"],
      [King, 1, 4, 5, "S"],
    ],
    hint: { at: "j5", rot: "SW" },
  },
  {
    title: "Sposta un pezzo",
    text: "Invece di ruotare puoi spostare un pezzo di una casella, anche in diagonale. Tocca il Deflector e poi una casella gialla (o trascinalo): mettilo sulla strada del raggio.",
    pieces: [
      [Deflector, 0, 9, 6, "SW"],
      [King, 0, 6, 1, "N"],
      [King, 1, 5, 6, "S"],
    ],
    hint: { at: "i6", to: "j6" },
  },
  {
    title: "Non colpire il tuo King",
    text: "Il mirino rosso segna i pezzi che il raggio eliminerebbe: qui è sul TUO King, e se lo colpisci perdi. Ruota il Deflector in mezzo alla board per mandare il raggio sul King arancione.",
    pieces: [
      [Deflector, 0, 10, 5, "SW"],
      [Deflector, 0, 5, 5, "SE"],
      [King, 0, 5, 1, "N"],
      [King, 1, 5, 8, "S"],
    ],
    hint: { at: "e5", rot: "NE" },
  },
  {
    title: "Aggira lo scudo",
    text: "Il Defender ferma il raggio con lo scudo (se lo colpisci di lato o da dietro, invece, viene eliminato). Il King arancione è dietro lo scudo: sposta uno dei tuoi Deflector sulla strada del raggio per aggirarlo.",
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
