
Use this `AGENTS.md` exactly as your first version:

```md
# AGENTS.md

## Project purpose
This repository contains the IPI Prospecting Tool, a static web app used to research, score, filter, and prioritise prospective channel partners for UK CCaaS, UCaaS, CX and AI sales motions.

## Core product rules
- This is a working sales tool, not a marketing microsite.
- Optimise for speed of account review, comparison, filtering, and prioritisation.
- Prefer dense, usable layouts over decorative design.
- Keep the primary workflow centered on:
  1. filtering partner accounts
  2. reviewing weighted score and tier
  3. opening account detail
  4. identifying outreach angle

## Design rules
- Follow IPI brand colours:
  - Charcoal: #36454F
  - Dark: #263337
  - Mauve: #A37992
  - Mauve Dark: #4F3645
  - Green: #63AB8F
  - Green Dark: #82BBA5
  - Salmon: #C8988C
  - Slate: #383B4F
- Prefer clean light backgrounds with dark text.
- Use accent colours sparingly and with purpose.
- Brand font direction:
  - Proxima Nova preferred where available
  - Aptos acceptable fallback for Microsoft-style environments
  - Safe web fallback: Inter, Segoe UI, Arial, sans-serif
- Avoid visual clutter, oversized hero sections, or presentation-style page design.

## UX rules
- The main page is the Prospect Search page.
- Required layout:
  - left filter rail
  - top KPI strip
  - central ranked table
  - right detail drawer
- Do not replace the table with card grids.
- Keep filters sticky where practical.
- Score visibility must be immediate in the table.
- Detail drawer should open fast and preserve context.

## Scoring model rules
Always align scoring logic to the IPI Ideal Partner Profile model.

### Weighted categories
- Route-to-Revenue Fit: 40%
- Vendor Displacement Opportunity: 20%
- Customer & Use Case Fit: 15%
- Sales Motion Maturity: 15%
- Scale Fit: 5%
- Geographic Fit: 5%

### Score range
- Each category is scored 1 to 5
- Weighted score stored to 2 decimal places
- UI display may round to 1 decimal place

### Tiering
- Tier 1 – Strategic Target: 4.2+
- Tier 2 – Strong Prospect: 3.6 to 4.19
- Tier 3 – Opportunistic: 3.0 to 3.59
- Tier 4 – Low Priority: below 3.0

### Hard rule
- If Vendor Displacement score <= 2, cap at Tier 2

### Confidence
Keep confidence separate from weighted score:
- High
- Medium
- Low

Do not blend confidence into the weighted score.

## Data handling rules
- Prefer deterministic logic over opaque heuristics.
- Keep partner data in structured JSON where possible.
- Normalise:
  - employee bands
  - turnover bands
  - vendor names
  - service labels
  - geography labels
- Missing data should reduce confidence, not inflate score.
- If data is unclear, bias conservative.

## Coding rules
- Keep the app static-first: HTML, CSS, vanilla JS unless there is a strong reason otherwise.
- Avoid adding frameworks unless requested.
- Do not introduce a backend without explicit approval.
- Keep code modular and readable.
- Separate data, scoring logic, rendering logic, and event handling where possible.
- Comment only where it improves maintainability.
- Do not break GitHub Pages compatibility.

## Change management rules
When making changes:
- preserve existing scoring behaviour unless explicitly asked to change it
- avoid unnecessary UI rewrites
- prefer incremental improvements
- explain any structural refactor in the PR summary
- highlight any scoring-impacting change clearly

## Priority roadmap
When choosing between improvements, prioritise in this order:
1. scoring accuracy
2. filtering and sort usability
3. detail drawer quality
4. data quality visibility
5. export and workflow utility
6. cosmetic polish

## Avoid
- generic CRM-style fluff
- vague summaries without commercial value
- black-box AI scoring with no rationale
- over-animated UI
- marketing language in the interface
- large rewrites that destabilise the working app
