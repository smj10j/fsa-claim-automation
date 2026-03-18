# Design Document - FSA Claim Automation

**Last Updated**: 2026-03-17

---

## Design Principles

1. **Guide, don't surprise** — Every action the extension takes should be visible and understandable to the user
2. **Minimal UI** — The popup is a companion, not a dashboard. Keep it focused.
3. **User in control** — The extension fills forms but the user always confirms submissions
4. **Graceful degradation** — If automation fails, show clear instructions for manual steps

---

## Popup Dimensions

Chrome extension popups: **400px wide × 580px tall** (max)

---

## Workflow Steps (Popup UI)

### Step 1: Idle / Start
```
┌─────────────────────────────────────┐
│  💊 FSA Claim Automation             │
│  ─────────────────────────────────  │
│  Benefit Year: 2025                  │
│  (Jan 1, 2025 – Dec 31, 2025)        │
│                                      │
│  ┌──────────────────────────────┐   │
│  │     Start Scanning Amazon    │   │
│  └──────────────────────────────┘   │
│                                      │
│  Last scan: Never                    │
└─────────────────────────────────────┘
```

### Step 2: Scanning Amazon
```
┌─────────────────────────────────────┐
│  ● ● ○ ○ ○  Scanning Amazon...      │
│  ─────────────────────────────────  │
│  Scanning page 2 of 5...            │
│  Found 12 orders, 4 eligible so far  │
│                                      │
│  [████████░░░░░░░░░░] 45%            │
│                                      │
│  ┌──────────────────────────────┐   │
│  │          Cancel              │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Step 3: Review Orders
```
┌─────────────────────────────────────┐
│  ● ● ● ○ ○  Review Orders           │
│  ─────────────────────────────────  │
│  Found 6 eligible orders             │
│  Total: $127.45                      │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ ✓ Order #113-xxx  Jan 15     │   │
│  │   Advil 200mg 100ct  $18.99  │   │
│  ├──────────────────────────────┤   │
│  │ ✓ Order #112-xxx  Feb 3      │   │
│  │   Blood Pressure Mon $52.00  │   │
│  ├──────────────────────────────┤   │
│  │ ✓ Order #113-yyy  Mar 8      │   │
│  │   Contact Solution   $14.99  │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────────────────────────┐   │
│  │    Capture Invoices (6)      │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Step 4: Capture Invoices
```
┌─────────────────────────────────────┐
│  ● ● ● ● ○  Capturing Invoices...   │
│  ─────────────────────────────────  │
│  ✓ Order #113-xxx                    │
│  ✓ Order #112-xxx                    │
│  ⟳ Order #113-yyy  (capturing...)   │
│  ○ Order #114-aaa                    │
│  ○ Order #115-bbb                    │
│                                      │
│  [████████████░░░░░░] 60%            │
└─────────────────────────────────────┘
```

### Step 5: Submit Claims
```
┌─────────────────────────────────────┐
│  ● ● ● ● ●  Submit Claims           │
│  ─────────────────────────────────  │
│  Claim 1 of 6                        │
│                                      │
│  Advil 200mg 100ct                   │
│  Date: Jan 15, 2025                  │
│  Amount: $18.99                      │
│  Type: OTC Medicine                  │
│                                      │
│  ┌──────────────────────────────┐   │
│  │  [thumbnail of invoice]      │   │
│  └──────────────────────────────┘   │
│                                      │
│  ┌──────────┐  ┌───────────────┐    │
│  │   Skip   │  │ Fill & Review │    │
│  └──────────┘  └───────────────┘    │
└─────────────────────────────────────┘
```

### Step 6: Complete
```
┌─────────────────────────────────────┐
│  ✓  All Done!                        │
│  ─────────────────────────────────  │
│  Submitted: 5 claims  ($112.97)      │
│  Skipped: 1 claim                    │
│                                      │
│  Your FSA claims have been filed!    │
│                                      │
│  ┌──────────────────────────────┐   │
│  │       Start New Session      │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## Component Hierarchy

```
App
├── StepIndicator          (shows ● ● ○ ○ ○ progress)
├── Step: Idle
│   └── BenefitYearDisplay
├── Step: ScanningAmazon
│   └── ProgressBar
├── Step: ReviewOrders
│   └── OrderList
│       └── OrderCard (with toggle)
├── Step: CapturingInvoices
│   └── CaptureProgress
│       └── CaptureStatus per order
├── Step: SubmittingClaims
│   └── ClaimReview
│       ├── ClaimDetails
│       ├── InvoicePreview (thumbnail)
│       └── ConfirmSkipButtons
└── Step: Complete
    └── Summary
```

---

## Color Palette

Keep it clean and medical/professional:

| Use | Color |
|-----|-------|
| Primary action | `#0066CC` (blue) |
| Success | `#1A7A4A` (green) |
| Warning | `#B45309` (amber) |
| Error | `#B91C1C` (red) |
| Background | `#FFFFFF` |
| Surface | `#F9FAFB` |
| Border | `#E5E7EB` |
| Text primary | `#111827` |
| Text secondary | `#6B7280` |

---

## Typography

- Font: System font stack (no custom fonts needed)
- Popup title: 16px semibold
- Section headers: 13px semibold, uppercase, letter-spacing
- Body: 13px regular
- Amounts: 14px semibold, monospace
- Captions: 11px regular, secondary color

---

## Iconography

Use inline SVG or a minimal icon set (Heroicons). No icon font. Key icons:
- Checkmark (eligible, success)
- X mark (ineligible, error)
- Spinner (loading)
- Invoice/receipt
- Arrow right (next step)

---

## Accessibility

- All interactive elements have accessible labels
- Color is not the only indicator of state (icons + text too)
- Keyboard navigation supported through popup
- Sufficient contrast ratios (WCAG AA)
