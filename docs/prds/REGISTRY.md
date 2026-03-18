# FSA Claim Automation — PRD Registry

Tracks status of all product requirements documents.

## Status Legend

| Status | Meaning |
|--------|---------|
| `draft` | Written but not yet reviewed |
| `in-review` | Under team/stakeholder review |
| `approved` | Approved, queued for implementation |
| `in-progress` | Implementation actively underway |
| `done` | Shipped and validated |
| `deferred` | Postponed, not in current roadmap |
| `cancelled` | Will not implement |

---

## Roadmap

| ID | Title | Status | Priority | Effort | Depends On |
|----|-------|--------|----------|--------|------------|
| [PRD-001](./PRD-001.md) | Amazon Order Scanner | `draft` | P0 | L | — |
| [PRD-002](./PRD-002.md) | Invoice Capture & Management | `draft` | P0 | M | PRD-001 |
| [PRD-003](./PRD-003.md) | Navia Benefits Form Auto-Fill | `draft` | P0 | L | PRD-001, PRD-002 |
| [PRD-004](./PRD-004.md) | Smart Eligibility Engine v2 | `draft` | P1 | M | PRD-001 |
| [PRD-005](./PRD-005.md) | FSA Budget Dashboard & Year-End Alerts | `draft` | P1 | M | PRD-003 |
| [PRD-006](./PRD-006.md) | Claim History & Status Monitor | `draft` | P1 | M | PRD-003 |
| [PRD-007](./PRD-007.md) | Multi-Provider Support | `draft` | P2 | XL | PRD-003 |
| [PRD-008](./PRD-008.md) | Multi-Retailer Support | `draft` | P2 | XL | PRD-001, PRD-002 |
| [PRD-009](./PRD-009.md) | Onboarding & Guided Setup Wizard | `draft` | P1 | S | PRD-001, PRD-003 |
| [PRD-010](./PRD-010.md) | Export, Reporting & Tax Documentation | `draft` | P2 | M | PRD-006 |

## Effort Scale

| Label | Meaning |
|-------|---------|
| S | Small — 1–2 days |
| M | Medium — 3–5 days |
| L | Large — 1–2 weeks |
| XL | Extra Large — 2–4 weeks |

## Priority Scale

- **P0** — MVP blockers. Extension is not shippable without these.
- **P1** — High value, directly drives paid conversions and retention.
- **P2** — Market expansion and power-user features. Important for growth.

---

_Last updated: 2026-03-18_
