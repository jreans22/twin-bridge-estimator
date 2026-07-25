const http = require('http');
const fs = require('fs');
const path = require('path');
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.gif':'image/gif'
};
const port = process.env.PORT || 3000;
const root = __dirname;
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const safe = path.normalize(p).replace(/^(\.\.[\/\\])+/, '');
  const file = path.join(root, safe);
  fs.readFile(file, (err, data) => {
    if (err) {
      // Unknown path -> serve the app (single-page fallback)
      fs.readFile(path.join(root, 'index.html'), (e2, d2) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2 || 'Not found');
      });
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const noCache = ext === '.html' || safe === '/config.js';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': noCache ? 'no-cache' : 'public, max-age=86400'
    });
    res.end(data);
  });
}).listen(port, '0.0.0.0', () => console.log('Estimator live on ' + port));
