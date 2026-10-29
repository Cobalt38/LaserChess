class Player {
  constructor(name, pColor = [0, 0, 0]) {
    this.baseName = name; // il nome scelto
    this.name = name; // il nome mostrato: se i due giocatori si chiamano uguale, al secondo si aggiunge "(2)"
    this.pColor = pColor;
    this.pieces = [];
    this.laser = null; // il pezzo Laser di questo giocatore
  }
}

// Due nomi uguali (senza contare maiuscole e spazi) non si distinguono nello storico e nei messaggi
function sameName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
