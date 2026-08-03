import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routePlan } from '../gateway/router.mjs';

const [inputPath, configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'model-router.config.example.json')] = process.argv.slice(2);
if (!inputPath) throw new Error('Usage: node scripts/route-plan.mjs request.json [config.json]');
const [input, config] = await Promise.all([fs.readFile(inputPath, 'utf8').then(JSON.parse), fs.readFile(configPath, 'utf8').then(JSON.parse)]);
console.log(JSON.stringify({ plan: routePlan({ ...input, models: config.models, routingPolicy: config.routingPolicy }) }, null, 2));
