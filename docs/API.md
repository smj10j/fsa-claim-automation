# API Documentation - Internal Message Passing

**Last Updated**: 2026-03-17

This document describes the Chrome runtime message passing API between the popup, service worker, and content scripts.

---

## Message Flow Overview

```
Popup ──────────────────────────────► Service Worker
                                            │
                                     ┌──────▼───────┐
                                     │ chrome.storage│
                                     └──────┬───────┘
                                            │
                                     Content Scripts
                                     (Amazon / Navia)
```

**Rule**: Popup never communicates directly with content scripts. All orchestration goes through the service worker.

---

## Message Types

All messages conform to a discriminated union. The `type` field is the discriminant.

### Popup → Service Worker

#### `START_WORKFLOW`
Begin the guided workflow from idle state.
```typescript
{ type: "START_WORKFLOW"; benefitYear?: number }
```

#### `SCAN_ORDERS_REQUEST`
Trigger Amazon order scanning.
```typescript
{ type: "SCAN_ORDERS_REQUEST" }
```

#### `SELECT_ORDERS`
User has reviewed orders; proceed with selected subset.
```typescript
{ type: "SELECT_ORDERS"; orderIds: string[] }
```

#### `CAPTURE_INVOICES_REQUEST`
Start capturing invoice screenshots for selected orders.
```typescript
{ type: "CAPTURE_INVOICES_REQUEST" }
```

#### `NAVIGATE_NAVIA`
Open or focus the Navia Benefits tab.
```typescript
{ type: "NAVIGATE_NAVIA" }
```

#### `FILL_CLAIM_REQUEST`
Auto-fill the Navia form for a specific claim.
```typescript
{ type: "FILL_CLAIM_REQUEST"; claimId: string }
```

#### `SKIP_CLAIM`
Skip the current claim (don't submit).
```typescript
{ type: "SKIP_CLAIM"; claimId: string }
```

#### `RESET_WORKFLOW`
Reset all state and start over.
```typescript
{ type: "RESET_WORKFLOW" }
```

#### `GET_STATE`
Request current AppState from service worker.
```typescript
{ type: "GET_STATE" }
```

---

### Service Worker → Popup

#### `STATE_UPDATED`
Notifies popup of state changes (also fired on storage change).
```typescript
{ type: "STATE_UPDATED"; state: Partial<AppState> }
```

#### `GET_STATE_RESPONSE`
Response to GET_STATE request.
```typescript
{ type: "GET_STATE_RESPONSE"; state: AppState }
```

#### `ERROR`
Reports an error in the workflow.
```typescript
{ type: "ERROR"; message: string; step: WorkflowStep }
```

---

### Service Worker → Content Scripts (Amazon)

#### `SCAN_ORDERS`
Injected via `chrome.tabs.sendMessage` to start scanning.
```typescript
{ type: "SCAN_ORDERS"; benefitYearStart: string; benefitYearEnd: string }
```

#### `CAPTURE_INVOICE`
Capture invoice for a specific order on the current page.
```typescript
{ type: "CAPTURE_INVOICE"; orderId: string }
```

---

### Content Scripts (Amazon) → Service Worker

#### `SCAN_ORDERS_RESULT`
Orders found on the current page.
```typescript
{
  type: "SCAN_ORDERS_RESULT";
  orders: AmazonOrder[];
  hasNextPage: boolean;
}
```

#### `SCAN_ORDERS_ERROR`
Error during scanning.
```typescript
{ type: "SCAN_ORDERS_ERROR"; message: string }
```

#### `CAPTURE_INVOICE_RESULT`
Invoice capture completed.
```typescript
{
  type: "CAPTURE_INVOICE_RESULT";
  orderId: string;
  dataUrl: string;       // base64 JPEG
}
```

#### `CAPTURE_INVOICE_ERROR`
Invoice capture failed.
```typescript
{ type: "CAPTURE_INVOICE_ERROR"; orderId: string; message: string }
```

---

### Service Worker → Content Scripts (Navia)

#### `FILL_CLAIM`
Fill the Navia claim form.
```typescript
{ type: "FILL_CLAIM"; claim: Claim }
```

---

### Content Scripts (Navia) → Service Worker

#### `FILL_CLAIM_READY`
Form has been filled; waiting for user confirmation.
```typescript
{ type: "FILL_CLAIM_READY"; claimId: string }
```

#### `FILL_CLAIM_SUBMITTED`
User clicked submit on Navia portal; submission complete.
```typescript
{ type: "FILL_CLAIM_SUBMITTED"; claimId: string }
```

#### `FILL_CLAIM_ERROR`
Error during form fill or submission.
```typescript
{ type: "FILL_CLAIM_ERROR"; claimId: string; message: string }
```

---

## Storage Schema

### Key: `appState`
Value: `AppState` (JSON-serialized, without invoice data URLs)

### Key: `invoice:{orderId}`
Value: `string` (base64 data URL, `data:image/jpeg;base64,...`)

Example:
```
"invoice:113-1234567-8901234" → "data:image/jpeg;base64,/9j/4AAQ..."
```

---

## Error Handling

All message handlers return `undefined` on success or throw; callers should use try/catch.

Content scripts that fail should always send an error message back to the service worker rather than silently failing. The service worker updates `AppState.lastError` and emits `STATE_UPDATED` so the popup can surface the error.

---

## Versioning

Message types are internal and not versioned separately from the extension. Breaking changes to message shapes will be coordinated with a version bump in `manifest.json`.
