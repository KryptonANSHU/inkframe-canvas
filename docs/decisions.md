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

## 2026-10-01 — Resize = signed scale along the selection frame's axes

**Decision:** A handle drag becomes two signed scale factors along the frame's own axes (`resizeFromHandle`): the opposite handle (or, with Alt, the center) stays fixed, Shift keeps the aspect ratio (corners: the axis that moved further wins; edges: the other axis follows symmetrically), dragging past the anchor gives a negative factor (a flip), and no size drops below 1 world unit. `resizeShapes` applies it to every shape: centers move with the frame, and each shape scales in its own frame. A shape at a quarter-turn multiple from the frame scales exactly (axes swap at 90°/270°); any other angle gets a uniform scale, where a single-axis flip turns rotation θ into −θ (or π − θ) with the mirror baked into the shape's local geometry.
**Why:** One rule covers single shapes, rotated shapes, groups, and flips. Flips stay in the geometry (mirrored path points; boxes just stay positive), so no `flipX`/`flipY` flag exists for the renderer, hit-testing, or the index to honour. (User's choice.)
**Group rule:** a multi-selection containing text or a shape not at a quarter turn from the frame can only scale uniformly (user's choice) — it shows corner handles only.
**Verified:** fast-check properties over random rotations, handles, and drags: the anchor stays fixed and the dragged handle lands on the pointer (within 1e-3 units), sizes stay finite and ≥ 1, rotations stay in [0, 2π), and a uniform group scale multiplies every inter-shape distance by the same factor. A deliberately wrong sign in the center shift fails both position properties. 5,000-run stress pass clean.

## 2026-10-01 — Handles

**Decision:** 8 resize handles (8 px squares, turned with the frame) and a rotation handle 24 px above the top edge, all at fixed screen sizes. A lone line or arrow shows only its two end handles (no box): dragging an end moves just that end and returns an unrotated line. Lone text has side handles (wrap width, height re-measured) and corners (uniform: font size scales); no top/bottom handles because text height follows its content. Side handles hide when the frame is under 24 px on screen, so corners stay grabbable. Handles are hit within 8 px, checked before shapes. Resize cursors turn with the frame (nearest 45°). Handles hide during a drag or marquee.

## 2026-10-01 — All selection drags are one TransformGesture

**Decision:** Move, resize, rotate, and line-end drags are each a `TransformGesture` with a pure `apply(pointer, modifiers) → shapes` (`tools/transformGestures.ts`). The select tool previews `apply` on every move and commits the final result as one `updateShapesCommand` labelled Move / Resize / Rotate. A drag that ends where it started adds no command. Resize remembers where on the handle the press landed, so the handle never jumps to the pointer.
**Why:** The select tool stays a small state machine (pressing → transforming | marquee); each gesture's math is tested on its own.

## 2026-10-01 — Rotation

**Decision:** Rotation is around the selection frame's center; each shape's center orbits it and its rotation gains the same angle, normalized to [0, 2π). Shift snaps to 15°: a single shape snaps its final angle (so it lands on 0°, 15°, …), a group snaps the turn itself.

## 2026-10-01 — Alt + click cycles even on a handle

**Decision:** An Alt + click without a drag always cycles through the shapes under the pointer, even when it lands on a handle; Alt + drag on a handle still resizes from the center.
**Why:** Found by e2e: after Alt + click selects a shape, clicking the same spot again lands on that shape's edge-midpoint handle, which swallowed the second cycle.

## 2026-10-01 — Text can be typed before the font loads

**Decision:** The text tool always opens the textarea. If the text is committed before the font has loaded, the shape is created as soon as it does, so its height is still measured with the real font.
**Why:** Found by a flaky e2e test under load: the tool used to ignore clicks until `fontsReady`, so on a slow connection a click did nothing and the letters typed afterwards switched tools — a silent failure. A new e2e test holds the font back with `page.route` to prove the fix.

## 2026-10-01 — The canvas starts focused

**Decision:** `createEditor` focuses the canvas on mount with `focus({ preventScroll: true, focusVisible: false })`. Shortcuts stay canvas-only, as CLAUDE.md requires.
**Why:** Reported by the user: shapes "vanished on release" and took 2–3 tries. Nothing had focus on load, so the first tool key was ignored and the drag that followed was a select-tool marquee, which disappears on release. `focusVisible: false` avoids a ring around the whole window for a focus the user didn't move; browsers without the option show the ring, which is still correct.
**Alternatives rejected:** listening for keys page-wide (skipping text fields): fixes the same bug but breaks the "canvas or toolbar has focus" rule, and would steal Space and Enter from future toolbar buttons. Leaving the active tool invisible until M7 remains a known gap: after drawing a rectangle, ellipse, line, or arrow, the next drag is a selection (the cursor is the only cue). The M7 toolbar fixes that.

## 2026-10-01 — Editing existing text

**Decision:** Double-clicking text with the select tool reopens the same textarea, holding the text, matched to the shape's width, font size, and rotation; the shape itself isn't drawn meanwhile. The commit is one command: `Edit text` (re-measured height) when it changed, nothing when it didn't, and `Delete text` when it was cleared. The text is deselected while editing so handles don't sit on the textarea, and selected again afterwards. `textEdit` gained `original: TextShape | null` (null for new text).
**Why:** Clearing the text and keeping an empty shape would leave an invisible, selectable box. Deleting needs `deleteShapesCommand` now; M5 adds the Delete key and its UI on top of it.
**Alternatives rejected:** a separate editor for existing text (two code paths for one textarea).

## 2026-10-01 — Pen pressure sets one width per stroke

**Decision:** The pen's stroke width is the default width × 2 × the stroke's average pressure, clamped to 0.25–2× the default. A mouse reports 0.5, so mouse strokes keep the default width.
**Why:** Meets the PRD with no change to the shape format or renderer.
**Alternatives rejected:** width varying along the stroke (per-point pressure, drawn as a filled outline): closer to real ink but ~3× the work and a new point format; a candidate for later.

## 2026-10-01 — Every pointer move, only for the pen

**Decision:** Tools may set `wantsEveryMove`; while such a gesture runs, `pointermove` replays `getCoalescedEvents()` (falling back to the event itself where unsupported). Only the pen sets it.
**Why:** Browsers deliver one move per frame, so fast strokes turned angular. The select tool and shape tools only need the latest position; replaying every move would recompute previews for nothing.

## 2026-10-01 — Touch: one finger gestures, two fingers pinch

**Decision:** A touch tracker in `input/pinch.ts` sits in front of the tools. The first finger is an ordinary gesture; a second finger cancels it (so a half-drawn shape vanishes) and the pair pans and zooms. The camera is computed from the pinch's start every move (`zoomAt` at the start midpoint, then `panBy` to the current midpoint), so nothing drifts. A third finger is ignored; when one finger of a pinch lifts, the other does nothing until it lifts too.
**Why:** Matches the PRD and common touch canvases; computing from the start avoids accumulating rounding over a long pinch. A property test checks the world point between the fingers stays between them.
**Alternatives rejected:** letting the leftover finger continue as a pan (surprising jumps when it was mid-pinch).

## 2026-10-01 — Ctrl / ⌘ + D and S are claimed now

**Decision:** The controller claims Ctrl / ⌘ + D and S (not with Alt), so `preventDefault` stops the browser from bookmarking or saving the page, before duplicate (M5) and save (M6) exist.
**Why:** PRD keyboard row; claiming them early means the browser never gets them in between.

## 2026-10-01 — Text tests deselect only once the text is drawn

**Decision:** e2e tests that commit text wait until it is drawn before pressing Escape to deselect (`deselectOnceDrawn`).
**Why:** Root cause of the "long text wraps" flake (about 1 run in 100, and more often in the new edit test). Text committed in the first few hundred ms after load waits for the store's `fontsReady`, which trails the FontFace's `loaded` status. An Escape in that window finds nothing selected; the text then appears selected and its handles count as ink. Logging showed the second Escape went unclaimed in every failure. A person can't press Escape that fast after load, so the app is unchanged.

## 2026-10-01 — Undo history lives in the store, with the selection

**Decision:** `executeCommand` records every command as a history entry holding the selection before and after it (`select` option sets the after-selection in the same store update). `undo` / `redo` replay the command and restore the matching selection. New commands clear the redo stack; history keeps the last 200 steps. A `group` option joins a command to the previous step: a held arrow key's repeats (`KeyboardEvent.repeat`) join the first press, so holding an arrow key is one undo step. Edit shortcuts do nothing mid-gesture (but are still claimed).
**Why:** The PRD requires undo / redo to restore the selection exactly. Recording it at execute time is the only point where both sides are known. Merging by key repeat is deterministic, unlike a time window.
**Alternatives rejected:** a history object outside the store (every caller would need a second handle); merging nudges within a time window (flaky to test, surprising when two separate taps merge).

## 2026-10-01 — Delete, duplicate, copy, paste

**Decision:** Delete / Backspace delete the selection; undo restores the same shapes with the same IDs and draw order. Ctrl / ⌘ + D duplicates with new IDs, 10 units right and down, on top, selected. Ctrl / ⌘ + C / V use an in-editor clipboard; each paste lands 10 units further than the last, and copying again starts over. Ctrl / ⌘ + Shift + Z and Ctrl + Y redo.
**Why:** PRD feature table. The system clipboard needs permission prompts and async reads, and cross-app paste needs the M6 file format anyway.
**Alternatives rejected:** `navigator.clipboard` now (permission prompts for an in-app copy); pasting at the pointer (needs a tracked pointer position; offset pastes are what the PRD asks for).

## 2026-10-01 — Invariants checker

**Decision:** `core/invariants.ts` checks: unique IDs and an order matching the scene, zIndex equal to draw position, selected IDs exist, every number finite, rotation in [0, 2π), box shapes (rectangle, ellipse, text) at least 1 × 1, pen strokes at least 2 points, and the spatial index equal to a full rebuild. Dev builds check after every document or selection change and report violations as errors; e2e tests fail on any console error, so every e2e run also checks invariants. A fast-check test runs 1,000 random sequences of create, select, move, resize, rotate, nudge, delete, duplicate, copy, paste, undo, and redo, checking invariants after every step, that undoing everything gives the empty document, and that redoing it all gives back the same document and selection.
**Why:** PRD 1D. The PRD's "passes its zod schema" check joins in M6: zod is a new dependency and the schema belongs with the versioned file format.
**Resolved from M3:** "at least 1 world unit" applies to stored sizes. Paths have none (a straight horizontal line is legitimately 0 tall), so lines may be any length; a zero-length line stays selectable through the hit tolerance.

## 2026-10-01 — Sides under 1e-9 units are flat when resizing

**Decision:** Resizing treats a frame side thinner than 1e-9 world units like a zero side: that axis keeps scale 1.
**Why:** Found by the history property test (the counterexample is kept as a unit test in `resize.test.ts`): a line 5e-324 tall made `1 / size` overflow to Infinity, and the resize wrote NaN into the shape. Near-zero sides also come from float noise after rotating a flat line.

## 2026-10-01 — zod, and the file format

**Decision:** Added zod 4.6.5 (MIT, no dependencies), approved by the user. Files are `{ format: "inkframe", version: 1, shapes: [...] }` with shapes bottom to top; zIndex is renumbered from that order on open. `readFile` checks the envelope, refuses newer versions with a message, runs migrations (`MIGRATIONS[n]` upgrades n → n + 1; empty while v1 is the only format), then validates every shape with progress. Limits: 20 MB, 20,000 shapes (refused, naming the limit); pen strokes over 10,000 points are simplified to fit. Colors must be hex: they end up in exported SVG markup, so anything else could inject it. Unknown fields are dropped; rotation is normalized rather than refused. The invariants checker validates shapes against the same strict schema.
**Why:** PRD 1D. One schema for files and for the document means the document can always be saved and opened again; a fast-check property checks save → JSON → open is exact.
**Bundle:** zod stays out of the main bundle (60.6 KB gzipped before and after). The dev-only invariants checker is loaded with a dynamic import, because bundlers can't drop module-level `z.object(...)` calls; production reads files in a worker (M6b), the only place zod runs. Bundling it in the main thread would cost about 26 KB gzipped.
**Alternatives rejected:** hand-written validators (two sources of truth for every shape type).

## 2026-10-01 — Simplifying long paths: Visvalingam–Whyatt

**Decision:** Paths over the point limit drop, one at a time, the point whose triangle with its neighbors has the least area, until they fit (heap-based, O(n log n)).
**Why:** Fits the limit exactly with no tolerance search, and removes the least visible detail first.
**Alternatives rejected:** Ramer–Douglas–Peucker with a growing tolerance: O(n²) on paths where every point matters (a 30,000-point zigzag took over 15 s in a test).

## 2026-10-01 — Autosave and recovery

**Decision:** `startPersistence` (core, DOM-free) restores the newest readable snapshot on start (current, then backup), then saves each document change 500 ms after the last one. Snapshots hold the same JSON as a saved file plus a counter that keeps rising across sessions. The IndexedDB adapter writes in one transaction: the old current becomes the backup and the new one becomes current, so a save cut short by a closed tab leaves the last complete snapshot. Saves never overlap. A pending save is flushed when the tab is hidden. If storage fails to open or save, `autosave` becomes `unavailable`: a banner says so and offers "Save a copy", and the editor keeps working in memory. A restored snapshot doesn't replace anything drawn while it was loading.
**Why:** PRD 1D. Snapshots reuse the file format, so recovery runs through the same validation and migrations as opening a file. Writes are issued from the read's success callback rather than after an `await`, so the transaction is certainly still active.
**Alternatives rejected:** the `idb` wrapper (a dependency for ~60 lines); fake-indexeddb for unit tests (autosave logic is tested over an in-memory storage, and real IndexedDB in e2e, including a reload).

## 2026-10-01 — Open and Save

**Decision:** Open (file bar or Ctrl / ⌘ + O) reads the file in a worker with progress, measures text heights again with the real font (heights in a file are untrusted), and replaces the drawing as one undoable step. Save as JSON (Ctrl / ⌘ + S) downloads `inkframe-YYYY-MM-DD.json`. Files over 20 MB are refused before being read. Errors show in the file bar with the reason. The file bar is a stop-gap styled with CSS system colors until the M7 toolbar.
**Why:** An undoable Open means opening the wrong file never loses work, with no confirm dialog. zod runs only in the file worker: the reading code lives in `readFile.ts`, which the main thread never imports, so the main bundle grew by only ~3 KB gzipped for persistence and its UI.
**Alternatives rejected:** a confirm-before-replace dialog (an extra click every time, and still loses work when confirmed by habit).

## 2026-10-01 — PNG and SVG export in a worker

**Decision:** Export PNG / SVG (file bar) exports the selection, or the whole drawing when nothing is selected, with 16 units of padding around the shapes' ink. A worker does the work. PNG draws through the editor's own renderer on an OffscreenCanvas at 2×, scaled down for drawings past browser canvas limits (16,384 px a side, 16.7 M px in all, Safari's caps). SVG mirrors the renderer shape by shape: same centering and rotation, paths, caps, joins, and text lines, with the font embedded as base64 `@font-face`. The worker loads the text font into its own font set, so text wraps exactly as on the canvas. Transparent background.
**Why:** PRD feature table. Reusing the renderer means a PNG can't drift from the canvas. Text is escaped and colors are schema-checked hex, so user content can't inject markup into the SVG.
**Alternatives rejected:** rendering PNGs on the main thread (blocks input on large drawings); SVG text without the embedded font (other viewers would substitute a font and break lines differently).
**Note:** Workers need `FontFace` in workers (Chrome, Firefox, and Safari 16.4+ as far as we know; not verified on Safari). If it is missing, exports with text fail with a message instead of silently using another font.

## 2026-10-01 — Copy and paste through the system clipboard

**Decision:** Copy, cut, and paste use the browser's `copy` / `cut` / `paste` events while the canvas has focus: copied shapes go on the clipboard as Inkframe file JSON, and pasted Inkframe JSON is validated in the file worker, then added with new IDs, offset and selected. Pasting the same shapes again cascades the offset; shapes from elsewhere (another tab) start one offset away. Ctrl / ⌘ + C / X / V are no longer claimed on keydown, since claiming them would stop those events. Other pasted text is ignored for now. Replaces the in-editor clipboard from M5.
**Why:** Clipboard events grant access without a permission prompt (unlike `navigator.clipboard.readText`), and pasting into another tab is what users expect. Reusing the file format and its worker validation means pasted data is held to the same rules as opened files.

## 2026-10-01 — Design tokens, themes, and error boundaries (M7, part a)

**Decision:** `src/design/tokens.ts` holds every color (light and dark), shadow, space, radius, font size, z-index, duration, and the focus ring. A small Vite plugin (`vite.config.ts`) serves them as CSS variables from a virtual module, generated on each build, so the CSS can't drift from the tokens. Dark applies when the system prefers it unless `<html data-theme="light">`, and always with `data-theme="dark"`; reduced motion zeroes the durations. The canvas reads the same tokens through `core/theme.ts`, with the store's `theme` kept in step with the page (`dom/themeMode.ts`). Shape colors stay stored as their light value (files and exports never depend on the theme), and the dark theme swaps palette colors for display; the default ink becomes light ink on the dark canvas. React error boundaries contain failures to the file bar, the banner, or (last resort) the whole app, with a recovery message; the render loop reports a failing draw once instead of failing silently. Programmatic focus returns (after a text edit or a file bar click) skip the focus ring; Tab still shows it.
**Why:** CLAUDE.md §6 (tokens as CSS variables, `data-theme`, `prefers-color-scheme`, renderer on the same tokens) and §10 (error boundaries, never a silently blank canvas). Storing light values keeps M6's file format unchanged.
**Alternatives rejected:** a checked-in generated `tokens.css` with a drift test (two artifacts for one source); reading CSS variables back with `getComputedStyle` in the renderer (string parsing per theme change, and unavailable in the export worker); a CSS `invert()` filter for dark mode (shifts every hue, including user colors and the selection blue); `react-error-boundary` (a dependency for ~30 lines).
**Note:** `ErrorBoundary` is the codebase's one class component; React has no hook for catching render errors.

## 2026-10-02 — M7b core: tool lock, style, arrange, zoom, and input fixes

**Decision:**

- **Tool lock (Q):** while locked, drawing keeps the tool and selects nothing, so shape after shape can follow. It's off by default, so a shape still returns to Select (the user picked this over always-sticky tools).
- **Style:** `applyStyle` changes the selection as one undo step. Fill only reaches rectangles and ellipses; a slider drag joins one step through a history group. `selectionStyle` reports shared or mixed values for the panel.
- **Palette:** shapes store the light value; `tokens.ts` pairs each light value with a dark counterpart that the dark canvas draws, so drawings read well in both themes.
- **Arrange:** forward and backward move each selected shape past one unselected neighbor (the selection keeps its order and gaps); front and back move it to an end. Shortcuts: Ctrl / ⌘ + ] / [, with Shift for front / back.
- **Zoom:** in and out step through preset levels (10–400%) around the view's center; Ctrl / ⌘ + 0 resets to 100%, Shift + 1 fits the drawing.
- **Shortcuts:** tool and edit shortcuts also work while a toolbar or panel control has focus, but not keys a control handled, and never while typing.
- **Input fixes** for strokes that "vanished" on the user's machine (not reproducible in headless Chromium):
  - only a stylus (`pointerType: 'pen'`) sets pen width from pressure; trackpads can report click force, which made mouse strokes hairline-thin;
  - canvas `pointerdown` prevents the default action (no text selection or native drag can cancel a stroke) and moves focus itself.
    **Why:** PRD 1A (style panel, layers, zoom), CLAUDE.md (shortcuts with toolbar focus), and the user's reports.

## 2026-10-02 — M7b UI: toolbar, menu, style panel, zoom, history, toasts, shortcuts

**Decision:** The PRD layout, on design tokens and Radix primitives (`radix-ui` 1.6.7) with Lucide icons (`lucide-react` 1.49.0), both approved by the user.

- **Top row:** the main menu (top left: Open, Save as JSON, Export selection or drawing as PNG / SVG, theme System / Light / Dark, Keyboard shortcuts) and the toolbar (top center: seven tools plus the Q lock).
- **Style panel:** appears on the right only while something is selected. It has stroke and fill swatches drawn as they look in the current theme, a four-step stroke width, an opacity slider whose drag is one undo step, and layer order.
- **Bottom row:** zoom (bottom left: −, a level menu, +) and history (bottom right: undo, redo, shortcuts).
- **Elsewhere:** the empty-canvas hint, toasts for file progress and every reported error, and the `?` shortcuts dialog. Each area has its own error boundary.
- **Theme:** the choice is stored in `localStorage` and applied by an inline script before first paint, so dark mode never flashes light.
  **Details that matter:**
- **Focus:** a pointer click on any control hands focus back to the canvas, while keyboard users stay in the toolbar, which has arrow-key roving focus.
- **Selected states:** styled from `aria-checked` / `aria-pressed`, because a Radix tooltip trigger overwrites `data-state` on the same element.
- **Shared looks:** come through CSS-module `composes`, so each element keeps one class. In Vite dev, a composed file's edits can leave stale copies until the dev server restarts; production builds are correct.
  **Bundle:** the main JS grew from 65.3 to 114.0 KB gzipped (+48.7 KB, above the 30–40 KB estimate). Lazy-loading the shortcuts dialog saved under 1 KB (it shares focus and scroll handling with the menus), so it was reverted; bundle work is M8's.
  **Alternatives rejected:** a separate layers list panel (the PRD asks for order controls; a list joins the Tier 3 shape list); a free-form color picker (any color would have no tuned dark-theme counterpart; a curated palette reads well in both themes).

## 2026-10-02 — M7c: snapping, select all, accessibility checks

**Decision:**

- **Snapping:** moving a selection snaps its box's edges and center to nearby shapes' edges and centers. The threshold is 6 screen pixels, each axis snaps on its own to the closest line, and targets come from the spatial index within 1,200 screen pixels, excluding the moving shapes. Guide lines are drawn in selection blue, one per aligned line, spanning every shape on it. Ctrl / ⌘ held moves freely. Guides are transient store state, like `preview`, cleared on release and cancel.
- **Select all:** Ctrl / ⌘ + A, as plain UI state (not an undo step).
- **Accessibility checks:** `@axe-core/playwright` (dev only, approved) scans the empty canvas, a selection with the style panel, the open menu, and the shortcuts dialog in both themes, failing on any critical or serious WCAG 2.1 A/AA issue. The scans run with reduced motion, so colors are measured settled, not mid-animation.
- **Keyboard-only test:**
  - open a file, select all, recolor through the style panel, and nudge, duplicate, delete, and undo;
  - check the saved JSON exactly;
  - switch to the dark theme through the menu, then open and close the shortcuts dialog, with focus back on the canvas.
    **Fixes the scans and the keyboard test found:**
- **Modal menus:** Radix's modal dropdown set `aria-hidden` on the app while its focusable controls stayed reachable (axe `aria-hidden-focus`), so both dropdown menus are now non-modal, as a menu button needs no focus trap.
- **Dialog focus:** the shortcuts dialog didn't take focus (Escape and Tab still acted on the canvas behind it); it now focuses itself through a ref.
- **Lingering tooltip:** a tooltip opened by keyboard focus on a menu trigger outlived the menu and swallowed the next Escape, so menu triggers have no tooltip (the menu explains itself).
  **Not covered:** snapping while resizing or drawing (the PRD names moves; it can follow); a measured Lighthouse score (axe covers the automated checks; Lighthouse joins the Tier 1 gate's manual pass).
