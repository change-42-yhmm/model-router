import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendTelemetry, routePlan, visibleTokenProxy } from './router.mjs';
import { runModel } from './providers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const flag = process.argv.indexOf('--config');
const configPath = flag >= 0 ? process.argv[flag + 1] : path.join(here, '..', 'model-router.config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const modelById = new Map(config.models.map(model => [model.id, model]));
function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); }
async function read(req) { let body = ''; for await (const chunk of req) body += chunk; return body ? JSON.parse(body) : {}; }

http.createServer(async (req, res) => {
  if (req.method !== 'POST' || !['/v1/route', '/v1/route-and-run'].includes(req.url)) return send(res, 404, { error: 'POST /v1/route or /v1/route-and-run only' });
  try {
    const request = await read(req), plan = routePlan({ ...request, models: config.models, routingPolicy: config.routingPolicy });
    if (req.url === '/v1/route') return send(res, 200, { plan });
    const step = plan.find(item => item.decision === 'authorized');
    if (!step) return send(res, 409, { plan, error: 'No executable authorized model step. Approve a step or adjust constraints.' });
    const model = modelById.get(step.model.id), result = await runModel(model, step), benchmark = request.benchmark || {};
    await appendTelemetry(config.telemetryFile, {
      source: 'actual_gateway', runId: benchmark.runId, scenarioId: benchmark.scenarioId,
      strategyId: benchmark.strategyId, attempt: benchmark.attempt, stepId: step.id, modelId: model.id,
      modelVersion: model.model, provider: model.provider, tier: step.tier, reasoningEffort: model.reasoningEffort,
      status: 'completed', usage: result.usage, visibleInputTokenProxy: visibleTokenProxy(step.input || step.title),
      visibleOutputTokenProxy: visibleTokenProxy(result.output), apiEquivalentCostUsd: step.estimatedCost,
      latencyMs: result.latencyMs, switchFrom: benchmark.switchFrom, switchOverheadMs: benchmark.switchOverheadMs,
      contextTransferTokens: benchmark.contextTransferTokens, approvalWaitMs: benchmark.approvalWaitMs,
      validation: benchmark.validation || { required: step.validation }
    });
    send(res, 200, { plan, executed: { stepId: step.id, model: step.model, output: result.output, usage: result.usage, latencyMs: result.latencyMs, validation: step.validation } });
  } catch (error) { send(res, 400, { error: error.message }); }
}).listen(config.port || 8787, () => console.log(`Model Router listening on http://127.0.0.1:${config.port || 8787}`));
