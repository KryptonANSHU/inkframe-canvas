# Decisions

A log of real design decisions: what we chose, why, and what we rejected.

## 2026-10-01 — Pin TypeScript 6.0 instead of 7.0

**Decision:** TypeScript 6.0.3.
**Why:** typescript-eslint 8.71 (latest) supports TypeScript `>=4.8.4 <6.1.0`. Type-aware lint rules are worth more to us than the TS 7 native compiler's speed on a small codebase.
**Rejected:** TS 7.0 without type-aware linting; TS 7.0 with an unsupported typescript-eslint (would break silently).
**Revisit:** when typescript-eslint supports TS 7.

## 2026-10-01 — Pin ESLint 9 instead of 10

**Decision:** ESLint 9.39.
**Why:** eslint-plugin-jsx-a11y 6.10 (latest) supports ESLint up to 9. Accessibility linting is a Tier 1 requirement. npm marks ESLint 9 as no longer supported, which we accept for now.
**Rejected:** ESLint 10 without jsx-a11y; forcing the peer dependency.
**Revisit:** when jsx-a11y supports ESLint 10.

## 2026-10-01 — React 18.3

**Decision:** React 18.3.1, as the PRD specifies.
**Why:** The PRD names React 18. Nothing in the plan needs React 19 features.
**Rejected:** React 19.3 (current); can be revisited with a PRD change.

## 2026-10-01 — Architecture rules enforced by lint, not convention

**Decision:** ESLint fails if `src/core` imports React, React DOM, or `src/ui`, or contains JSX. JSX is banned separately because the automatic JSX runtime adds a hidden `react/jsx-runtime` import that the import rule can't see.
**Why:** "Core has no React" is the key architecture rule; a check that runs on every PR is stronger than a code review habit.
**Rejected:** a custom dependency-graph tool (more setup for the same result at this size).

## 2026-10-01 — Unit and property tests as separate Vitest projects

**Decision:** `*.property.test.ts` files run in a `property` project (`npm run test:property`); everything else in `unit` (`npm test`). Coverage runs both and enforces 90% lines on `src/core/**`.
**Why:** Property suites will run thousands of random sequences; keeping them separate keeps the normal test loop fast.
**Rejected:** one project with tags or env flags (harder to run one kind alone).
**Note:** fast-check prints the seed and path of any failure; replay by passing them to `fc.assert`.

## 2026-10-01 — Split tsconfig into app and node configs

**Decision:** `tsconfig.app.json` (browser code in `src/`, DOM types), `tsconfig.node.json` (Vite/Playwright configs and `e2e/`, Node types), joined by a root `tsconfig.json`.
**Why:** Node globals must not type-check in browser code, and type-aware linting needs every linted TS file covered by a tsconfig.
**Rejected:** a single tsconfig (would leak Node types into `src/`).

## 2026-10-01 — Playwright with Chromium only

**Decision:** E2E tests run in Chromium only, starting with one smoke test (app loads, no console errors or warnings).
**Why:** The definition of done requires `e2e` to pass every milestone. One browser keeps local and CI runs fast.
**Rejected:** all three engines now; worth adding before the Tier 1 gate if time allows.
