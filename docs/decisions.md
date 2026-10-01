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

## 2026-10-01 — Camera stores the world point at the screen origin

**Decision:** `Camera = { x, y, zoom }`, where `(x, y)` is the world point at the canvas's top-left. `screen = (world − camera) × zoom`. All conversions, including the renderer's world → device transform, live in `core/camera.ts`.
**Why:** Pan is a plain subtraction in world units, and zooming around the cursor is two lines (`anchorWorld − anchor / newZoom`). Keeping the device transform in the same file means no other module ever does coordinate math.
**Rejected:** storing a screen-space offset (`screen = world × zoom + offset`), which has the same precision but makes "where am I in the world" a derived value; a full matrix (rotation of the camera is not a feature).

## 2026-10-01 — Coordinate precision is guaranteed within ±1e6 world units

**Decision:** The 1e-9 round-trip guarantee is tested for world coordinates and camera positions up to ±1e6, zoom 10%–400%. Checked with 100 runs per test, plus a one-off 200,000-run stress pass.
**Why:** At 1e6, the gap between neighbouring doubles is about 1.2e-10, so a few rounding steps already approach 1e-9. An absolute tolerance can't hold on an unbounded canvas. ±1e6 units is about 1,000 screen widths at 100%.
**Rejected:** a relative tolerance (weaker than what the PRD asks for); rebasing the camera origin (complexity with no user-visible need yet).

## 2026-10-01 — Backing-store size prefers devicePixelContentBoxSize

**Decision:** The canvas's device-pixel size comes from `ResizeObserver`'s `devicePixelContentBoxSize` where the browser reports it; otherwise `round(cssSize × devicePixelRatio)` (`core/viewport.ts`). DPR changes are detected with a `(resolution: Ndppx)` media query that is re-created after each change.
**Why:** At fractional DPRs (1.25, 1.5) or fractional CSS sizes, rounding can leave the bitmap a pixel off from the screen, which blurs every line. The browser's exact device-pixel size avoids this.
**Rejected:** always rounding (blurry at fractional DPRs in browsers that can do better).

## 2026-10-01 — Document = shapes by ID + a draw-order list

**Decision:** `DocumentState = { shapes: ReadonlyMap<ShapeId, Shape>, order: readonly ShapeId[] }`. Each shape also keeps its `zIndex`, which must equal its position in `order`. `insertShape` and `removeShape` (`core/document.ts`) renumber the shapes above the change.
**Why:** Commands, hit-testing and selection need fast lookup by ID; the renderer needs a ready bottom-to-top list without sorting every frame. `zIndex` on the shape is what CLAUDE.md requires and what gets saved to files.
**Rejected:** shapes only in a Map, sorted by zIndex when drawing (sorting 10k shapes per frame); shapes only in an array (O(n) lookup by ID during multi-shape drags).
**Cost:** `zIndex` and `order` can disagree if code bypasses `document.ts`. The M5 invariants checker verifies they match after every command.

## 2026-10-01 — Commands are pure functions over the document

**Decision:** `Command = { label, do(document) → document, undo(document) → document }`. `executeCommand` builds the new document first and stores it in one `setState`; if `do` throws, nothing is stored and a `CommandError` is returned as a `Result`.
**Why:** This makes every command transactional by construction (PRD 1D), with no rollback code. Pure functions are also trivial to test for exact do → undo → redo equality.
**Rejected:** commands that mutate the store directly and roll back on error (every command needs its own rollback, which is easy to get wrong).
**Next:** M5 adds the history stack, selection in undo/redo, and the invariants check after each command.

## 2026-10-01 — The shape being drawn lives outside the document

**Decision:** The store has a `draft: Shape | null` that the renderer draws on top. The tool updates the draft while dragging, then commits one `createShapeCommand` on release.
**Why:** Cancelling a gesture only clears the draft, so the document is never touched until the gesture succeeds, and one gesture is exactly one undo step.
**Rejected:** inserting the shape on pointerdown and updating it on every move (cancel would need an undo, and history would fill with intermediate states).

## 2026-10-01 — Store is per editor, render loop and renderer take their dependencies

**Decision:** `createEditorStore()` makes a new Zustand vanilla store per editor (no module singleton). `createRenderLoop(draw, scheduler)` takes the frame scheduler, and `createRenderer(context)` takes a narrow `RenderContext` (the subset of `CanvasRenderingContext2D` it uses).
**Why:** Tests run in Node with a manual frame scheduler and a recording context, so "ten changes → one draw", "idle → zero frames" and draw order are checked without a browser. Real canvas output is checked in Playwright (M2c).
**Rejected:** jsdom plus a canvas polyfill (a heavy dependency that still doesn't render real pixels).

## 2026-10-01 — DOM-free input controller; browser glue in core/dom

**Decision:** `core/input/inputController.ts` turns plain inputs (`{ pointerId, screen }`, key names, wheel deltas) into tool gestures. It locks one tool per gesture, ignores extra pointers, and cancels on pointercancel, lost capture, Escape, or window blur. `core/dom/` holds the only code that touches the DOM: listeners (removed with one `AbortController`), `ResizeObserver`, the DPR watcher, and `createEditor`.
**Why:** The full input path (pointer → tool → command → store) is tested in Node against the real tools, fast and deterministic. The DOM layer is a thin translation and is tested where it actually runs: Playwright.
**Rejected:** jsdom integration tests (an extra dependency that lacks PointerEvent capture, ResizeObserver, matchMedia and canvas, so most of it would be stubs).
**Cost:** `src/core/dom/**` is excluded from the unit-coverage figure; Playwright covers it instead (drawing, cancel, zoom, pan, 2× DPR, idle frames). Core unit coverage is reported for everything else.

## 2026-10-01 — Trust devicePixelContentBoxSize only when it agrees with the DPR

**Decision:** `chooseBackingStoreSize` uses the browser's exact device-pixel size only when it is within 1 px of `round(cssSize × devicePixelRatio)`; otherwise it uses the rounded size.
**Why:** The renderer scales by `devicePixelRatio`, so the backing store must match it. Chromium with an emulated device scale factor (Playwright `deviceScaleFactor: 2`) reports `devicePixelRatio = 2` but a CSS-pixel `devicePixelContentBoxSize`, which drew everything at half resolution. The exact size exists only to fix sub-pixel rounding, so a bigger disagreement means the report is wrong.
**Note:** The e2e 2× test therefore exercises the rounding path. The exact path runs on real high-DPI screens; check it manually on a Retina display.

## 2026-10-01 — Wheel and pinch tuning

**Decision:** Plain wheel / two-finger scroll pans by the pixel delta (lines × 16, pages × canvas height). Ctrl + wheel and pinch zoom by `exp(−delta × 0.01)` around the cursor, with the delta capped at ±10 px per event.
**Why:** A mouse notch is ~100 px and a pinch step a few px. The cap makes one notch ≈ 10% while pinch stays proportional and smooth.
**Rejected:** a fixed step per event (pinch feels jumpy); no cap (one notch jumps 2.7×).

## 2026-10-01 — Canvas is a focusable role="application"

**Decision:** The canvas has `tabIndex={0}`, `role="application"` and `aria-label="Drawing canvas"`. Keys (Space, Escape) are handled only on the canvas, so they work only while it has focus; clicking the canvas focuses it.
**Why:** ARIA's application role tells screen readers to pass keys through to the page, which is what a drawing surface needs, and ARIA expects such elements to be focusable. jsx-a11y classes the role as non-interactive, so that one rule is disabled on that line with this reason.
**Rejected:** listening for keys on `window` (would fire while typing in future inputs, against CLAUDE.md).
