# FSA Claim Automation

A Chrome Extension that automates FSA claim submissions. It scans your Amazon order history for FSA-eligible purchases, captures invoice screenshots, and auto-fills Navia Benefits claim forms — you just review and confirm.

## Status: MVP In Development

## How It Works

1. Click the extension popup → **Start Scanning Amazon**
2. Extension scans your Amazon order history for FSA-eligible items
3. Review and select which orders to claim
4. Extension captures invoice screenshots automatically
5. Navigate to Navia Benefits portal (log in if needed)
6. For each claim: extension auto-fills the form, you review and click Submit

## Setup (Development)

### Prerequisites
- Node.js 18+
- Chrome browser

### Install & Build

```bash
cd extension
npm install
npm run build
```

### Load in Chrome

1. Open Chrome → navigate to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/dist` folder

The extension icon will appear in your toolbar.

### Development Mode (Watch)

```bash
cd extension
npm run dev
```

Rebuilds automatically on file changes. Reload the extension in Chrome after each build (`chrome://extensions` → click the refresh icon).

## Running Tests

```bash
cd extension
npm test
```

Unit tests cover:
- FSA eligibility keyword matching
- Benefit year calculation and date parsing
- Price parsing utilities

## Project Structure

```
fsa-claim-automation/
├── CLAUDE.md           # AI assistant instructions
├── README.md           # This file
├── TODO.md             # Implementation checklist
├── docs/
│   ├── PRD.md          # Product Requirements
│   ├── TDD.md          # Technical Design
│   ├── DESIGN.md       # UX/UI Design
│   ├── API.md          # Internal Message API
│   └── SECURITY.md     # Security Model
└── extension/
    ├── manifest.json   # Chrome Extension manifest (MV3)
    ├── src/
    │   ├── types/      # TypeScript type definitions
    │   ├── constants/  # DOM selectors, eligibility keywords
    │   ├── lib/        # Pure utility functions
    │   ├── service-worker/  # Background orchestration
    │   ├── content-scripts/
    │   │   ├── amazon/      # Order scanning + invoice capture
    │   │   └── navia/       # Claim form auto-fill
    │   └── popup/      # React popup UI
    └── src/tests/      # Unit tests
```

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript (strict)
- React 18 + Tailwind CSS
- Vite + @crxjs/vite-plugin
- Vitest for unit testing
- html2canvas for invoice screenshots

## Supported Providers

| FSA Provider | Status |
|-------------|--------|
| Navia Benefits | 🚧 In Progress |

## Supported Retailers

| Retailer | Status |
|---------|--------|
| Amazon.com | 🚧 In Progress |

## FSA Eligibility Disclaimer

This extension helps identify potentially FSA-eligible purchases using keyword matching. It is not a substitute for reviewing IRS Publication 502 or your FSA plan documents. You are responsible for verifying that claimed expenses are eligible. Submitting ineligible expenses may have tax consequences.

## Security

All data stays on your machine — no backend server, no account required. See [docs/SECURITY.md](docs/SECURITY.md) for details.
