# Technical Design Document - FSA Claim Automation

**Status**: Draft
**Last Updated**: 2026-03-17
**Version**: 0.1.0

---

## Architecture Overview

A Chrome Extension (Manifest V3) with three components:

```
┌─────────────────────────────────────────────────────────┐
│  Chrome Extension                                        │
│                                                          │
│  ┌──────────────┐     messages     ┌──────────────────┐ │
│  │ Popup (React) │ ◄──────────────► │ Service Worker   │ │
│  │              │                  │ (message router) │ │
│  └──────────────┘                  └────────┬─────────┘ │
│                                             │            │
│                              ┌──────────────▼──────────┐│
│                              │  chrome.storage.local   ││
│                              │  (AppState + invoices)  ││
│                              └──────────────▲──────────┘│
│                                             │            │
│                              ┌──────────────┴──────────┐│
│                              │  Content Scripts        ││
│                              │  - amazon/index.ts      ││
│                              │  - navia/index.ts       ││
│                              └─────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Extension type | Chrome MV3 | Current standard, required for Chrome Web Store |
| Language | TypeScript (strict) | Catches null errors common in DOM scraping |
| UI Framework | React 18 | Step-based wizard UI benefits from React state |
| Build tool | Vite + @crxjs/vite-plugin | Fast builds, manifest-driven entry points |
| Styling | Tailwind CSS | Utility-first, small bundle for popup |
| Testing | Vitest | Shares Vite config, no extra setup |
| Invoice capture | html2canvas | Targets specific DOM subtree, no extra permissions |
| Linting | ESLint (typescript-eslint) + Prettier | Standard TS quality tooling |

---

## Data Models

### AppState
Persisted in `chrome.storage.local` under key `"appState"`.

```typescript
type WorkflowStep =
  | "idle"
  | "navigate_amazon"
  | "scanning_amazon"
  | "reviewing_orders"
  | "capturing_invoices"
  | "navigate_navia"
  | "submitting_claims"
  | "complete";

type AppState = {
  currentStep: WorkflowStep;
  benefitYear: BenefitYear;
  orders: AmazonOrder[];
  selectedOrderIds: string[];
  claims: Claim[];
  lastError?: string;
  lastScanAt?: Date;
};
```

### AmazonOrder
```typescript
type AmazonOrder = {
  orderId: string;           // e.g. "113-1234567-8901234"
  orderDate: Date;
  totalAmount: number;       // cents
  items: OrderItem[];
  eligibleItems: OrderItem[];
  invoiceStatus: "pending" | "captured" | "failed";
  invoiceDataUrl?: string;   // base64 PNG
  orderDetailUrl: string;
};

type OrderItem = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number;         // cents
  totalPrice: number;        // cents
  category?: string;
  isEligible: boolean;
  eligibilityReason?: string;
};
```

### Claim
```typescript
type Claim = {
  id: string;                // uuid
  sourceOrderId: string;
  items: ClaimItem[];
  totalAmount: number;       // cents
  invoiceDataUrl: string;
  status: "draft" | "reviewing" | "submitting" | "submitted" | "failed";
  errorMessage?: string;
  createdAt: Date;
  submittedAt?: Date;
};

type ClaimItem = {
  description: string;
  serviceDate: Date;
  amount: number;            // cents
  expenseType: string;       // Navia dropdown value
};
```

---

## Chrome Extension Manifest (MV3)

```json
{
  "manifest_version": 3,
  "name": "FSA Claim Automation",
  "version": "0.1.0",
  "permissions": ["storage", "scripting", "tabs", "activeTab"],
  "host_permissions": [
    "https://www.amazon.com/*",
    "https://*.naviabenefits.com/*"
  ],
  "background": {
    "service_worker": "src/service-worker/index.ts",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/index.html"
  },
  "content_scripts": [
    {
      "matches": ["https://www.amazon.com/gp/your-account/order-history*"],
      "js": ["src/content-scripts/amazon/index.ts"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://app.naviabenefits.com/*"],
      "js": ["src/content-scripts/navia/index.ts"],
      "run_at": "document_idle",
      "all_frames": true
    }
  ]
}
```

---

## Message Passing API

See `docs/API.md` for the full message contract.

Key flow:
1. Popup → SW: `SCAN_ORDERS_REQUEST`
2. SW injects content script into Amazon tab
3. Amazon CS → SW: `SCAN_ORDERS_RESULT` | `SCAN_ORDERS_ERROR`
4. SW writes to storage, emits `STATE_UPDATED`
5. Popup listens to `chrome.storage.onChanged`, re-renders

For invoice capture:
1. Popup → SW: `CAPTURE_INVOICES_REQUEST`
2. SW navigates to each order detail URL, triggers capture
3. Amazon CS → SW: `CAPTURE_INVOICE_RESULT` (one per order)
4. SW stores `invoice:{orderId}` in storage

For Navia submission:
1. Popup → SW: `FILL_CLAIM_REQUEST` with Claim object
2. SW passes to Navia tab content script
3. Navia CS fills form, emits `FILL_CLAIM_READY` (waiting for user)
4. User clicks Submit on Navia portal
5. Navia CS detects submission, emits `FILL_CLAIM_SUBMITTED`

---

## Storage Layout

```
chrome.storage.local:
  "appState"         → AppState (serialized, no invoices)
  "invoice:112-xxx"  → string (base64 data URL, ~200-500KB each)
  "invoice:113-xxx"  → string
  ...
```

Invoices stored separately to keep `appState` serialization fast.

---

## Content Script: Amazon Order Scanner

**Target URL**: `https://www.amazon.com/gp/your-account/order-history`

**DOM selectors** (all in `src/constants/selectors.ts`):
- Order cards: `.order`, `.a-box-group`
- Order ID: `.yohtmlc-order-id span:last-child`
- Order date: `.a-col-left .a-color-secondary`
- Order items: `.yohtmlc-item`
- Item title: `.yohtmlc-product-title`
- Item price: `.a-price .a-offscreen`

**Pagination**: Detect "Next" button, send partial results per page.

**Eligibility filtering**: Run each item title through `lib/eligibility.ts`.

---

## Content Script: Navia Form Filler

**Target URL**: `https://app.naviabenefits.com/*` (inspect to confirm)

**Approach**:
1. Detect claim submission form via MutationObserver
2. Read `Claim` data from `chrome.storage.local`
3. Fill form fields using `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)` to trigger React synthetic events
4. Dispatch `input` + `change` events with `{ bubbles: true }`
5. Inject invoice file via `DataTransfer` API into file input
6. Signal popup "ready for review" — do NOT auto-submit

**File injection technique**:
```typescript
const dt = new DataTransfer();
dt.items.add(new File([blob], 'invoice.jpg', { type: 'image/jpeg' }));
fileInput.files = dt.files;
fileInput.dispatchEvent(new Event('change', { bubbles: true }));
```

---

## FSA Eligibility Engine

**Location**: `src/lib/eligibility.ts` + `src/constants/eligibility-list.ts`

**Algorithm**:
1. Lowercase the product title
2. Check against keyword list per FSA category
3. Return `{ isEligible, category, reason }`

**Categories and sample keywords**:
| Category | Sample Keywords |
|----------|----------------|
| otc_medicine | advil, tylenol, ibuprofen, aspirin, antihistamine, allergy, cold medicine |
| first_aid | bandage, gauze, antiseptic, hydrogen peroxide, first aid |
| medical_equipment | blood pressure monitor, thermometer, pulse oximeter, nebulizer |
| vision | contact lens, contact solution, glasses, reading glasses |
| dental | toothbrush (electric), dental floss, whitening strips |
| feminine_hygiene | tampon, pad, menstrual cup, period |
| baby_health | nasal aspirator, baby thermometer |

**Conservative approach**: When in doubt, don't flag as eligible. Manual override available.

---

## Invoice Capture

**Library**: html2canvas v1.x

**Target element**: The order summary div on the order detail page, not the full page.

**Settings**:
```typescript
html2canvas(element, {
  scale: 0.75,        // Reduce from 1x to save storage
  useCORS: true,
  logging: false,
})
.then(canvas => canvas.toDataURL('image/jpeg', 0.85))
```

**Storage**: ~200-400KB per invoice as JPEG base64.

**Fallback**: `chrome.tabs.captureVisibleTab` if html2canvas fails.

---

## Deployment

**Development**: Load unpacked extension from `extension/dist`
**Production**: Manual load or Chrome Web Store (future)
**Backend**: None required for MVP. CloudFlare Workers/Pages available if needed.

---

## External Systems

| System | URL | Purpose |
|--------|-----|---------|
| Amazon Orders | amazon.com/gp/your-account/order-history | Source of purchase data |
| Navia Benefits Portal | app.naviabenefits.com (TBC) | FSA claim submission |

---

## Known Limitations

1. Amazon DOM changes will break selectors - mitigated by centralizing selectors
2. Navia portal structure unknown until manual inspection in Phase 4
3. FSA eligibility via keywords has false positives/negatives - manual override provided
4. Service worker can be terminated - all state checkpointed to storage
5. html2canvas may miss dynamically loaded images - JPEG quality tunable
