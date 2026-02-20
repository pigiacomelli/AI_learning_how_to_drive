/**
 * Car.js – Self-driving car agent
 * ────────────────────────────────
 * Each car has:
 *  • 9 distance sensors spread from -90° to +90° relative to heading
 *  • A neural network (Cerebro) that maps sensor readings → [rotation, acceleration]
 *  • A fitness function combining speed, proximity-to-finish, and survival time
 *  • Finish-line detection: big bonus + `finished` flag when crossing tile type 2
 */
class Car {
  /**
   * @param {number}  x       Spawn X (pixels)
   * @param {number}  y       Spawn Y (pixels)
   * @param {Cerebro} brain   Neural network instance
   */
  constructor(x, y, brain) {
    // ── Position & motion ────────────────────────────────────────────────
    this.x = x;
    this.y = y;
    this.vel = createVector(0, 0);
    this.angle = 0;

    // ── Status ───────────────────────────────────────────────────────────
    this.alive = true;
    this.finished = false;  // true once the car crosses the finish line

    // ── Neural network ───────────────────────────────────────────────────
    this.brain = brain ? brain.copiaCerebro() : new Cerebro();

    // ── Sensors (angles in radians, relative to heading) ─────────────────
    this.sensors = [
      radians(-90), radians(-60), radians(-40), radians(-20),
      0,
      radians(20), radians(40), radians(60), radians(90),
    ];
    this.readings = new Array(this.sensors.length).fill(200);

    // ── Fitness metrics ──────────────────────────────────────────────────
    this.score = 0;
    this.distanceTravelled = 0;
    this.lastPosition = createVector(x, y);
    this.accumulatedSpeed = 0;
    this.framesAlive = 0;
    this.idleFrames = 0;   // frames without meaningful movement
    this.collisions = 0;

    // ── Distance-to-finish (BFS, cached) ────────────────────────────────
    this._finishCache = null;           // finish tile positions
    this._distanceCache = new Map();      // cell-key → BFS distance

    this.distToFinish = this._bfsDistanceToFinish();
    this.bestDist = this.distToFinish;
  }

  // ── Update ──────────────────────────────────────────────────────────────
  update() {
    if (!this.alive) return;

    // Distance travelled this frame
    const dFrame = dist(this.x, this.y, this.lastPosition.x, this.lastPosition.y);
    this.distanceTravelled += dFrame;
    this.lastPosition.set(this.x, this.y);

    // Sensor readings
    this.readings = this.sensors.map(offset => this._sensorReading(offset));

    // Neural network decision
    const inputs = this.readings.map(v => map(v, 0, 200, 1, 0)); // 1 = clear, 0 = wall
    const [rot, throttle] = this.brain.pensar(inputs);
    this.angle += rot * 0.1;
    this.vel.add(p5.Vector.fromAngle(this.angle).mult(throttle * 0.3));

    // Apply friction & move
    this.vel.mult(0.95);
    this.x += this.vel.x;
    this.y += this.vel.y;
    this.framesAlive++;

    // Idle penalisation
    if (this.vel.mag() < 0.1) this.idleFrames++;
    else this.idleFrames = 0;
    if (this.idleFrames > 300) {       // ~5 s standing still
      this.alive = false;
      this.score -= 100;
      return;
    }

    // Speed bonus
    const speed = this.vel.mag();
    this.accumulatedSpeed += speed;
    if (speed > 1.5) this.score += speed * 0.2;
    else if (speed > 0.5) this.score += speed * 0.15;

    // Progress-toward-finish bonus (BFS-aware, handles walls)
    const prevDist = this.distToFinish;
    this.distToFinish = this._bfsDistanceToFinish();
    if (this.distToFinish < prevDist) {
      this.score += (prevDist - this.distToFinish) * 0.3;
    }
    if (this.distToFinish < this.bestDist) this.bestDist = this.distToFinish;

    // ── Finish-line detection ────────────────────────────────────────────
    if (!this.finished) {
      const col = floor(this.x / tileSize);
      const row = floor(this.y / tileSize);
      if (
        row >= 0 && row < mapa.length &&
        col >= 0 && col < mapa[0].length &&
        mapa[row][col] === 2
      ) {
        this.finished = true;
        this.score += 2000;  // big bonus for finishing
        this.alive = false; // stop — mission accomplished
      }
    }

    // ── Collision detection ──────────────────────────────────────────────
    if (this._hasCollided()) {
      this.collisions++;
      this.score -= 40 * this.collisions;
      if (this.collisions > 2) this.alive = false;
    }
  }

  // ── Fitness ─────────────────────────────────────────────────────────────
  calcularFitness() {
    let fitness = this.score;
    if (!this.alive && !this.finished) fitness *= 0.7;

    const avgSpeed = this.accumulatedSpeed / Math.max(1, this.framesAlive);
    fitness += this.framesAlive * 0.1 + avgSpeed * 50;

    // Reward proximity to finish line
    fitness += Math.max(0, (1000 - this.bestDist) * 0.2);

    return Math.max(0, fitness);
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  /**
   * Draw the car.
   * @param {boolean} isLeader  If true, renders in highlight style with visible sensors.
   */
  show(isLeader = false) {
    push();
    translate(this.x, this.y);

    // Sensor lines (always visible for leader, hidden otherwise when dead)
    if (isLeader || this.alive) {
      for (let i = 0; i < this.sensors.length; i++) {
        const ang = this.angle + this.sensors[i];
        const d = this.readings[i];

        // Color-code: red = close to wall, green = clear ahead
        const t = d / 200; // 0 = wall, 1 = clear
        stroke(lerpColor(color(255, 60, 60, 160), color(60, 230, 100, 80), t));
        strokeWeight(isLeader ? 1.5 : 0.8);
        line(0, 0, cos(ang) * d, sin(ang) * d);
      }
    }

    // Car body
    rotate(this.angle);
    noStroke();

    if (!this.alive) {
      fill(60, 60, 70, 180);           // dead: dark grey
    } else if (this.finished) {
      fill(0, 230, 80);                // finished: bright green
    } else if (isLeader) {
      fill(255, 220, 0);               // leader: gold
      stroke(255, 255, 255, 200);
      strokeWeight(2);
    } else {
      fill(255, 120, 40);              // normal: orange
    }

    rectMode(CENTER);
    rect(0, 0, 30, 15, 3);            // slightly rounded car rectangle

    // Direction indicator (small triangle at front)
    if (isLeader && this.alive) {
      fill(255, 255, 255, 200);
      triangle(15, 0, 8, -5, 8, 5);
    }

    pop();
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vel.set(0, 0);
    this.angle = 0;
    this.alive = true;
    this.finished = false;
    this.score = 0;
    this.distanceTravelled = 0;
    this.lastPosition.set(x, y);
    this.accumulatedSpeed = 0;
    this.framesAlive = 0;
    this.collisions = 0;
    this.idleFrames = 0;
    this._distanceCache.clear();
    this.distToFinish = this._bfsDistanceToFinish();
    this.bestDist = this.distToFinish;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Cast a single ray and return distance to nearest wall (max 200 px). */
  _sensorReading(offset) {
    const ang = this.angle + offset;
    for (let d = 0; d < 200; d += 5) {
      const px = this.x + cos(ang) * d;
      const py = this.y + sin(ang) * d;
      const row = floor(py / tileSize);
      const col = floor(px / tileSize);
      if (row < 0 || row >= mapa.length || col < 0 || col >= mapa[0].length) return d;
      if (mapa[row][col] === 1) return d;
    }
    return 200;
  }

  /** True if the car's current tile is a wall or out of bounds. */
  _hasCollided() {
    const row = floor(this.y / tileSize);
    const col = floor(this.x / tileSize);
    if (row < 0 || row >= mapa.length || col < 0 || col >= mapa[0].length) return true;
    return mapa[row][col] === 1;
  }

  /** BFS distance (in pixels) from current tile to any finish tile. */
  _bfsDistanceToFinish() {
    const col = floor(this.x / tileSize);
    const row = floor(this.y / tileSize);
    const key = `${col},${row}`;

    if (this._distanceCache.has(key)) return this._distanceCache.get(key);

    const start = createVector(col, row);
    const targets = this._finishTiles();
    if (targets.length === 0) return 9999;

    const dist_ = this._bfs(start, targets);

    // Keep cache bounded
    this._distanceCache.set(key, dist_);
    if (this._distanceCache.size > 100) {
      const first = this._distanceCache.keys().next().value;
      this._distanceCache.delete(first);
    }
    return dist_;
  }

  /** Returns (and caches) all tile positions where mapa value === 2. */
  _finishTiles() {
    if (!this._finishCache) {
      this._finishCache = [];
      for (let r = 0; r < mapa.length; r++) {
        for (let c = 0; c < mapa[r].length; c++) {
          if (mapa[r][c] === 2) this._finishCache.push(createVector(c, r));
        }
      }
    }
    return this._finishCache;
  }

  /** BFS on tile grid; returns shortest path length × tileSize, or 9999. */
  _bfs(start, targets) {
    // Quick check: already at a target tile?
    for (const t of targets) {
      if (start.x === t.x && start.y === t.y) return 0;
    }

    const visited = new Set([`${start.x},${start.y}`]);
    const queue = [{ pos: start, steps: 0 }];
    const dirs = [createVector(0, -1), createVector(1, 0), createVector(0, 1), createVector(-1, 0)];

    while (queue.length > 0) {
      const { pos, steps } = queue.shift();

      for (const t of targets) {
        if (pos.x === t.x && pos.y === t.y) return steps * tileSize;
      }

      for (const d of dirs) {
        const np = createVector(pos.x + d.x, pos.y + d.y);
        const nk = `${np.x},${np.y}`;
        if (!visited.has(nk) && this._tileWalkable(np)) {
          visited.add(nk);
          queue.push({ pos: np, steps: steps + 1 });
        }
      }
    }
    return 9999;
  }

  /** A tile is walkable if it's road (0), spawn (3), or finish (2). */
  _tileWalkable(pos) {
    if (pos.y < 0 || pos.y >= mapa.length || pos.x < 0 || pos.x >= mapa[0].length) return false;
    return mapa[pos.y][pos.x] !== 1;
  }
}