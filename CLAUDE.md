# FSA Claim Automation - Claude Instructions

## Project Overview

A Chrome Extension (Manifest V3) that automates FSA claim submissions. It scans Amazon order history for FSA-eligible purchases, captures invoices, then auto-fills Navia Benefits claim forms for user review and submission.

## Implementation Loop

For every task/feature implementation, follow these steps in order:

1. **Gather requirements** - Understand what needs to be built, check relevant docs in `/docs/`
2. **Write a TODO** - Update `TODO.md` with a checklist of steps before starting
3. **Implement** - Write code + tests, marking TODO items as completed `[x]` as you go
4. **Run tests** - `cd extension && npm test` for unit tests; manually test the extension in Chrome
5. **Deploy** - `cd extension && npm run build` then load unpacked in Chrome for validation
6. **Validate** - Verify the feature works end-to-end in Chrome with the built extension
7. **Update TODO** - Mark any remaining items complete, note any follow-up work
8. **Update docs** - Keep PRD.md, TDD.md, README.md, and relevant docs current
9. **Commit & push** - Only after the change is confirmed working. Skip the commit when iterating on bugs or uncertain fixes — batch related fixes into one commit once validated.

## Key Decisions

- Run subagents/background agents for parallel work where possible
- Make architecture decisions independently unless truly ambiguous
- Prefer extensibility without over-engineering
- MVP first, then iterate

## Tech Stack

- **Extension**: Chrome Manifest V3, TypeScript (strict), React 18
- **Build**: Vite + @crxjs/vite-plugin
- **Styling**: Tailwind CSS
- **Testing**: Vitest
- **Linting**: ESLint (typescript-eslint) + Prettier
- **Invoice capture**: html2canvas
- **State**: chrome.storage.local (persists across SW restarts)

## Project Structure

```
fsa-claim-automation/
├── CLAUDE.md           # This file
├── README.md
├── TODO.md             # Current implementation checklist
├── docs/
│   ├── PRD.md
│   ├── TDD.md
│   ├── DESIGN.md
│   ├── API.md
│   └── SECURITY.md
└── extension/
    ├── manifest.json
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── types/          # All TypeScript type definitions
        ├── constants/      # Selectors, eligibility lists
        ├── lib/            # Pure utility functions
        ├── service-worker/ # Background service worker
        ├── content-scripts/
        │   ├── amazon/     # Order scanning, invoice capture
        │   └── navia/      # Claim form auto-fill
        └── popup/          # React popup UI
```

## Critical Architecture Notes

- **State persistence**: All workflow state lives in `chrome.storage.local` - never in-memory only
- **Message passing**: Popup → Service Worker → Content Scripts (never direct popup ↔ content script)
- **Service worker**: Treat as stateless; it re-reads storage on every message event
- **Amazon selectors**: All in `src/constants/selectors.ts` - update there when Amazon changes their DOM
- **Navia selectors**: All in `src/constants/navia-selectors.ts`

## Development Commands

```bash
cd extension
npm install          # Install dependencies
npm run dev          # Build with watch mode (load unpacked in Chrome)
npm run build        # Production build
npm test             # Run unit tests
npm run lint         # ESLint check
npm run typecheck    # TypeScript type check
```

## Loading the Extension

1. `cd extension && npm run build`
2. Open Chrome → `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" → select `extension/dist`

## Testing Notes

- Unit tests: Pure functions (eligibility, benefit-year, storage helpers) in `src/tests/unit/`
- Integration: Manual testing in Chrome with the built extension
- Fixtures: Sample Amazon order page HTML in `src/tests/fixtures/`
- No mocking Chrome APIs in unit tests - keep testable logic pure
