# Product Requirements Document - FSA Claim Automation

**Status**: In Development
**Last Updated**: 2026-03-17
**Version**: 0.1.0

---

## Overview

A Chrome Extension that automates the tedious process of submitting FSA (Flexible Spending Account) reimbursement claims. It guides users through scanning Amazon order history for FSA-eligible purchases, capturing receipts, and auto-filling the claim submission forms on their FSA provider's portal.

**Inspiration**: [WithSilver](https://www.withsilver.app/) — a similar service. We're building our own as a Chrome Extension to keep data local and avoid subscriptions.

---

## Problem Statement

FSA reimbursement is heavily underutilized because the process is cumbersome:
1. Users don't know which purchases are FSA eligible
2. Finding and organizing receipts/invoices is tedious
3. Manually entering each claim in the FSA portal is time-consuming
4. Many users lose FSA funds at year-end because they haven't submitted claims

---

## Target Users

**MVP**: Single user (the developer) with:
- Amazon.com purchase history
- Navia Benefits as FSA provider

**Future**: Generalizable to other Amazon customers and FSA providers.

---

## User Stories

### Epic 1: Amazon Order Scanning

**US-01**: As a user, I want the extension to scan my Amazon order history so I can see which purchases are FSA eligible without manually reviewing each order.

**Acceptance Criteria**:
- Extension navigates to or detects Amazon order history page
- Scans orders within the current FSA benefit year (Jan 1 - Dec 31)
- Identifies FSA-eligible items using keyword/category matching
- Displays a list of eligible orders with item names, dates, and amounts

**US-02**: As a user, I want to review and adjust which items are marked as FSA eligible before submitting claims, because automated matching isn't perfect.

**Acceptance Criteria**:
- Each identified item has a toggle to mark as eligible/ineligible
- Changes are persisted before proceeding
- Total eligible amount is shown

### Epic 2: Invoice Capture

**US-03**: As a user, I want the extension to automatically capture invoice screenshots for my eligible orders, so I don't have to manually save each receipt.

**Acceptance Criteria**:
- Extension navigates to each order detail page
- Captures a screenshot of the order summary/receipt
- Stores the screenshot for attachment to FSA claims
- Shows capture progress and allows retry on failure

### Epic 3: FSA Claim Submission

**US-04**: As a user, I want the extension to automatically fill in the FSA claim form on Navia Benefits portal, so I only have to review and confirm each claim.

**Acceptance Criteria**:
- Extension navigates to Navia Benefits claim submission page
- Auto-fills: service date (order date), amount, expense type, description
- Attaches the captured invoice screenshot
- Pauses and shows a confirmation dialog before final submission

**US-05**: As a user, I want to review each claim before it's submitted, with the ability to skip or edit it.

**Acceptance Criteria**:
- Each claim shows: item name, date, amount, expense type, invoice thumbnail
- Skip button: moves to next claim without submitting
- Confirm button: triggers submission on Navia portal
- After all claims processed: shows summary of submitted/skipped

### Epic 4: User Guidance

**US-06**: As a user, I want clear step-by-step guidance through the process, so I know what the extension is doing and what I need to do.

**Acceptance Criteria**:
- Progress indicator shows current step (1. Scan Amazon, 2. Review Orders, 3. Capture Invoices, 4. Submit Claims, 5. Done)
- Clear instructions for each step
- Error messages with actionable guidance when something goes wrong

---

## Non-Goals (MVP)

- Multi-provider support (only Navia Benefits for MVP)
- Multi-retailer support (only Amazon for MVP)
- Backend server, data storage, or user accounts
- Chrome Web Store publishing
- Automatic scheduling or reminders
- OCR of physical receipts
- Health insurance claims (separate from FSA)

---

## FSA Eligibility

For MVP, eligibility is determined by keyword matching on product titles. Categories include:
- OTC medicines and drugs (pain relievers, cold medicine, etc.)
- Medical equipment (blood pressure monitors, thermometers, etc.)
- First aid supplies (bandages, antiseptics, etc.)
- Vision care (glasses, contacts, contact solution)
- Dental care (toothpaste, electric toothbrush, whitening strips... **note**: not all dental cosmetic items are eligible)
- Feminine hygiene products (menstrual products per CARES Act)
- Baby health items (baby monitors, nasal aspirators - **not** diapers or formula)

**Important**: Users must verify eligibility. The extension provides assistance, not a guarantee.

---

## FSA Provider: Navia Benefits

**Portal**: naviabenefits.com
**Claim form fields** (to be confirmed during implementation):
- Expense type (dropdown)
- Service date
- Amount
- Patient name
- Description/notes
- Receipt attachment (file upload)

---

## Metrics for Success (MVP)

- Successfully scans and identifies FSA-eligible Amazon orders
- Captures invoice screenshots for at least 90% of eligible orders
- Auto-fills Navia claim form correctly for each eligible order
- User can submit a batch of 5+ claims in under 10 minutes vs 30+ minutes manually

---

## Implementation Status

| Epic | Status |
|------|--------|
| Amazon Order Scanning | 🚧 In Progress |
| Invoice Capture | 📋 Planned |
| FSA Claim Submission | 📋 Planned |
| User Guidance | 🚧 In Progress |
