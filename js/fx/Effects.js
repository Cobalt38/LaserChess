// Effetti grafici temporanei. Ognuno ha update(dt) -> false quando è finito, e show().

class Particle {
  constructor(x, y, col, speed, life, size) {
    const a = random(TWO_PI);
    const v = speed * random(0.3, 1);
    this.x = x;
    this.y = y;
    this.vx = Math.cos(a) * v;
    this.vy = Math.sin(a) * v;
    this.maxLife = life * random(0.5, 1);
    this.life = this.maxLife;
    this.col = col;
    this.size = size;
  }

  update(dt) {
    const drag = Math.pow(0.04, dt); // perde ~96% della velocità in un secondo
    this.vx *= drag;
    this.vy *= drag;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    return this.life > 0;
  }

  show() {
    const k = this.life / this.maxLife;
    stroke(...this.col, 255 * k);
    strokeWeight(this.size * (0.4 + 0.6 * k));
    point(this.x, this.y);
  }
}

// Sbuffo di particelle: scintille (additive) o frammenti di un pezzo
class Burst {
  constructor(x, y, count, speed, life, colors, size = 3, additive = true) {
    this.additive = additive;
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, random(colors), speed, life, size * random(0.6, 1.3)));
    }
  }

  update(dt) {
    this.particles = this.particles.filter((p) => p.update(dt));
    return this.particles.length > 0;
  }

  show() {
    push();
    if (this.additive) blendMode(ADD);
    for (const p of this.particles) p.show();
    blendMode(BLEND);
    pop();
  }
}

// Pezzo eliminato: onda d'urto, il pezzo si accartoccia ruotando e va in frammenti
class Explosion {
  constructor(piece, big = false) {
    const c = piece.cell.center;
    const s = big ? 1.8 : 1;
    this.piece = piece;
    this.center = c;
    this.size = piece.cell.size;
    this.age = 0;
    this.duration = big ? 0.9 : 0.5;
    this.spin = random([-1, 1]) * (big ? 2 : 3);
    this.fragments = new Burst(c.x, c.y, Math.round(22 * s), 140 * s, 0.9 * s, [piece.player.pColor], 5, false);
    this.sparks = new Burst(c.x, c.y, Math.round(28 * s), 220 * s, 0.6 * s, SPARK_COLORS, 3);
  }

  update(dt) {
    this.age += dt;
    const fragments = this.fragments.update(dt);
    const sparks = this.sparks.update(dt);
    return this.age < this.duration || fragments || sparks;
  }

  show() {
    const k = this.age / this.duration;
    if (k < 1) {
      const { x, y } = this.center;
      push();
      noFill();
      stroke(255, 120, 80, 255 * (1 - k));
      strokeWeight(4 * (1 - k));
      ellipse(x, y, this.size * (0.4 + 1.6 * k));
      pop();

      push();
      translate(x, y);
      rotate(this.spin * k);
      scale(Math.max(0.01, 1 - k * k));
      translate(-x, -y);
      this.piece.draw();
      pop();
    }
    this.fragments.show();
    this.sparks.show();
  }
}
