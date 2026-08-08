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

/* Lead relay: the browser posts the lead payload to /api/lead (same origin, no
   secrets in the page); this server forwards it to Twin Bridge Central's intake
   endpoint with the shared secret from Railway env. TBC then writes its own
   DB AND pushes the lead into AccuLynx server-side. X360 keeps its existing
   direct webhook from the browser - this path is additive. */
function relayLead(req, res) {
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    const url = process.env.TBC_LEAD_URL;
    const secret = process.env.ESTIMATOR_LEAD_SECRET;
    if (!url || !secret) {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end('{"ok":false,"relay":"unconfigured"}');
      return;
    }
    try {
      const r = await fetch(url + '?key=' + encodeURIComponent(secret), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        signal: AbortSignal.timeout(20000)
      });
      const text = await r.text();
      res.writeHead(r.status, { 'Content-Type': 'application/json' });
      res.end(text);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end('{"ok":false,"relay":"failed"}');
    }
  });
}

/* Measurement proxy: the browser asks this server, this server asks RoofQC
   Measure (Twin Bridge Central's tri-engine endpoint) with the service key
   from Railway env - the key never reaches the page. */
async function proxyMeasure(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const lat = q.get('lat'), lon = q.get('lon');
  const base = process.env.TBC_MEASURE_URL;
  const key = process.env.MEASURE_SERVICE_KEY;
  if (!base || !key || !lat || !lon) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":false,"why":"unconfigured"}');
    return;
  }
  try {
    const r = await fetch(base + '?lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lon) + '&format=json&k=' + encodeURIComponent(key), { signal: AbortSignal.timeout(45000) });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json();
    const pitchTop = j.areasPerPitch && j.areasPerPitch[0] ? j.areasPerPitch[0].pitch : null;
    const out = {
      ok: true,
      totalSqft: j.totalAreaSqft || 0,
      footprintSqft: j.footprintSqft || 0,
      eaveFt: (j.segmentsFt && j.segmentsFt.eave) || 0,
      perimeterFt: j.perimeterFt || 0,
      pitch: pitchTop,
      facets: j.facetCount || 0,
      source: j.source || '',
      maskRisk: j.maskRisk || '',
      imageryDate: j.imageryYear || ''
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out));
  } catch (e) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":false,"why":"upstream"}');
  }
}

http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (req.method === 'POST' && p === '/api/lead') { relayLead(req, res); return; }
  if (req.method === 'GET' && p === '/api/measure') { proxyMeasure(req, res); return; }
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
