# Changelog

## v0.2.0 — 2026-08-06

### Added

- Preflight evidence refresh for CLI plans and the local gateway.
- Freshness checks for official sources, price snapshots, capability snapshots, and unresolved source-content changes.
- A durable `model_catalog_review_required` gate: automatic execution becomes `awaiting_approval` until the normalized catalog is reviewed and its revision is incremented.

### Updated

- GPT-5.6 Luna and Terra prices in the example model catalog reflect OpenAI's 2026-07-30 announcement.
- Documentation now describes the safe refresh and catalog-review workflow.
