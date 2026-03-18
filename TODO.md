# FSA Claim Automation - TODO

## Current Sprint: Phase 0 - Project Scaffolding

### Setup
- [x] Create CLAUDE.md
- [x] Create TODO.md
- [x] Create docs structure (PRD, TDD, DESIGN, API, SECURITY)
- [x] Create extension package.json
- [x] Create manifest.json (MV3)
- [x] Create tsconfig.json
- [x] Create vite.config.ts with @crxjs/vite-plugin
- [x] Create .eslintrc, .prettierrc, .gitignore
- [x] Create all TypeScript types in src/types/
- [x] Create eligibility constants
- [x] Create lib utilities (storage, messaging, benefit-year, eligibility, screenshot)
- [x] Create service worker skeleton
- [x] Create popup skeleton (React)
- [x] Create content script skeletons (Amazon + Navia)
- [ ] Run `npm install` and verify build works
- [ ] Load extension in Chrome and verify it loads

## Phase 1: Static Eligibility Engine
- [ ] Populate FSA eligible keyword list (src/constants/eligibility-list.ts)
- [ ] Implement eligibility.ts pure function
- [ ] Implement benefit-year.ts
- [ ] Write unit tests for eligibility and benefit-year
- [ ] Run tests: `npm test`

## Phase 2: Amazon Order Scanner
- [ ] Inspect Amazon orders page DOM - document selectors
- [ ] Implement order-scanner.ts content script
  - [ ] Parse order cards from DOM
  - [ ] Filter by benefit year date range
  - [ ] Handle pagination (multiple pages)
  - [ ] Map DOM nodes to AmazonOrder[] type
- [ ] Wire up service worker SCAN_ORDERS_REQUEST handler
- [ ] Build popup "Start Scan" step + order list display
- [ ] Test: scan real Amazon orders page

## Phase 3: Invoice Capture
- [ ] Add html2canvas dependency
- [ ] Implement invoice-capture.ts content script
  - [ ] Navigate to order detail page
  - [ ] Capture order summary section as canvas
  - [ ] Export as base64 PNG / JPEG
- [ ] Store invoices in chrome.storage.local under `invoice:{orderId}`
- [ ] Show invoice thumbnails in popup InvoicePreview component
- [ ] Test: capture invoices for scanned orders

## Phase 4: Navia Form Auto-Fill
- [ ] Inspect Navia Benefits portal claim form DOM
- [ ] Document Navia form selectors in navia-selectors.ts
- [ ] Implement form-filler.ts content script
  - [ ] Fill text fields (date, amount, description, expense type)
  - [ ] Handle React/Angular synthetic event triggers
  - [ ] Attach invoice file via DataTransfer API
- [ ] Implement form-observer.ts for SPA navigation detection
- [ ] Build popup claim review UI (ClaimReview, ClaimCard components)
- [ ] Add per-claim confirm/skip buttons
- [ ] Test: auto-fill Navia claim form with sample data

## Phase 5: Polish & MVP Complete
- [ ] Full wizard UI with step indicator
- [ ] Error handling and retry logic
- [ ] Storage cleanup for old benefit year data
- [ ] Manual eligibility override UI (toggle items)
- [ ] Finalize all docs
- [ ] End-to-end test: Amazon scan → invoice capture → Navia submission
- [ ] Production build and Chrome Web Store prep

## Current Sprint: PRD-011 — Invoice-First FSA Detection

**Goal**: Use Amazon's native "FSA or HSA eligible: $X.XX" label on invoice pages as the primary eligibility signal. Scan every benefit-year order's invoice automatically, capture screenshots in the same visit, and remove the separate "Capture Invoices" step.

### Phase 1 — Types & Messages ✅
- [x] `types/order.ts`: Add `invoiceScanStatus`, `fsaEligibleAmount`, `eligibilitySource` to `AmazonOrder`
- [x] `types/state.ts`: Add `"scanning_invoices"` to `WorkflowStep`; add `invoiceScanProgress` to `AppState`
- [x] `types/messages.ts`: Add `INVOICE_SCAN_RESULT` and `INVOICE_SCAN_ERROR` to `AmazonToSWMessage`

### Phase 2 — Selectors & Label Extraction ✅
- [x] `constants/selectors.ts`: Add `fsaLabelText` to `orderDetail`
- [x] `content-scripts/amazon/fsa-label.ts`: `extractFsaEligibleAmount()` + `parseDollarAmountToCents()` as pure testable module
- [x] `invoice-capture.ts`: Handle `scanning_invoices` step — extract amount + capture screenshot + send `INVOICE_SCAN_RESULT`

### Phase 3 — Order History Scan Changes ✅
- [x] `content-scripts/amazon/order-scanner.ts`: Remove `eligibleItems.length === 0` guard — emit ALL orders in benefit year
- [x] Keep `filterEligibleItems` call for metadata, but do not gate order inclusion on its result

### Phase 4 — Service Worker ✅
- [x] `service-worker/index.ts`: On `SCAN_ORDERS_RESULT` (hasNextPage=false) → transition to `scanning_invoices`, kick off first invoice navigation
- [x] Handle `INVOICE_SCAN_RESULT`: update order status, save invoice if label found, advance to next pending
- [x] Handle `INVOICE_SCAN_ERROR`: mark order as `no_label`, advance to next
- [x] After all orders scanned → transition to `reviewing_orders`
- [x] `buildClaimsFromOrders`: use `fsaEligibleAmount` when set, else fall back to `totalAmount`
- [x] Update `invoiceScanProgress` in state after each invoice
- [x] `SELECT_ORDERS`: detect new flow, build claims + go to `navigate_navia` directly (skip legacy capturing_invoices)

### Phase 5 — Popup UI ✅
- [x] Add `scanning_invoices` step to workflow progress indicator (StepIndicator.tsx)
- [x] Show progress bar: "Scanning invoices: N / M..."
- [x] `OrderCard.tsx`: show `fsaEligibleAmount` (not `totalAmount`) when available; strikethrough original total
- [x] `OrderCard.tsx`: show `invoiceScanStatus` badge ("Amazon FSA ✓" / "No FSA label" / "Pending scan")
- [x] Remove "Capture Invoices" button — replaced with "Proceed to Submit"
- [x] Review step header shows "N FSA-confirmed / M orders"

### Phase 6 — Tests & Validation ✅
- [x] Unit tests: `extractFsaEligibleAmount()` — 10 cases including all 4 extraction strategies
- [x] Unit tests: `parseDollarAmountToCents()` — 7 cases covering edge cases
- [x] Build passes: `npm run build` — 53 tests pass
- [ ] End-to-end: run full flow in Chrome — history scan → invoice scan → review → Navia submit
- [ ] Verify FSA amount on claim matches Amazon's label amount

## Backlog
- [ ] Support multiple FSA providers beyond Navia
- [ ] Support additional retailers beyond Amazon
- [ ] ASIN-based allowlist for known FSA eligible products
- [ ] Reminder alarms for approaching FSA deadline
- [ ] Export claims to CSV/PDF
- [ ] Settings page (benefit year override, provider selection)

---

## PRD Roadmap

Detailed feature PRDs live in [`docs/prds/`](./docs/prds/):

| ID | Feature | Status | Priority |
|----|---------|--------|----------|
| [PRD-001](docs/prds/PRD-001.md) | Amazon Order Scanner | `draft` | P0 |
| [PRD-002](docs/prds/PRD-002.md) | Invoice Capture & Management | `draft` | P0 |
| [PRD-003](docs/prds/PRD-003.md) | Navia Benefits Form Auto-Fill | `draft` | P0 |
| [PRD-004](docs/prds/PRD-004.md) | Smart Eligibility Engine v2 | `draft` | P1 |
| [PRD-005](docs/prds/PRD-005.md) | FSA Budget Dashboard & Year-End Alerts | `draft` | P1 |
| [PRD-006](docs/prds/PRD-006.md) | Claim History & Status Monitor | `draft` | P1 |
| [PRD-007](docs/prds/PRD-007.md) | Multi-Provider Support | `draft` | P2 |
| [PRD-008](docs/prds/PRD-008.md) | Multi-Retailer Support | `draft` | P2 |
| [PRD-009](docs/prds/PRD-009.md) | Onboarding & Guided Setup Wizard | `draft` | P1 |
| [PRD-010](docs/prds/PRD-010.md) | Export, Reporting & Tax Documentation | `draft` | P2 |

See [`docs/prds/REGISTRY.md`](docs/prds/REGISTRY.md) for full status tracking.
