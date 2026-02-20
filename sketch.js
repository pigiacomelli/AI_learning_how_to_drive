/**
 * sketch.js – Main simulation loop (p5.js)
 * ─────────────────────────────────────────
 * Keyboard shortcuts:
 *   S  →  save best brain to localStorage
 *   L  →  load brain from localStorage
 *   R  →  reset simulation (generation 1, random brains)
 *   +  →  increase simulation speed (double frameRate)
 *   -  →  decrease simulation speed (halve frameRate)
 */

// ── Evolution parameters ───────────────────────────────────────────────────
const POPULATION_SIZE = 30;   // cars per generation
const MUTATION_RATE = 0.06; // probability a weight is mutated per step
const MAX_FRAMES = 3000; // frame budget per generation (~50 s @ 60 fps)
const ELITE_COUNT = 3;    // top brains kept across generations

// ── Simulation state ───────────────────────────────────────────────────────
let population = [];   // current generation of Car objects
let eliteBrains = [];   // Cerebro instances of best performers
let generation = 1;
let frameCount_ = 0;    // renamed to avoid clash with p5's frameCount
let transitioning = false;
let bestScoreEver = 0;
let totalFinished = 0;   // cars that crossed the finish line (all-time)
let currentFPS = 60;

// ── Map data (loaded from mapa_gerado.js) ─────────────────────────────────
// Expected globals: tileSize (number), mapa (2-D number array)
// Tile values: 0 = road, 1 = wall, 2 = finish line, 3 = spawn
let spawnPoint = { x: 0, y: 0 };
let finishLine = { y: 0, xStart: 0, xEnd: 0 };

// ── p5.js setup ───────────────────────────────────────────────────────────
function setup() {
  const canvasW = mapa[0].length * tileSize;
  const canvasH = mapa.length * tileSize;

  // Attach canvas to its wrapper div
  const cnv = createCanvas(canvasW, canvasH);
  cnv.parent('canvas-wrap');

  frameRate(currentFPS);
  detectSpawnAndFinish();
  newGeneration();
}

// ── Main loop ──────────────────────────────────────────────────────────────
function draw() {
  background(0);
  drawMap();

  let aliveCount = 0;
  let leaderScore = -Infinity;
  let leader = null;

  // Update all cars; find leader
  for (const car of population) {
    car.update();
    if (car.alive) {
      aliveCount++;
      if (car.score > leaderScore) {
        leaderScore = car.score;
        leader = car;
      }
    }
  }

  // Draw dead cars first, then alive, then leader on top
  for (const car of population) {
    if (!car.alive) car.show(false);
  }
  for (const car of population) {
    if (car.alive && car !== leader) car.show(false);
  }
  if (leader) leader.show(true);

  frameCount_++;

  // Update best-ever score
  if (leaderScore > bestScoreEver) bestScoreEver = leaderScore;

  // Update HUD
  updateHUD(aliveCount, leaderScore);

  // On-canvas mini-info
  fill(255);
  noStroke();
  textFont('monospace');
  textSize(13);
  text(`Gen: ${generation}  |  Frame: ${frameCount_}/${MAX_FRAMES}`, 8, 18);

  // Advance to next generation when all dead or time's up
  if ((aliveCount === 0 || frameCount_ > MAX_FRAMES) && !transitioning) {
    nextGeneration();
  }
}

// ── Map rendering ──────────────────────────────────────────────────────────
function drawMap() {
  for (let row = 0; row < mapa.length; row++) {
    for (let col = 0; col < mapa[row].length; col++) {
      const v = mapa[row][col];
      if (v === 1) fill(70, 70, 80);          // wall
      else if (v === 2) fill(0, 230, 80, 180);     // finish line
      else if (v === 3) fill(60, 160, 255, 200);   // spawn
      else fill(20, 20, 28);           // road
      noStroke();
      rect(col * tileSize, row * tileSize, tileSize, tileSize);
    }
  }
}

// ── Spawn & finish detection ───────────────────────────────────────────────
function detectSpawnAndFinish() {
  for (let row = 0; row < mapa.length; row++) {
    for (let col = 0; col < mapa[row].length; col++) {
      if (mapa[row][col] === 3) {
        spawnPoint = {
          x: col * tileSize + tileSize / 2,
          y: row * tileSize + tileSize / 2,
        };
      } else if (mapa[row][col] === 2) {
        if (finishLine.y === 0) finishLine.y = row;
        if (finishLine.xStart === 0) finishLine.xStart = col;
        finishLine.xEnd = col;
      }
    }
  }
  console.log(`📍 Spawn: (${spawnPoint.x}, ${spawnPoint.y})`);
  console.log(`🏁 Finish row ${finishLine.y}, cols ${finishLine.xStart}–${finishLine.xEnd}`);
}

// ── Generation management ──────────────────────────────────────────────────
function newGeneration() {
  frameCount_ = 0;
  transitioning = false;
  population = [];

  for (let i = 0; i < POPULATION_SIZE; i++) {
    let brain;
    if (eliteBrains.length > 0) {
      const parent = eliteBrains[i % eliteBrains.length];
      brain = parent.copiaCerebro();
      brain.mutar(MUTATION_RATE);
    } else {
      // Try loading a saved brain for generation 1
      const saved = Cerebro.carregarDeLocalStorage();
      brain = saved ? saved : new Cerebro();
      if (saved && i > 0) { brain.mutar(MUTATION_RATE); }
    }
    population.push(new Car(spawnPoint.x, spawnPoint.y, brain));
  }
}

function nextGeneration() {
  transitioning = true;

  // Evaluate fitness and sort descending
  population.sort((a, b) => b.calcularFitness() - a.calcularFitness());
  eliteBrains = population.slice(0, ELITE_COUNT).map(c => c.brain.copiaCerebro());

  // Count finishers this generation
  totalFinished += population.filter(c => c.finished).length;

  generation++;
  newGeneration();
}

// ── HUD update ─────────────────────────────────────────────────────────────
function updateHUD(aliveCount, leaderScore) {
  const total = population.length;
  document.getElementById('hud-gen').textContent = generation;
  document.getElementById('hud-time').textContent = frameCount_;
  document.getElementById('hud-fps').textContent = `${currentFPS} FPS`;
  document.getElementById('hud-alive').textContent = aliveCount;
  document.getElementById('hud-total').textContent = total;
  document.getElementById('hud-bar').style.width = `${(aliveCount / total) * 100}%`;
  document.getElementById('hud-best-ever').textContent = Math.floor(bestScoreEver);
  document.getElementById('hud-leader').textContent = leaderScore === -Infinity ? '—' : Math.floor(leaderScore);
  document.getElementById('hud-finished').textContent = totalFinished;
}

// ── Brain persistence (called from HTML buttons & keyboard) ────────────────
function salvarCerebro() {
  if (population.length === 0) return;
  population.sort((a, b) => b.calcularFitness() - a.calcularFitness());
  population[0].brain.salvarEmLocalStorage();
  showToast('✅ Brain saved to localStorage!');
}

function carregarCerebro() {
  const brain = Cerebro.carregarDeLocalStorage();
  if (!brain) { showToast('⚠️ No saved brain found.'); return; }
  eliteBrains = [brain];
  generation = 1;
  totalFinished = 0;
  bestScoreEver = 0;
  newGeneration();
  showToast('📂 Brain loaded! Starting fresh from gen 1.');
}

function resetarTudo() {
  eliteBrains = [];
  generation = 1;
  totalFinished = 0;
  bestScoreEver = 0;
  newGeneration();
  showToast('🔄 Simulation reset.');
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
function keyPressed() {
  if (key === 's' || key === 'S') salvarCerebro();
  if (key === 'l' || key === 'L') carregarCerebro();
  if (key === 'r' || key === 'R') resetarTudo();
  if (key === '+' || key === '=') {
    currentFPS = min(currentFPS * 2, 240);
    frameRate(currentFPS);
    showToast(`⚡ Speed: ${currentFPS} FPS`);
  }
  if (key === '-' || key === '_') {
    currentFPS = max(currentFPS / 2, 5);
    frameRate(currentFPS);
    showToast(`🐢 Speed: ${currentFPS} FPS`);
  }
}

// ── Toast notification ─────────────────────────────────────────────────────
let _toastTimeout;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => el.classList.remove('show'), 2500);
}
