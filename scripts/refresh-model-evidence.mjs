import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const [configPath = 'model-router.config.json', outputPath = 'dashboard/evidence.json'] = process.argv.slice(2);
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const sources = config.evidenceSources || [];
const snapshots = await Promise.all(sources.map(async source => {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(source.url, { headers: { 'User-Agent': 'model-router-evidence/1.0' } });
    const text = await response.text();
    const title = text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
    return { ...source, fetchedAt, status: response.status, ok: response.ok, title, contentType: response.headers.get('content-type'), sha256: crypto.createHash('sha256').update(text).digest('hex'), bytes: Buffer.byteLength(text) };
  } catch (error) { return { ...source, fetchedAt, ok: false, error: error.message }; }
}));
const result = { schemaVersion: '1.0', generatedAt: new Date().toISOString(), sources: snapshots, note: 'Raw source checks establish freshness and provenance. Provider-specific parsers or local evaluations may add normalized prices, capabilities, latency, and benchmark fields without changing the six-dimension schema.' };
await fs.mkdir(path.dirname(outputPath) === '.' ? '.' : path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
