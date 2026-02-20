/**
 * server.js – Static file server for the AI Self-Driving Car simulation.
 *
 * Usage:
 *   node server.js
 *
 * Then open http://localhost:3000 in your browser.
 *
 * Requires: npm install express
 */

const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve all files in the project directory as static assets
app.use(express.static(path.join(__dirname)));

// Explicit root route (optional — express.static already handles it)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log('   Press Ctrl+C to stop.');
});
