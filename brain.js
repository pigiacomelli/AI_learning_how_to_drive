/**
 * Brain (Neural Network)
 * ──────────────────────
 * Architecture: Dense(9 → 5, tanh) → Dense(5 → 2, tanh)
 *  Input  (9): normalised sensor readings (0 = wall close, 1 = clear)
 *  Output (2): [rotation, acceleration]  both in [-1, 1]
 *
 * Evolution strategy: elitist mutation (top-N cloned + Gaussian noise).
 * Persistence: weights are serialised to JSON and stored in localStorage.
 */
class Cerebro {
  /**
   * @param {tf.Sequential|null} model  Pass an existing TF model to wrap it,
   *                                     or omit/null to build a fresh one.
   */
  constructor(model = null) {
    if (model) {
      this.model = model;
    } else {
      this.model = tf.sequential();
      // Input layer: 11 inputs (9 sensors + speed + angular velocity)
      this.model.add(tf.layers.dense({ units: 18, inputShape: [11], activation: 'relu' }));
      this.model.add(tf.layers.dense({ units: 10, activation: 'relu' }));
      this.model.add(tf.layers.dense({ units: 2, activation: 'tanh' }));
    }
  }

  // ── Inference ─────────────────────────────────────────────────────────────

  /**
   * Forward-pass: given 9 sensor readings return [rotation, acceleration].
   * @param {number[]} readings  Array of 9 numbers in [0, 1]
   * @returns {Float32Array}     [rotation, acceleration]
   */
  pensar(readings) {
    return tf.tidy(() => {
      const input = tf.tensor2d([readings]);
      const output = this.model.predict(input);
      return output.dataSync();
    });
  }

  // ── Cloning & Mutation ────────────────────────────────────────────────────

  /**
   * Deep-clone this brain (same architecture + weights).
   * @returns {Cerebro}
   */
  copiaCerebro() {
    const newModel = tf.sequential();
    this.model.layers.forEach(layer => {
      newModel.add(tf.layers.dense(layer.getConfig()));
    });
    const weights = this.model.getWeights();
    const newWeights = weights.map(w => w.clone());
    newModel.setWeights(newWeights);
    return new Cerebro(newModel);
  }

  /**
   * In-place Gaussian mutation of all weights.
   * @param {number} rate  Probability [0, 1] that each weight is mutated.
   */
  mutar(rate) {
    tf.tidy(() => {
      const weights = this.model.getWeights();
      const newWeights = weights.map(tensor => {
        const vals = tensor.dataSync().slice();
        for (let i = 0; i < vals.length; i++) {
          if (Math.random() < rate) {
            vals[i] += randn_bm() * 0.1; // soft Gaussian perturbation
          }
        }
        return tf.tensor(vals, tensor.shape);
      });
      this.model.setWeights(newWeights);
    });
  }

  /**
   * Crossover: create a new brain by mixing weights from this one and another.
   * Simple arithmetic mean of weights (effectively "averaging" their traits).
   * @param {Cerebro} outro
   * @returns {Cerebro}
   */
  cruzar(outro) {
    return tf.tidy(() => {
      const w1 = this.model.getWeights();
      const w2 = outro.model.getWeights();
      const newWeights = w1.map((tensor, i) => {
        const v1 = tensor.dataSync();
        const v2 = w2[i].dataSync();
        const combined = new Float32Array(v1.length);
        for (let j = 0; j < v1.length; j++) {
          // 50% chance to take from either parent (uniform crossover)
          combined[j] = Math.random() < 0.5 ? v1[j] : v2[j];
        }
        return tf.tensor(combined, tensor.shape);
      });

      const novoModelo = tf.sequential();
      this.model.layers.forEach(layer => {
        novoModelo.add(tf.layers.dense(layer.getConfig()));
      });
      novoModelo.setWeights(newWeights);
      return new Cerebro(novoModelo);
    });
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /**
   * Serialise weights to a plain JSON-compatible object.
   * @returns {{ shapes: number[][], values: number[][] }}
   */
  exportarPesos() {
    const weights = this.model.getWeights();
    return {
      shapes: weights.map(w => w.shape),
      values: weights.map(w => Array.from(w.dataSync())),
    };
  }

  /**
   * Load weights from a plain object (the format produced by exportarPesos).
   * @param {{ shapes: number[][], values: number[][] }} data
   */
  importarPesos(data) {
    try {
      const tensors = data.values.map((vals, i) =>
        tf.tensor(vals, data.shapes[i])
      );
      this.model.setWeights(tensors);
      tensors.forEach(t => t.dispose());
    } catch (e) {
      console.warn("⚠️ Failed to import weights. Likely architecture mismatch.", e);
      throw e; // re-throw to be handled by caller
    }
  }

  /**
   * Save this brain to localStorage under the given key.
   * @param {string} key
   */
  salvarEmLocalStorage(key = 'bestBrain') {
    localStorage.setItem(key, JSON.stringify(this.exportarPesos()));
  }

  /**
   * Load a saved brain from localStorage.
   * @param {string} key
   * @returns {Cerebro|null}  null if nothing is stored under key.
   */
  static carregarDeLocalStorage(key = 'bestBrain') {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const brain = new Cerebro();
      brain.importarPesos(JSON.parse(raw));
      return brain;
    } catch (e) {
      console.warn("⚠️ Clearing incompatible brain from LocalStorage.");
      // localStorage.removeItem(key); // optional: clear it
      return null;
    }
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────

/**
 * Box-Muller transform: returns a standard-normal random number.
 * Used for smooth weight mutation.
 */
function randn_bm() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
