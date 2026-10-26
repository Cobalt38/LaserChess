// Dimensioni della board (colonne x righe) e lato di una casella in pixel
const COLS = 10;
const ROWS = 8;
const CELL_SIZE = 50;

// Direzioni in senso orario. Nelle coordinate relative (rx, ry) la y cresce verso N.
const DIRS = ["N", "E", "S", "W"];
const DIAGONALS = ["NE", "SE", "SW", "NW"];
const DIR_VEC = {
  N: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: -1 },
  W: { x: -1, y: 0 },
};
const OPPOSITE = { N: "S", E: "W", S: "N", W: "E" };

// Ruota rot di step passi (+1 orario, -1 antiorario) dentro il ciclo dato (DIRS o DIAGONALS)
function rotateIn(cycle, rot, step) {
  const n = cycle.length;
  return cycle[(cycle.indexOf(rot) + step + n) % n];
}

// Colori, da usare con lo spread (es. fill(...MIRROR_COLOR))
const MIRROR_COLOR = [50, 230, 50];
const LASER_COLOR = { outer: [255, 50, 50], inner: [200, 200, 50] };
const SPARK_COLORS = [[255, 220, 120], [255, 90, 50], [255, 255, 255]];

// Laser animato
const LASER_SPEED = 28; // caselle al secondo
const LASER_HOLD = 0.5; // secondi a raggio completo prima di passare il turno
const KING_HIT_HOLD = 1.3; // pausa più lunga per goderci l'esplosione del re
const BEAM_LINGER = 3; // secondi in cui il raggio dell'ultimo colpo resta visibile

// Input
const DRAG_THRESHOLD = 6; // unità board: oltre questo spostamento la pressione diventa trascinamento
const LONG_PRESS = 0.45; // secondi di pressione per aprire il menu del pezzo

// Colore, laser e caselle riservate (helix) di ciascun giocatore, in ordine di aggiunta
const PLAYER_SLOTS = [
  {
    color: [50, 100, 150],
    laser: { x: 10, y: 1, rot: "N" },
    exclusive: [[2, 1], [2, 8], [10, 2], [10, 3], [10, 4], [10, 5], [10, 6], [10, 7], [10, 8]],
  },
  {
    color: [150, 100, 50],
    laser: { x: 1, y: 8, rot: "S" },
    exclusive: [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [9, 1], [9, 8]],
  },
];
