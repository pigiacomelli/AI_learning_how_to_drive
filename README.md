# AI Self-Driving Car — Neuroevolution Simulation

A browser-based simulation of self-driving cars that learn to navigate a track through **neuroevolution** — a genetic algorithm that evolves the weights of a neural network generation by generation, with no human-labelled data required.

Built with **[p5.js](https://p5js.org/)** (rendering) and **[TensorFlow.js](https://www.tensorflow.org/js)** (neural network).

---

## Demo

> Open `index.html` directly in any modern browser — no build step needed.

Cars start moving randomly. After a few generations they learn to follow the track, avoid walls, and eventually cross the finish line.

---

## How It Works

### Neural Network

Each car carries a small **feed-forward neural network**:

```
Input (9)  →  Hidden Dense(5, tanh)  →  Output Dense(2, tanh)
```

| Layer  | Size | Activation | Description                              |
|--------|------|------------|------------------------------------------|
| Input  | 9    | —          | Normalised sensor distances (0=wall, 1=clear) |
| Hidden | 5    | tanh       | Learned feature representation           |
| Output | 2    | tanh       | `[rotation, acceleration]`               |

### Sensors

Each car casts **9 rays** spanning −90° to +90° relative to its heading. Each ray reports the distance to the nearest wall (max 200 px), which is normalised and fed into the network.

### Genetic Algorithm

| Step | Description |
|------|-------------|
| **Selection** | Top 3 cars by fitness are kept as **elites** |
| **Reproduction** | Every car in the next generation is a mutated clone of one elite |
| **Mutation** | Each weight has a 6% chance of being perturbed by `N(0, 0.1)` Gaussian noise |
| **Fitness** | Speed + progress toward finish + survival time − collision penalties |

A car earns a **2000-point bonus** and stops when it crosses the finish line (tile type `2`).

---

## Project Structure

```
IA-learn-how-to-drive/
├── index.html        # App shell, HUD sidebar, styles
├── sketch.js         # p5.js setup/draw, generation manager, keyboard shortcuts
├── car.js            # Car class: sensors, physics, fitness, rendering
├── brain.js          # Cerebro class: TF.js network, mutation, localStorage I/O
├── mapa_gerado.js    # Auto-generated tile map (run pista.py to regenerate)
├── pista.png         # Source track image (draw your own!)
├── pista.py          # Python script: converts pista.png → mapa_gerado.js
└── server.js         # Optional Node.js static file server
```

---

## Running the Simulation

### Option A – Open directly in browser (easiest)

```bash
# Just double-click index.html, or:
xdg-open index.html      # Linux
open index.html          # macOS
```

### Option B – Local Node.js server

```bash
npm install express      # one-time setup
node server.js
# Open http://localhost:3000
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Save best brain to `localStorage` |
| `L` | Load saved brain (starts a new run from it) |
| `R` | Reset simulation (clears elites, generation 1) |
| `+` | Double the simulation speed |
| `-` | Halve the simulation speed |

Buttons in the HUD sidebar replicate the same actions.

---

## HUD Sidebar

The sidebar shows live statistics:

- **Generation** — current generation number  
- **Frame** — frames elapsed in this generation (max 3000)  
- **Speed** — current simulation frame rate  
- **Alive / Total** — surviving cars with a progress bar  
- **Best Score (ever)** — highest fitness seen across all generations  
- **Leader Score** — score of the current best car  
- **Finishers** — total cars that crossed the finish line (all-time)

---

## Customising

### Simulation Parameters (`sketch.js`)

```js
const POPULATION_SIZE = 30;    // cars per generation
const MUTATION_RATE   = 0.06;  // weight mutation probability
const MAX_FRAMES      = 3000;  // time budget per generation
const ELITE_COUNT     = 3;     // top brains preserved
```

### Neural Network Architecture (`brain.js`)

```js
// Change the hidden layer size or add more layers:
this.model.add(tf.layers.dense({ units: 8, inputShape: [9], activation: 'tanh' }));
this.model.add(tf.layers.dense({ units: 4, activation: 'relu' }));
this.model.add(tf.layers.dense({ units: 2, activation: 'tanh' }));
```

> ⚠️ If you change the architecture, any previously saved brains in `localStorage` will be incompatible — clear them with `localStorage.removeItem('bestBrain')`.

### Custom Track

1. Draw a new track image (PNG, any size):
   - **Black** pixels → walls (tile 1)
   - **White / light** pixels → road (tile 0)
   - **Green** pixels → finish line (tile 2)
   - **Blue** pixels → spawn point (tile 3)

2. Save it as `pista.png` and run:

```bash
pip install pillow numpy
python pista.py
```

This regenerates `mapa_gerado.js`.

---

## Tile Map Values

| Value | Meaning       | Colour in simulation |
|-------|---------------|----------------------|
| `0`   | Road          | Dark grey            |
| `1`   | Wall          | Light grey           |
| `2`   | Finish line   | Green                |
| `3`   | Spawn point   | Blue                 |

---

## Brain Persistence

The best brain from any generation can be saved to the browser's `localStorage` (press **S**). On the next visit, press **L** to load it — the simulation will resume from that trained state, giving new cars a head start.

Internally, the brain is serialised as plain JSON (weight arrays + shapes) so it survives page reloads without any server.

---

## Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| [p5.js](https://p5js.org/) | 1.9.0 | 2-D graphics, game loop, math utils |
| [TensorFlow.js](https://www.tensorflow.org/js) | 4.20.0 | Neural network inference & weight mutation |

Both are loaded from CDN — no `npm install` needed for the simulation itself.

---

## License

MIT — free to use, modify, and share.
