# Security Documentation - FSA Claim Automation

**Last Updated**: 2026-03-17

---

## Security Model

This extension operates entirely locally — no data is ever sent to a backend server, third-party API, or cloud storage. All data lives in `chrome.storage.local` on the user's machine.

---

## Data Handled

| Data Type | Where Stored | Retention |
|-----------|-------------|-----------|
| Amazon order IDs, dates, amounts | chrome.storage.local | Until user resets or benefit year changes |
| Product titles | chrome.storage.local | Same as above |
| Invoice screenshots (JPEG base64) | chrome.storage.local | Same as above |
| Amazon session cookies | Not accessed | N/A |
| Navia login credentials | Not accessed | N/A |

**Never accessed**:
- Passwords or credentials
- Credit card numbers
- Full Amazon account data
- Health/medical record data beyond what the user submits

---

## Chrome Permissions

Permissions are minimized to what is strictly necessary:

| Permission | Why Needed |
|-----------|-----------|
| `storage` | Persist AppState and invoice screenshots |
| `scripting` | Inject content scripts into Amazon and Navia pages |
| `tabs` | Navigate to Amazon/Navia tabs, read current tab URL |
| `activeTab` | Fallback screenshot capture if html2canvas fails |

Host permissions:
- `https://www.amazon.com/*` — Read order history DOM
- `https://*.naviabenefits.com/*` — Fill claim submission form

No broad host permissions (`<all_urls>`) are requested.

---

## FSA Eligibility Disclaimer

**IMPORTANT**: The FSA eligibility determination in this extension is provided as a convenience tool only. It is not tax or medical advice.

- Keyword matching is imprecise — some items may be incorrectly classified
- IRS rules for FSA eligibility can change
- The user is solely responsible for verifying that claimed expenses are eligible
- Submitting ineligible expenses for FSA reimbursement may have tax consequences

Users should consult IRS Publication 502 and their FSA plan documents to confirm eligibility.

---

## Content Script Isolation

Content scripts run in an isolated world — they cannot access the host page's JavaScript variables, cookies, or localStorage. They can only read/modify the DOM and communicate via `chrome.runtime.sendMessage`.

This means:
- The extension cannot steal Amazon session tokens
- The extension cannot read Navia passwords or session data
- The extension only reads what is visible in the DOM

---

## Cross-Origin Isolation

The extension does not make any cross-origin fetch requests. All data collection is via DOM reading within content scripts on pages the user has already navigated to.

---

## Data Deletion

Users can clear all stored data by:
1. Clicking "Reset" in the extension popup (clears chrome.storage.local)
2. Removing the extension from Chrome (chrome.storage.local is cleared automatically)

---

## Attack Surface

| Vector | Risk | Mitigation |
|--------|------|-----------|
| Malicious Amazon page | Could craft DOM to inject false order data | Extension only runs on `amazon.com`, data is display-only |
| Malicious Navia page | Could manipulate form fill behavior | Extension only runs on `naviabenefits.com` |
| chrome.storage.local read by other extensions | Low risk | Storage is per-extension, not shared |
| XSS via product titles | Product titles rendered in popup | React's JSX auto-escapes, no `dangerouslySetInnerHTML` |

---

## Development Security Notes

- Never log invoice data URLs to the console in production builds
- Never include personal health/financial data in bug reports
- Keep `eslint-plugin-security` in devDependencies for static analysis
