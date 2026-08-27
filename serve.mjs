#!/usr/bin/env node
// Dev server for the static site. Production = any static file host.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8788);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.typ': 'text/plain; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm',
};

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(HERE, p === '/' ? 'index.html' : path.normalize(p).replace(/^([/\\])+/, ''));
  if (!file.startsWith(HERE) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream',
                       'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`static site on http://localhost:${PORT}`));
