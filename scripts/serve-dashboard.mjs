import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dashboard = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard');
const port = Number(process.argv[2] || 8765);
const types = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const target = path.resolve(dashboard, pathname === '/' ? 'index.html' : `.${pathname}`);
  if (!target.startsWith(dashboard)) { res.writeHead(403).end('Forbidden'); return; }
  try { const body = await fs.readFile(target); res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body); }
  catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Dashboard: http://127.0.0.1:${port}/#decisions`));
