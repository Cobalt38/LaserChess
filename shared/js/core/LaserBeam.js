// Un colpo di laser. Il percorso viene calcolato tutto subito (senza toccare la board),
// poi il raggio avanza di LASER_SPEED caselle al secondo e quando raggiunge un pezzo
// la board riceve l'evento corrispondente (riflesso, blocco, distruzione...).
class LaserBeam {
  constructor(board, source) {
    this.board = board;
    this.source = source; // pezzo Laser che spara
    this.segments = []; // { a, b, t }: tratto da a a b, percorso tra t e t+1
    this.events = []; // { t, piece, cell, effect }, in ordine di t (cell: dove il raggio colpisce il pezzo)
    this.progress = 0; // caselle percorse dal fronte del raggio
    this.hold = 0; // secondi passati a raggio completo
    this.nextEvent = 0;
    this.resolved = false; // turno chiuso (fine partita o turno successivo)
    this.trace(source.cell, source.rot);
    this.duration = this.segments.reduce((m, s) => Math.max(m, s.t + 1), 0);
  }

  // Visita in ampiezza: tutti i rami avanzano di una casella per passo, così con il Prism
  // un pezzo distrutto da un ramo non c'è più per i rami che arrivano dopo
  trace(startCell, startDir) {
    const half = this.board.cellSize / 2;
    const removed = new Set(); // pezzi già eliminati da questo colpo
    const visited = new Set(); // "x,y,dir": evita loop infiniti tra specchi
    let fronts = [{ cell: startCell, dir: startDir }];
    for (let t = 0; fronts.length > 0; t++) {
      const next = [];
      for (const { cell, dir } of fronts) {
        const key = `${cell.rx},${cell.ry},${dir}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const v = DIR_VEC[dir];
        const from = cell.center;
        const target = this.board.getCell(cell.rx + v.x, cell.ry + v.y);
        if (!target) {
          // Esce dalla board: il tratto finisce sul bordo
          this.segments.push({ a: from, b: { x: from.x + v.x * half, y: from.y - v.y * half }, t });
          continue;
        }
        this.segments.push({ a: from, b: target.center, t });

        const piece = target.piece;
        if (!piece || removed.has(piece)) {
          next.push({ cell: target, dir });
          continue;
        }
        const { out, effect } = piece.hit(dir);
        this.events.push({ t: t + 1, piece, cell: target, effect });
        if (effect === "destroy" || effect === "king") removed.add(piece);
        for (const d of out) next.push({ cell: target, dir: d });
      }
      fronts = next;
    }
  }

  get reachedEnd() {
    return this.progress >= this.duration;
  }

  // Avanza il raggio e restituisce gli eventi raggiunti in questo frame
  update(dt) {
    if (this.reachedEnd) this.hold += dt;
    else this.progress = Math.min(this.duration, this.progress + dt * LASER_SPEED);
    const reached = [];
    while (this.nextEvent < this.events.length && this.events[this.nextEvent].t <= this.progress) {
      reached.push(this.events[this.nextEvent++]);
    }
    return reached;
  }

  show() {
    const visible = [];
    const heads = [];
    for (const s of this.segments) {
      const k = this.progress - s.t;
      if (k <= 0) continue;
      if (k >= 1) {
        visible.push(s);
      } else {
        const b = { x: lerp(s.a.x, s.b.x, k), y: lerp(s.a.y, s.b.y, k) };
        visible.push({ a: s.a, b });
        heads.push(b);
      }
    }
    if (visible.length === 0) return;

    push();
    noFill();
    strokeCap(ROUND);
    // Prima tutti i bordi esterni e poi tutti i nuclei: niente "gomiti" dove i raggi si incrociano
    const flicker = 1 + 0.12 * Math.sin(millis() / 35);
    drawingContext.shadowColor = "rgba(255, 40, 40, 0.8)";
    drawingContext.shadowBlur = 12 * flicker;
    stroke(...LASER_COLOR.outer);
    strokeWeight(5 * flicker);
    for (const s of visible) line(s.a.x, s.a.y, s.b.x, s.b.y);
    drawingContext.shadowBlur = 0;
    stroke(...LASER_COLOR.inner);
    strokeWeight(2);
    for (const s of visible) line(s.a.x, s.a.y, s.b.x, s.b.y);

    // Testa del raggio mentre avanza
    noStroke();
    for (const h of heads) {
      fill(...LASER_COLOR.outer, 90);
      ellipse(h.x, h.y, 18);
      fill(255, 255, 220);
      ellipse(h.x, h.y, 7);
    }
    pop();
  }
}
