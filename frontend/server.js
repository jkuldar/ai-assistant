const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

// Crash early with clear message if dist doesn't exist
if (!fs.existsSync(distPath)) {
  console.error('ERROR: dist/ folder does not exist. Run "npm run build" first.');
  process.exit(1);
}
if (!fs.existsSync(indexPath)) {
  console.error('ERROR: dist/index.html does not exist. Build may have failed.');
  process.exit(1);
}

console.log(`Serving files from: ${distPath}`);
console.log(`PORT: ${PORT}`);

const apiUrl = process.env.VITE_API_URL || process.env.API_URL || '';
if (apiUrl) {
  console.log(`API URL: ${apiUrl}`);
} else {
  console.warn('WARNING: VITE_API_URL / API_URL is not set. API calls will fall back to same origin.');
}

// Read and cache the index.html, injecting a runtime config script
let indexHtml = fs.readFileSync(indexPath, 'utf8');
if (apiUrl) {
  indexHtml = indexHtml.replace(
    '<head>',
    `<head><script>window.__API_URL__ = ${JSON.stringify(apiUrl)};</script>`
  );
}

// Serve static files from dist/
app.use(express.static(distPath));

// SPA fallback - all routes serve index.html with injected config
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(indexHtml);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
});
