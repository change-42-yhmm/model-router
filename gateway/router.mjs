import fs from 'node:fs/promises';

const DEFAULT_OUTPUT = { fast: 700, balanced: 1800, deep: 4000 };
const HIGH_RISK = new Set(['publish', 'delete', 'permission', 'security']);
const TIER_ORDER = ['fast', 'balanced', 'deep'];
const PREFERENCES = new Set(['auto', 'speed', 'quality']);

export function visibleTokenProxy(value = '') {
  // Deliberately excludes hidden reasoning. This is only an API-equivalent proxy.
  return Math.ceil(String(value).trim().length / 4);
}

export function decomposeTask(task, provided = []) {
  if (provided.length) return provided.map((step, index) => normalizeStep(step, index));
  const deep = /math|algorithm|architecture|concurren|race|security|migration|数学|算法|架构|并发|竞态|安全|迁移/i.test(task);
  return [
    normalizeStep({ title: 'Inspect relevant files and constraints', tier: 'tool', validation: 'Identify bounded inputs and existing checks.' }, 0),
    normalizeStep({ title: task, tier: deep ? 'deep' : 'balanced', risk: deep ? 'high' : 'medium', validation: 'Run the targeted tests or review checklist.' }, 1),
    normalizeStep({ title: 'Verify the result and summarize reusable findings', tier: 'tool', validation: 'Run targeted validation and record the outcome.' }, 2)
  ];
}

export function normalizeStep(step, index) {
  const tier = ['tool', 'fast', 'balanced', 'deep'].includes(step.tier) ? step.tier : 'balanced';
  return { id: step.id || `step-${index + 1}`, title: step.title || `Step ${index + 1}`, tier, risk: step.risk || (tier === 'deep' ? 'high' : 'low'), contextTokens: Number(step.contextTokens || 0), input: step.input || '', validation: step.validation || 'Define a targeted test, static check, or review rubric.', sideEffects: Array.isArray(step.sideEffects) ? step.sideEffects : [], selectionEvidence: step.selectionEvidence || null };
}

function preferredTier(step, preference) {
  if (step.tier === 'tool' || preference === 'auto') return { tier: step.tier, applied: false };
  const index = TIER_ORDER.indexOf(step.tier);
  if (preference === 'speed' && step.risk === 'low' && index > 0) return { tier: TIER_ORDER[index - 1], applied: true };
  if (preference === 'quality' && step.risk !== 'high' && index === 0) return { tier: 'balanced', applied: true };
  return { tier: step.tier, applied: false };
}

function estimate(model, step) {
  const input = Math.max(step.contextTokens || 2000, 1);
  const output = DEFAULT_OUTPUT[step.tier] || 1000;
  return ((input * Number(model.inputPerMillion || 0)) + (output * Number(model.outputPerMillion || 0))) / 1_000_000;
}

function allowed(model, step, auth, spent) {
  if (!model.tiers?.includes(step.tier)) return false;
  if (step.contextTokens && model.contextTokens && step.contextTokens > model.contextTokens) return false;
  if (auth.providers?.length && !auth.providers.includes(model.provider)) return false;
  if (auth.models?.length && !auth.models.includes(model.id)) return false;
  const cost = estimate(model, step);
  return !(auth.maxStepCost != null && cost > auth.maxStepCost) && !(auth.maxProjectCost != null && spent + cost > auth.maxProjectCost);
}

function approvalNeeded(step, auth) {
  const explicit = new Set(auth.approvedStepIds || []);
  return step.sideEffects.some(value => HIGH_RISK.has(value)) ? !explicit.has(step.id) : auth.mode === 'per_step' && !explicit.has(step.id);
}

function evidenceFreshness(model, policy, snapshot) {
  const preflight = policy.modelSelectionEvidence?.preflightRefresh;
  if (!preflight?.enabled) return { complete: true, reason: null };
  if (!snapshot) return { complete: false, reason: 'missing_preflight_evidence' };
  if (snapshot.catalogReviewRequired) return { complete: false, reason: 'model_catalog_review_required' };
  const maxAgeMs = (preflight.maxAgeHours ?? 24) * 60 * 60 * 1000;
  if (!snapshot.generatedAt || Date.now() - Date.parse(snapshot.generatedAt) > maxAgeMs) return { complete: false, reason: 'preflight_evidence_stale' };
  const providerSource = (snapshot.sources || []).find(source => source.provider === model.provider && source.kind === 'official');
  if (!providerSource?.ok) return { complete: false, reason: 'official_source_unavailable' };
  const snapshotAgeMs = (policy.modelSelectionEvidence?.maxPriceSnapshotAgeDays ?? 30) * 24 * 60 * 60 * 1000;
  const priceAt = Date.parse(model.priceSnapshotAt || '');
  const capabilityAt = Date.parse(model.capabilitySnapshotAt || model.priceSnapshotAt || '');
  if (!Number.isFinite(priceAt) || !Number.isFinite(capabilityAt) || Date.now() - priceAt > snapshotAgeMs || Date.now() - capabilityAt > snapshotAgeMs) return { complete: false, reason: 'model_price_or_capability_snapshot_stale' };
  return { complete: true, reason: null };
}

export function routePlan({ task, steps, models, authorization = {}, spent = 0, routingPolicy = {}, preference, evidenceSnapshot }) {
  const auth = { mode: 'per_step', ...authorization };
  const selectedPreference = preference ?? routingPolicy.defaultPreference ?? 'auto';
  if (!['per_step', 'budget_auto', 'full_auto'].includes(auth.mode)) throw new Error('Authorization mode must be per_step, budget_auto, or full_auto.');
  if (!PREFERENCES.has(selectedPreference)) throw new Error('Preference must be auto, speed, or quality.');
  if (auth.expiresAt && Date.parse(auth.expiresAt) <= Date.now()) throw new Error('Authorization has expired.');
  let projected = spent;
  return decomposeTask(task, steps).map(originalStep => {
    const tierChoice = preferredTier(originalStep, selectedPreference);
    const step = tierChoice.applied ? { ...originalStep, tier: tierChoice.tier } : originalStep;
    const contextGuidance = routingPolicy.incrementalContext?.enabled
      ? { mode: 'incremental', preferredSources: routingPolicy.incrementalContext.prefer || [], wholeRepositoryByDefault: false }
      : undefined;
    if (step.tier === 'tool') return { ...step, decision: 'tool', rationale: 'A deterministic tool can produce verifiable evidence without model-token cost.', contextGuidance };
    if (step.sideEffects.some(value => (auth.blockedActions || []).includes(value))) return { ...step, decision: 'blocked', reason: 'This step contains an action prohibited by the current authorization.' };
    const candidate = models.filter(model => allowed(model, step, auth, projected)).sort((a, b) => estimate(a, step) - estimate(b, step))[0];
    if (!candidate) return { ...step, decision: 'blocked', reason: 'No authorized model satisfies this step’s tier, context, and budget constraints.' };
    const estimatedCost = estimate(candidate, step); projected += estimatedCost;
    const evidenceRequired = Boolean(routingPolicy.modelSelectionEvidence?.requiredForAutomaticRouting?.length);
    const selectionEvidenceComplete = !evidenceRequired || Boolean(step.selectionEvidence?.official && step.selectionEvidence?.taskRelevant && step.selectionEvidence?.project && step.selectionEvidence?.costEstimate && step.selectionEvidence?.latencyExpectation && step.selectionEvidence?.capabilityChecks);
    const freshness = evidenceFreshness(candidate, routingPolicy, evidenceSnapshot);
    const evidenceComplete = selectionEvidenceComplete && freshness.complete;
    return {
      ...step, decision: !evidenceComplete || approvalNeeded(step, auth) ? 'awaiting_approval' : 'authorized', contextGuidance,
      requestedTier: originalStep.tier,
      preference: selectedPreference,
      preferenceApplied: tierChoice.applied,
      preferenceNote: selectedPreference === 'auto' ? 'Automatic routing selected the tier from task capability, risk, and validation needs.' : tierChoice.applied ? `The ${selectedPreference} preference adjusted the candidate tier within the task’s safe capability envelope.` : `The ${selectedPreference} preference was retained, but task capability, risk, or validation requirements prevented a tier change.`,
      model: { id: candidate.id, provider: candidate.provider, model: candidate.model, type: candidate.type, reasoningEffort: candidate.reasoningEffort }, estimatedCost,
      advantage: step.tier === 'deep' ? 'This step needs deeper causal reasoning across ambiguous or high-risk constraints, increasing the chance of a testable first-pass hypothesis.' : step.tier === 'balanced' ? 'This model tier balances implementation quality with cost for a bounded, verifiable change.' : 'The task is explicit and bounded, so a fast model reduces cost and latency while validation protects quality.',
      tradeoff: `Estimated cost is ${estimatedCost.toFixed(4)} in configured currency units; higher tiers may increase latency and output tokens.`,
      riskIfNotEscalated: step.tier === 'deep' ? 'A lower tier may require more retries or miss cross-module reasoning.' : 'Use targeted validation to detect an insufficient result.',
      escalationRule: routingPolicy.escalateOnlyAfterValidationFailure ? 'Escalate only after targeted validation fails or evidence remains insufficient.' : undefined,
      evidenceStatus: evidenceComplete ? 'complete' : freshness.complete ? 'missing_selection_evidence' : freshness.reason,
      validation: step.validation
    };
  });
}

export async function appendTelemetry(file, event) {
  if (!file) return;
  const safe = {
    at: new Date().toISOString(), schemaVersion: '1.0', source: event.source || 'actual_gateway',
    runId: event.runId, scenarioId: event.scenarioId, strategyId: event.strategyId, attempt: event.attempt,
    stepId: event.stepId, modelId: event.modelId, modelVersion: event.modelVersion, provider: event.provider,
    tier: event.tier, reasoningEffort: event.reasoningEffort, status: event.status, usage: event.usage,
    visibleInputTokenProxy: event.visibleInputTokenProxy, visibleOutputTokenProxy: event.visibleOutputTokenProxy,
    apiEquivalentCostUsd: event.apiEquivalentCostUsd, latencyMs: event.latencyMs,
    switchFrom: event.switchFrom, switchOverheadMs: event.switchOverheadMs,
    contextTransferTokens: event.contextTransferTokens, approvalWaitMs: event.approvalWaitMs,
    validation: event.validation, failureReason: event.failureReason
  };
  await fs.appendFile(file, `${JSON.stringify(safe)}\n`, 'utf8');
}
