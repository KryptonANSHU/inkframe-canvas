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

## 2026-10-01 — Shape model: boxes for rect/ellipse, relative points for paths

**Decision:** Rectangles and ellipses store `x, y, width, height`. Lines and arrows store two `points`, pens up to 10,000, all relative to the shape's `(x, y)`. A path's box is derived from its points (`shapeBox`, cached per shape object in a `WeakMap`). Every shape rotates around its box center. Text joins the union in M3d.
**Why:** Moving a path changes only `x, y`, never the points (cheap for 10k-point pen strokes). Deriving the box instead of storing it means it can never disagree with the points. Immutable shapes make the per-object cache always valid.
**Rejected:** storing width/height on paths too (two sources of truth); absolute world-space points (moving a pen stroke rewrites every point).
**Open for M5:** what "at least 1 world unit" means for lines (minimum length rather than width/height, since a horizontal line has zero height).

## 2026-10-01 — Spatial index: uniform grid, synced by reference diff

**Decision:** `core/spatial/spatialIndex.ts` is a uniform grid with 256-unit cells and numeric cell keys (no string allocation). Each shape is filed under the cells its `shapeBounds` touch: the rotated box inflated by a full stroke width (covers mitered corners), plus the head length for arrows. Shapes touching more than 64 cells go in an "oversized" list; queries covering more than 256 cells scan all entries. `syncSpatialIndex` diffs the previous and next document by shape reference and calls `update` / `remove` — the only two ways into the index.
**Why:** Shapes are immutable, so a changed reference means a changed shape, whichever command (or undo/redo) produced it. Commands don't need to know the index exists, and nothing can forget to update it. The diff is O(n) per document change, which is per gesture, not per frame.
**Rejected:** a quadtree or R-tree (more code, rebalancing; a grid is enough for 10k shapes of similar size and is trivial to verify against a rebuild); commands returning changed IDs (every command must get it right, and undo paths double the surface).
**Verified:** a fast-check property applies random create / undo / redo / remove / replace sequences and checks the synced index equals a full rebuild after every step; a second checks `query` against brute force. Both catch a deliberately broken sync (never removing, never updating) with a two-step counterexample.

## 2026-10-01 — Renderer draws all path shapes from M3a

**Decision:** Ellipse, line, arrow, and pen drawing landed with their types in M3a (planned for M3c), because the renderer's exhaustive `switch` must handle every member of `Shape`. Rectangles use mitered joins; everything else uses round joins and caps. Pen strokes curve through the midpoints between captured points. Paths are never filled.

## 2026-10-01 — Hit-testing: index candidates, exact test in the shape's frame

**Decision:** `core/hitTest.ts` queries the spatial index with a box of radius `6 / zoom` around the point, then runs an exact test per candidate after un-rotating the point around the shape's center. A stroke is hit within `6 / zoom + strokeWidth / 2` world units. Filled rectangles and ellipses are also hit anywhere inside; unfilled shapes and all paths only near their stroke. `hitTest` returns the topmost hit (highest zIndex); `hitTestAll` returns every hit, topmost first, for Alt + click cycling in M4. Pen strokes are tested against the polyline through their points, not the smoothed curve that is drawn. The curve cuts inside sharp corners by about a quarter of the corner's size: negligible for dense input, but a fast stroke with points ~100 units apart and a right-angle turn is off by ~9 units there, beyond the 6 px tolerance at 100%. Hit-testing the curve itself is a follow-up if this shows up in practice.
**Why:** The index keeps a hit-test to a handful of candidates even at 10k shapes; un-rotating one point is cheaper than rotating the shape. Tolerance in screen pixels means thin lines are equally easy to click at any zoom.
**Rejected:** pixel-based picking with a hidden color-ID canvas (needs a second render of every shape and can't do a 6 px tolerance cleanly).

## 2026-10-01 — Ellipse distance by fixed iteration

**Decision:** `distanceToEllipse` refines the nearest-point guess 4 times using the ellipse's local center of curvature, with no trigonometry.
**Why:** There is no closed form. Measured worst error is 3.7e-6 of the larger radius at aspect ratios up to 1000:1 (against 200,000-point outline sampling) — far below a pixel at any zoom.
**Rejected:** sampling the outline (slow and less accurate); approximating with the normalized radius `|√((x/a)² + (y/b)²) − 1| · min(a, b)` (badly wrong for thin ellipses).

## 2026-10-01 — Arrowhead geometry shared by renderer and hit-test

**Decision:** `arrowHeadWing` in `shapeGeometry.ts` computes each side of the arrowhead; both the renderer and the hit-test call it.
**Why:** If the two computed it separately, a change to one would make clicks miss what is drawn.

## 2026-10-01 — Brute-force hit-test check: 5 × 10,000 points per run

**Decision:** The property test builds random documents (1–150 shapes of every type, rotation, fill, and stroke width), then compares `hitTest` and `hitTestAll` with an every-shape brute force on 10,000 points each: half uniform, half inside a random shape's bounds. Points come from a seeded PRNG driven by fast-check, so a failure is reproducible. 5 runs per `npm run test:property` (about 1.5 s); a one-off 30-run pass also passed.
**Verified:** A deliberately broken query (ignoring the tolerance) fails it immediately.

## 2026-10-01 — One drag tool, many shape builders

**Decision:** The rectangle tool became `createDragShapeTool(store, reportError, build)`. Rectangle, ellipse, line, and arrow are each a pure `DragShapeBuilder` (`tools/shapeBuilders.ts`) from drag start to end. Lines and arrows keep the drag direction; a drag under 1 unit is stretched to 1 unit along its direction (straight right if it has none).
**Why:** The gesture logic (3 px threshold, draft, cancel, one command per gesture) is written and tested once. Builders are pure functions, tested without any pointer events.
**Rejected:** one tool per shape (four copies of the same state machine).

## 2026-10-01 — Pen draft shares the growing points array

**Decision:** While drawing, the pen tool appends points to its own array and the draft shape references that same array; each move creates a new draft object, not a new array. On release the points are copied once, shifted so `(x, y)` is their top-left. Points closer than 1 screen pixel are skipped; recording stops at 10,000 points (the stroke ends there visually until release).
**Why:** Copying the array on every move is O(n²) over a long stroke. The shared array is safe because the draft is never part of the document, and a test checks the committed points are a different array that later strokes don't touch.
**Next:** pressure-based width and `getCoalescedEvents` for smoother fast strokes arrive with pointer types in M4.

## 2026-10-01 — Tool shortcuts on the canvas

**Decision:** `activeTool` lives in the store. R / O / L / A / P switch tools (case-insensitive) when the canvas has focus, no gesture is active, and no Ctrl / Cmd / Alt is held. The visible toolbar comes in M7.
**Why:** Modifier combinations belong to the browser and OS (Ctrl + R reloads, Cmd + A selects all later). Switching mid-gesture would change what the current drag creates.

## 2026-10-01 — Text height is stored on the shape, not derived

**Decision:** `TextShape` stores `width` (wrap width) and `height`, measured with the loaded font when the text is committed (`createTextShape`). The renderer still wraps lines at draw time with `layoutText`, cached per shape object and reset when the font loads.
**Why:** With a stored height, `shapeBox` stays a pure function of the document, so the spatial index, hit-testing, and (later) selection need no font service passed in, and "same bounds after reload and in export" (PRD 1B) holds by construction. This changes the M3 plan, which said height would be derived.
**Rejected:** deriving height on demand (every caller of `shapeBox` would need a measurer, or core would need a global one).
**Risk and follow-up:** a browser whose text widths differ slightly could wrap to a different number of lines than the stored height. M6's import should re-measure text heights after fonts load.

## 2026-10-01 — Self-hosted Instrument Sans via the FontFace API

**Decision:** `public/fonts/instrument-sans-latin-400-normal.woff2` (16,860 bytes, from @fontsource/instrument-sans 5.3.0 via jsDelivr; SHA-256 9a91efaa…0850) with its OFL 1.1 license in `public/fonts/OFL.txt`. `loadTextFont` adds it to `document.fonts` on editor start. Text is not drawn and the text tool does nothing until it loads; then measurements are reset and the canvas redraws. If loading fails, the user is told and text falls back to a system font.
**Why:** No npm dependency for one file; `document.fonts` makes the face available to both canvas and CSS, so the editing textarea uses the same font. Line height comes from the font's own `fontBoundingBoxAscent + Descent`.
**Rejected:** `@fontsource/instrument-sans` as a dependency; drawing with a fallback font first (text would jump when the real one arrives).

## 2026-10-01 — Text editing through a textarea owned by core/dom

**Decision:** The text tool only records where to type (`textEdit` in the store). `core/dom/textEditor.ts` opens a `<textarea>` there, sized and fonted to match the canvas at the current zoom, follows camera changes, and commits one shape on blur, Escape, or Ctrl/Cmd + Enter. Blank text creates nothing; trailing whitespace is dropped. Focus returns to the canvas afterwards. A click while editing only ends the edit. The textarea's static look is a CSS-module class passed in from `CanvasHost`.
**Why:** The browser handles caret, selection, IME, and accessibility for free. Keeping it out of React means no re-render per keystroke and no plumbing from React back into the editor.
**Known limitation:** the textarea wraps with the browser's rules (`overflow-wrap: break-word`), our layout with its own. Normal text matches (checked visually); very long words may shift slightly on commit. Agreed not to build a custom text input.

## 2026-10-01 — Select is the default tool; drawing returns to it

**Decision:** The select tool (V) is active at start. After a rectangle, ellipse, line, arrow, or text is created it becomes the selection and the select tool returns (`selectCreated`). The pen stays active so stroke after stroke can follow. (Agreed with the user.)

## 2026-10-01 — Selection, preview, and marquee live in the store, outside the document

**Decision:** `selectedIds: ReadonlySet<ShapeId>`, `preview: ReadonlyMap<ShapeId, Shape> | null`, and `marquee: Bounds | null` are store state. While a move is in progress the renderer draws `preview` versions in place of the document's; on release one `updateShapesCommand` (replace shapes, undo puts the old versions back) changes the document once.
**Why:** Same reasoning as the drawing `draft`: cancel only clears transient state, the spatial index isn't re-synced on every pointermove, and one gesture is exactly one command.
**Rejected:** writing to the document on every move (index sync per move, and cancel would need its own undo).

## 2026-10-01 — Select tool semantics

**Decision:** The press target decides the gesture: a shape (topmost hit), empty space inside the current selection's frame (drags the selection — so an unfilled rectangle can be dragged from its middle), or empty canvas (marquee). An unselected shape is selected on press so a drag moves it immediately. A click without a drag resolves on release: Alt cycles through `hitTestAll` (wrapping), Shift toggles, a plain click on part of a multi-selection narrows to that shape, empty canvas clears unless Shift is held. Cancel restores the shapes and the selection from before the gesture. Escape cancels a gesture first, otherwise clears the selection.
**Marquee:** "inside" compares against tight geometry bounds (`shapeGeometryBounds`: exact for rotated ellipses and rotated paths), so a shape that visibly fits is selected. "Touching" (Ctrl / ⌘) tests the real geometry: rotated-box SAT for rectangles and text, a circumscribed 48-gon for ellipses (never misses a real touch), segment clipping for paths. Selection updates live while dragging; Shift adds to the earlier selection.

## 2026-10-01 — Selection overlay in device pixels

**Decision:** The overlay is drawn after shapes with an identity transform. Line width is `max(1, round(devicePixelRatio))` device pixels; axis-aligned edges are snapped so the line covers whole pixels (odd widths on pixel centers). A multi-selection outlines each shape plus one axis-aligned frame. Selection blue (`#3d5afe`) is a constant until theme tokens arrive in M7.
**Why:** A world-space outline would thicken when zooming in and blur at fractional positions.

## 2026-10-01 — Arrow-key nudge is one command per key press, for now

**Decision:** Arrow keys move the selection 1 world unit (10 with Shift) via `updateShapesCommand('Nudge', …)`. Arrow keys are claimed even with nothing selected so the page never scrolls; Ctrl / ⌘ / Alt + arrow are left to the browser.
**Changed from the plan:** "a held key is one undo step" needs undo history, which arrives in M5; M5's history will merge consecutive nudges.
