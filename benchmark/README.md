# Model Router Benchmark Harness

This dependency-free harness defines eight frozen Node.js development scenarios and
produces deterministic, auditable benchmark records. It is deliberately a **simulator**:
its output is useful for exercising routing, aggregation, reporting, and dashboard data
flows, but cannot be used as evidence that a model or router improved real projects.

## Commands

```powershell
node simulate.mjs --out runs.simulated.v1.json
node aggregate.mjs --input runs.simulated.v1.json --out summary.simulated.v1.json
node report.mjs --input summary.simulated.v1.json
node test.mjs
```

`runs.*.json` is ignored by neither this harness nor git on purpose: keep only reviewed,
non-sensitive runs. The schema prohibits source code, prompts, and API keys.

## Data provenance

- `actual`: observed wall-clock and verification data from a real run. API cost may still
  be an `api_equivalent_estimate` when provider invoices are unavailable.
- `api_equivalent_estimate`: a reproducible estimate based on visible token counts and the
  versioned local price card. It excludes hidden reasoning tokens and is not an invoice.
- `simulated`: deterministic fixture data. It must never be presented as model performance.

Open-source-inspired scenarios are original fixtures named after common bug shapes; no
external repository source is included or fetched.
