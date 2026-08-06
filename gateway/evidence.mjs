import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function refreshEvidence({ sources = [], outputPath, catalogRevision = 'unversioned' }) {
  let previous = null;
  try { previous = JSON.parse(await fs.readFile(outputPath, 'utf8')); } catch { /* First refresh has no baseline. */ }
  const snapshots = await Promise.all(sources.map(async source => {
    const fetchedAt = new Date().toISOString();
    try {
      const response = await fetch(source.url, { headers: { 'User-Agent': 'model-router-evidence/1.1' } });
      const text = await response.text();
      const title = text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
      return { ...source, fetchedAt, status: response.status, ok: response.ok, title, contentType: response.headers.get('content-type'), sha256: crypto.createHash('sha256').update(text).digest('hex'), bytes: Buffer.byteLength(text) };
    } catch (error) { return { ...source, fetchedAt, ok: false, error: error.message }; }
  }));
  const oldById = new Map((previous?.sources || []).map(source => [source.id, source]));
  const changedSourceIds = snapshots.filter(source => oldById.get(source.id)?.sha256 && oldById.get(source.id).sha256 !== source.sha256).map(source => source.id);
  const revisionChanged = previous?.catalogRevision && previous.catalogRevision !== catalogRevision;
  const result = {
    schemaVersion: '1.1', generatedAt: new Date().toISOString(), catalogRevision, sources: snapshots,
    changedSourceIds, catalogReviewRequired: revisionChanged ? false : Boolean(previous?.catalogReviewRequired || changedSourceIds.length),
    note: 'Automatic routing requires fresh successful official sources, fresh model snapshots, and no unresolved source-content change. Update normalized model prices/capabilities and bump routingPolicy.modelCatalogRevision after review.'
  };
  await fs.mkdir(path.dirname(outputPath) === '.' ? '.' : path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
