import assert from 'node:assert/strict';
import { routePlan, visibleTokenProxy } from '../gateway/router.mjs';

const models = [
  { id: 'fast', provider: 'p', model: 'fast', type: 'openai-compatible', tiers: ['fast'], contextTokens: 10000, inputPerMillion: 1, outputPerMillion: 1 },
  { id: 'balanced', provider: 'p', model: 'balanced', type: 'openai-compatible', tiers: ['balanced'], contextTokens: 50000, inputPerMillion: 1.5, outputPerMillion: 2 },
  { id: 'deep', provider: 'p', model: 'deep', type: 'openai-compatible', tiers: ['deep'], contextTokens: 100000, inputPerMillion: 2, outputPerMillion: 4 }
];
const base = { task: 'Investigate an algorithm bug', models, authorization: { mode: 'budget_auto', providers: ['p'], models: ['fast', 'balanced', 'deep'], maxStepCost: 1, maxProjectCost: 2 } };
const plan = routePlan(base);
assert.equal(plan[0].decision, 'tool'); assert.equal(plan[1].decision, 'authorized'); assert.equal(plan[1].model.id, 'deep'); assert.match(plan[1].advantage, /causal reasoning/);
const pending = routePlan({ ...base, authorization: { ...base.authorization, mode: 'per_step' } });
assert.equal(pending[1].decision, 'awaiting_approval');
const approved = routePlan({ ...base, authorization: { ...base.authorization, mode: 'per_step', approvedStepIds: ['step-2'] } });
assert.equal(approved[1].decision, 'authorized');
const incremental = routePlan({ ...base, routingPolicy: { escalateOnlyAfterValidationFailure: true, incrementalContext: { enabled: true, prefer: ['changed-file-summaries'] } } });
assert.equal(incremental[1].contextGuidance.mode, 'incremental');
assert.match(incremental[1].escalationRule, /Escalate only/);
const evidencePolicy = { modelSelectionEvidence: { requiredForAutomaticRouting: ['official-capabilities-and-pricing'] } };
const missingEvidence = routePlan({ ...base, routingPolicy: evidencePolicy });
assert.equal(missingEvidence[1].decision, 'awaiting_approval');
const evidenced = routePlan({ ...base, routingPolicy: evidencePolicy, steps: [{ title: 'Bounded change', tier: 'fast', selectionEvidence: { official: 'snapshot', taskRelevant: 'coding evaluation', project: 'targeted test', costEstimate: 'configured pricing', latencyExpectation: 'P50 telemetry', capabilityChecks: 'JSON mode' } }] });
assert.equal(evidenced[0].decision, 'authorized');
const blocked = routePlan({ ...base, steps: [{ title: 'Publish', tier: 'fast', sideEffects: ['publish'] }] });
assert.equal(blocked[0].decision, 'awaiting_approval');
const prohibited = routePlan({ ...base, steps: [{ title: 'Delete data', tier: 'fast', sideEffects: ['delete'] }], authorization: { ...base.authorization, blockedActions: ['delete'] } });
assert.equal(prohibited[0].decision, 'blocked');
const speed = routePlan({ ...base, preference: 'speed', steps: [{ title: 'Bounded formatting change', tier: 'balanced', risk: 'low' }] });
assert.equal(speed[0].tier, 'fast'); assert.equal(speed[0].preferenceApplied, true);
const quality = routePlan({ ...base, preference: 'quality', steps: [{ title: 'Draft a small change', tier: 'fast', risk: 'low' }, { title: 'Security review', tier: 'deep', risk: 'high' }] });
assert.equal(quality[0].tier, 'balanced'); assert.equal(quality[0].preferenceApplied, true);
assert.equal(quality[1].tier, 'deep'); assert.equal(quality[1].preferenceApplied, false);
assert.throws(() => routePlan({ ...base, preference: 'cheapest' }), /Preference must be/);
const preflightPolicy = { modelSelectionEvidence: { preflightRefresh: { enabled: true, maxAgeHours: 24 }, maxPriceSnapshotAgeDays: 30 } };
const freshEvidence = { generatedAt: new Date().toISOString(), catalogReviewRequired: false, sources: [{ provider: 'p', kind: 'official', ok: true }] };
const freshModels = models.map(model => ({ ...model, priceSnapshotAt: new Date().toISOString(), capabilitySnapshotAt: new Date().toISOString() }));
const preflightApproved = routePlan({ ...base, models: freshModels, routingPolicy: preflightPolicy, evidenceSnapshot: freshEvidence });
assert.equal(preflightApproved[1].decision, 'authorized');
const reviewRequired = routePlan({ ...base, models: freshModels, routingPolicy: preflightPolicy, evidenceSnapshot: { ...freshEvidence, catalogReviewRequired: true } });
assert.equal(reviewRequired[1].decision, 'awaiting_approval'); assert.equal(reviewRequired[1].evidenceStatus, 'model_catalog_review_required');
assert.equal(visibleTokenProxy('12345678'), 2);
console.log('router tests passed');
