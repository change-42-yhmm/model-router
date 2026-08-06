import fs from 'node:fs/promises';
import { refreshEvidence } from '../gateway/evidence.mjs';

const [configPath = 'model-router.config.json', outputPath = 'dashboard/evidence.json'] = process.argv.slice(2);
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const result = await refreshEvidence({ sources: config.evidenceSources || [], outputPath, catalogRevision: config.routingPolicy?.modelCatalogRevision });
console.log(JSON.stringify(result, null, 2));
