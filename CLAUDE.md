# CLAUDE.md — Inkframe

Inkframe is a browser-based canvas design tool (like a small Excalidraw), built from scratch.
It is a portfolio project. Every line should be code a senior frontend engineer would be proud to explain in an interview.

Read `docs/PRD.md` before starting any milestone. If this file and the PRD disagree, stop and ask.

---

## 1. How to work in this repo

- The project ships in **three tiers** (see PRD): Tier 1 core editor, Tier 2 plugin sandbox, Tier 3 multiplayer + full design system. Never start work from a later tier until the current tier's gate passes.
- Work on **one milestone at a time** (M1–M13 from the PRD). Never start the next one on your own.
- Before writing code, post a short plan: files you will create or change, and why. Wait for a "go".
- Keep each change small and reviewable. If a change touches more than ~10 files, split it.
- After each milestone, stop and give a summary:
  - what you built
  - files changed
  - how to test it manually
  - any trade-offs or shortcuts taken
- Never add a new dependency without asking first. Say what it is, its size, and why we can't do it ourselves.
- Never delete or rewrite working code outside the task scope.
- If you are not sure, ask. Do not guess an API, a library version, or a browser behavior.
- Log every real design decision in `docs/decisions.md` (date, decision, why, alternatives rejected).
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:property` before saying a task is done. All must pass. Run `npm run bench` whenever canvas, index, or hit-test code changed.
- Record measured numbers (fps, hit-test latency, load times) in `bench/results/` as you go. They are portfolio evidence.

---

## 2. Architecture rules (do not break these)

```
src/
  core/      scene graph, camera, store, commands, tools, renderer, geometry, invariants — NO React
  ui/        React components (toolbar, panels, dialogs, error boundaries)
  design/    tokens + themes (Tier 1); shared components + Storybook (Tier 3)
  workers/   web workers (export, import parsing, spatial index)
  plugins/   plugin host API, permissions, sandbox bridge (Tier 2)
  collab/    Yjs bindings, awareness, cursors (Tier 3)
bench/       benchmark page and saved results
server/      y-websocket relay (Tier 3 only — no other backend)
```

- `src/core/` must **never** import React, React DOM, or anything from `src/ui/`. It is plain TypeScript.
- Data flows one way: **pointer event → Tool → Command → Store → Renderer**.
- Each tool is a small state machine (idle → pressing → dragging → idle). Any gesture can be cancelled, and cancelling restores the document exactly.
- Every change to the scene goes through a **Command** (`do()` and `undo()`). No direct mutation from UI.
- React never re-renders per shape. React reads only small UI state (active tool, selected style, panel open).
- The renderer draws in **one `requestAnimationFrame` per frame**, only when something is dirty.
- Heavy work (export, spatial index rebuild) runs in a **Web Worker**, never on the main thread.
- Shapes are plain serializable objects (no class instances in the store), so they work with JSON, IndexedDB, and Yjs.

---

## 3. TypeScript rules

- `tsconfig` must use `"strict": true`, plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`.
- **No `any`.** Use `unknown` and narrow it. If `any` is truly needed, add a comment explaining why.
- No `@ts-ignore`. Use `@ts-expect-error` with a reason, only as a last resort.
- No non-null assertion (`!`) unless a comment proves it can't be null.
- Prefer `type` for data shapes and unions; use `interface` only for things meant to be extended.
- Model shapes as a **discriminated union**:
  ```ts
  type Shape = RectShape | EllipseShape | LineShape | ArrowShape | PenShape | TextShape;
  // each has: id, type, x, y, rotation, style, zIndex
  ```
- Use exhaustive `switch` on `shape.type` with a `never` check in `default`.
- IDs are branded types: `type ShapeId = string & { readonly __brand: 'ShapeId' }`.
- Validate all outside data at the edge (imported JSON, postMessage, WebSocket) with **zod**. Never trust it as typed.
- The document format has a `version` field and a zod schema per version. Migrations are pure functions (`migrateV1toV2`), each with tests.
- Pure functions for geometry and math (`core/geometry/`), fully unit-tested.
- Named exports only. No default exports (except where a tool like Vite config requires it).
- Use `readonly` arrays and properties for data that must not change.
- Use `const` by default; `let` only when you reassign. Never `var`.
- Keep functions short (aim under 40 lines). If it's longer, split it.
- Name things by what they mean: `selectedShapeIds`, not `arr` or `data2`.

---

## 4. React rules

- Function components and hooks only. No class components.
- One component per file. File name matches component name: `StylePanel.tsx`.
- Props are typed with a `type ...Props`. No `React.FC`.
- Keep components small. If a component has more than ~150 lines, split it.
- Subscribe to the store with **selectors** so components re-render only when their slice changes.
- Don't use `useEffect` to sync state between React values. Derive it instead.
- `useEffect` is only for real side effects (subscribe/unsubscribe, canvas setup). Always clean up.
- Don't add `useMemo` / `useCallback` everywhere. Use them only when profiling shows a need, or for stable refs passed to the canvas.
- The canvas element is owned by one component (`CanvasHost`) that hands it to `core/` on mount and disposes it on unmount.
- No prop drilling more than 2 levels; use the store or a small context.
- Keys in lists are stable IDs, never array indexes.
- Use Radix primitives for menus, popovers, dialogs, tooltips, and sliders. Don't rebuild accessible widgets by hand.

---

## 5. Rendering, canvas, and performance rules

### Coordinate systems
- Three spaces: **world** (shape positions), **screen** (CSS pixels), **device** (backing-store pixels).
- Shapes are stored only in world space. Pointer events arrive in screen space.
- All conversions live in `core/camera.ts` (`worldToScreen`, `screenToWorld`). Never convert anywhere else.
- Round-trip must hold: `screenToWorld(worldToScreen(p))` equals `p` within 1e-9 at any zoom.
- Zoom stays anchored under the cursor. Clamp zoom to 10%–400%.

### High-DPI
- Backing store = CSS size × `devicePixelRatio`. Scale the context once per frame.
- Re-measure on resize and when DPR changes (listen with `matchMedia` for resolution changes).

### Render invalidation
- Changes mark the scene dirty. One `requestAnimationFrame` draws all pending changes.
- Full redraw by default. Use dirty rectangles only if profiling proves it helps, and log the decision.
- Ten changes in one frame = exactly one draw. An idle editor draws zero frames. No idle loop.

### Spatial index
- Uniform grid in world space. Each shape is indexed by its rotated bounding box.
- Every create, move, resize, rotate, delete, undo, and redo updates the index through one path: `index.update(shape)` / `index.remove(id)`.
- Tests check that after any command sequence the index equals a full rebuild.

### Hit-testing
- Index gives candidates; exact test per shape in its local space (un-rotate the point first).
- Top-most shape by z-order wins. Alt + click cycles to the shape below.
- Thin lines get a 6 screen-pixel hit tolerance at every zoom level.
- No fill → hit only on the stroke. Filled → hit on fill or stroke.
- Tests compare against a brute-force hit-test on 10,000 random points.

### Text
- Load fonts with the FontFace API before the first text render; redraw when fonts finish loading.
- Width from `measureText`, height from font metrics. Wrap at word boundaries; break long words by character.
- Same text must give the same bounds after reload and in export.

### Pointer and keyboard
- Use **pointer events** with `setPointerCapture` on pointerdown. Never separate mouse and touch handlers.
- End or cancel a gesture on `pointerup`, `pointercancel`, `lostpointercapture`, window `blur`, and Escape. A shape must never stay stuck in a dragging state.
- Drag starts after 3 screen pixels of movement. One gesture = one undo step.
- Resize: opposite handle is the anchor, Alt = from center, Shift = keep aspect ratio, minimum 1 world unit, dragging past the anchor stores a flip (no negative sizes).
- Rotate around the selection center; Shift snaps to 15°; store radians normalized to 0–2π.
- Snapping: 6 screen-pixel threshold, targets from the spatial index, guides shown while dragging. Ctrl / Cmd while dragging disables snapping.
- Shortcuts fire only when the canvas or toolbar has focus, never while typing. `preventDefault` on Ctrl + D, Ctrl + S, and Ctrl + wheel. Ctrl + wheel needs a non-passive listener.
- Pen pressure sets freehand width. Touch: one finger draws or selects, two fingers pan and zoom.

### Performance
- Never read layout (`getBoundingClientRect`) inside the draw loop. Cache it on resize.
- Avoid new allocations in hot paths (draw loop, pointermove). Reuse objects.
- Target: **60 fps while panning 1,000 shapes**, and record results at 1k / 5k / 10k shapes.
- Dev-only FPS meter and frame-time graph behind `?debug=1`.
- Save before / after numbers in `bench/results/` and note them in `docs/decisions.md`.

## 5b. Document integrity rules

Every successful command, undo, and redo must leave the document valid.

**Invariants** (checked by `core/invariants.ts` after every command in dev builds and in tests):
- Shape IDs are unique; every selected ID exists in the scene.
- z-order values are unique and contiguous.
- All numbers are finite (no NaN or Infinity); sizes are at least 1 world unit.
- The spatial index matches the scene.
- The document passes its zod schema.

**Rules:**
- **Transactional commands:** build all changes first, then apply in one step. If anything throws, apply nothing and report the error.
- **Undo / redo:** undo then redo restores the exact same document, including selection and the same shape IDs.
- **Autosave:** debounced 500 ms, a full snapshot in one IndexedDB transaction with a version counter. Keep the previous snapshot as a backup. An interrupted save must leave the last complete snapshot intact.
- **Storage unavailable:** show a banner, keep working in memory, and offer JSON export.
- **Migrations:** run older versions through migrations in order. Refuse unknown future versions with a clear message. Never half-load a file.
- **Limits:** 20 MB per import, 20,000 shapes, 10,000 points per freehand path (simplify larger paths). Parse imports in a worker with progress. Tell the user which limit was hit.

## 6. Styling rules

- Styling uses **CSS Modules** + **design tokens as CSS variables**. No inline styles, except values computed at runtime (like a position).
- All colors, spacing, radii, font sizes, shadows, and z-index values come from tokens in `src/design/tokens.ts`, generated into CSS variables. **No raw hex values or magic numbers in component CSS.**
- Spacing scale: 4px base (`--space-1` = 4px, `--space-2` = 8px, `--space-3` = 12px, `--space-4` = 16px, `--space-6` = 24px, `--space-8` = 32px).
- Keep CSS selector specificity low and flat: one class per element. No `!important`. No deep nesting.
- Use logical properties (`margin-inline`, `padding-block`) where it makes sense.
- Themes switch by setting `data-theme="light|dark"` on `<html>`; also follow `prefers-color-scheme` by default.
- The canvas renderer reads the same tokens (via a small `getThemeColors()` helper), so shapes and UI always match the theme.
- Respect `prefers-reduced-motion`: turn off non-essential transitions.

---

## 7. Design direction (and how to avoid AI slop)

### The idea

Inkframe is a tool for people who make things. **The user's drawing is the hero; the app's chrome stays quiet.**
The interface should feel like a precise instrument: calm, crisp, fast. Think drafting table, not marketing page.

The one memorable thing is the **feel of direct manipulation**: crisp selection handles, snappy transforms, a cursor that always shows what will happen. Spend design effort there. Keep everything else restrained.

### Palette (starting point — adjust in `tokens.ts`, log changes)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--color-canvas` | `#F3F5F8` | `#181B21` | Canvas background (cool, not cream) |
| `--color-surface` | `#FFFFFF` | `#22262E` | Toolbar and panels |
| `--color-ink` | `#1E2430` | `#E7EAF0` | Main text and icons |
| `--color-ink-muted` | `#5D6677` | `#9AA3B2` | Secondary text |
| `--color-line` | `#DDE1E8` | `#343A45` | Borders, dividers |
| `--color-select` | `#3D5AFE` | `#7B8CFF` | Selection, focus ring, active tool |
| `--color-danger` | `#C62F3B` | `#F06B74` | Destructive actions, errors |

- Selection blue is the **only** accent. Use it for selection, focus, and the active tool — nothing decorative.
- Shape colors in the style panel are a separate, user-facing palette (8–10 swatches) designed for drawing, not tied to the UI accent.

### Typography

- One UI family: **Instrument Sans** (self-hosted, with a system-ui fallback stack). Don't default to Inter.
- Type scale: 12 / 13 / 14 / 16 / 20 px. UI text is mostly 13px; panel titles 14px semibold.
- Numbers in inputs (x, y, width, rotation) use `font-variant-numeric: tabular-nums`. No monospace font for labels.
- Sentence case everywhere. No ALL-CAPS labels.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│ [file menu]        [tool bar: select R O L A P T]  [share]│  ← floating, slim
│                                                            │
│                                                 ┌────────┐ │
│                    canvas (full window)         │ style  │ │  ← only when
│                                                 │ panel  │ │    something is
│                                                 └────────┘ │    selected
│ [zoom − 100% +]                                  [undo/redo]│
└──────────────────────────────────────────────────────────┘
```

- The canvas fills the whole window. Toolbars float over it with a small gap from the edges.
- Panels appear only when they are useful (style panel shows when shapes are selected).
- Left-align text inside panels. Group controls with spacing, not with boxes inside boxes.

### Radius, borders, shadows

- Radius has hierarchy: 6px for buttons and inputs, 10px for floating toolbars and panels. Not one radius on everything.
- Floating surfaces get one subtle, layered shadow token (`--shadow-float`). Nothing else has a shadow.
- Borders are 1px `--color-line`. Use them only where they separate things.

### Motion

- Motion only answers the user's action: a popover opening, a toast appearing, a panel sliding in. 120–180ms, ease-out.
- No entrance animations on load. No hover animations on every element. No bouncing or wobbling.
- Transforms on the canvas are instant. Never animate a shape the user is dragging.

### Do NOT do these (common AI-generated tells)

- No gradient backgrounds, gradient text, or glassmorphism blur panels.
- No cream background with terracotta accent; no near-black with neon green accent.
- No identical rounded cards with the same grey shadow for everything.
- No ALL-CAPS tracked-out labels above headings, no "01 / 02 / 03" numbering unless it's a real sequence.
- No emoji in the UI. Use one consistent icon set (Lucide), 16px, 1.5px stroke.
- No `→` added to button text. No "✨ AI-powered" style decoration.
- No fake or filler copy ("Unleash your creativity!"). See writing rules below.
- No placeholder lorem ipsum in shipped screens.

---

## 8. Writing rules (UI copy)

- Name things by what users understand: "Export as PNG", not "Rasterize scene".
- Buttons say exactly what happens: "Export", "Delete shape", "Copy link". Not "Submit" or "OK".
- Keep the same word through a flow: the "Duplicate" button shows a "Duplicated" toast.
- Errors say what happened and how to fix it, with no apology:
  "This file isn't a valid Inkframe file. Export a new one and try again."
- Empty canvas shows one helpful line: "Pick a tool or press R to draw a rectangle."
- Tooltips include the shortcut: "Rectangle (R)".
- Sentence case, plain verbs, no filler.

---

## 9. Accessibility rules

- Every button and tool works by keyboard. Tab order is logical. Shortcuts are listed in a help dialog (`?`).
- Focus is always visible: 2px `--color-select` ring with an offset. Never remove outlines without a replacement.
- Icon-only buttons have an `aria-label`.
- Color contrast meets WCAG AA (4.5:1 for text, 3:1 for icons and UI parts).
- Tier 1 baseline: keyboard access, focus rings, ARIA labels, tokens and light/dark themes, contrast. Never skip these because "the design system comes later".
- Tier 3: the canvas gets a hidden, screen-reader-friendly list of shapes that mirrors the scene and allows selection.
- Toasts use an `aria-live="polite"` region.
- Run axe in Playwright tests; zero critical issues allowed.

---

## 10. Error handling and UX states

- Every async action has loading, success, and error states.
- Each panel, the plugin host, and export get their own error boundary. A failure shows an error in that area only; the canvas and document keep working.
- The app also has a top-level error boundary with a clear recovery message. The canvas must never go blank silently.
- Failed imports, storage errors, and network drops show a toast and keep the user's work.
- Autosave failures are surfaced, not swallowed. Never use an empty `catch {}`.
- Use a small `Result` type or typed errors in `core/`. Don't throw strings.

---

## 11. Plugin security rules (Tier 2)

The sandboxed iframe only blocks access to the host page. **The host must still validate and limit every plugin request.**

- **Isolation:** `sandbox="allow-scripts"` only. Never add `allow-same-origin`. Load plugin code via `srcdoc` or a blob URL so it gets an opaque origin.
- **Message checks:** every message must come from that plugin's iframe (`event.source`), pass its zod schema, use a known type, and match the protocol version. Drop and log anything else.
- **Capability permissions:** plugins declare needs in a manifest (`selection:read`, `shapes:create`, `shapes:update`, `notify`). The user approves on first run. Reject any call outside the granted list.
- **Resource limits:** 2 s timeout per call, 256 KB max message size, 50 calls per second, 500 shapes changed per call. Stop a plugin that floods the host.
- **Lifecycle:** load → handshake (declares API version) → ready → running → stopped. Support reload and crash restart. Stop a plugin that misses the handshake within 3 s.
- **API versioning:** refuse unsupported API versions with a clear message.
- **Revocation:** users can stop a plugin or revoke a permission at any time; remove the iframe and fail pending calls.
- **Undo:** everything one plugin call changes is one undo step, labeled with the plugin name.
- Plugins never get direct access to the store, the DOM, or the network through the host.
- Keep a **malicious test plugin** in `plugins/samples/` that tries every forbidden action. It must always be blocked while the editor keeps working.
- Never use `eval`, `new Function`, or `innerHTML` with untrusted content.

## 12. Multiplayer rules (Tier 3)

- The Yjs document is the source of truth for the scene in multiplayer mode; the store mirrors it.
- Commands write to Yjs inside a transaction tagged with the local user, so undo is per user (`Y.UndoManager` with tracked origins).
- Awareness carries only cursor, name, color, and selection. Never send the full scene through awareness.
- Show connection status: Connected / Reconnecting / Offline.
- Validate incoming updates like any outside input. Document invariants must still hold after every merge.
- The only server is a small y-websocket relay. Do not add a database, auth, or business logic to it.

---

## 13. Testing rules

Tests must prove the architecture works, not just that the app opens. Everything runs locally; collaboration tests start the relay on the test machine.

| Level | Tool | Must cover | Tier |
| --- | --- | --- | --- |
| Unit | Vitest | Coordinate round-trips, hit-test vs brute force, index vs full rebuild, every command's do / undo, schemas, migrations | 1 |
| Property-based | Vitest + fast-check | Random sequences of create, move, resize, rotate, delete, undo, redo; invariants after every step | 1 |
| Integration | Vitest + jsdom | Pointer events → tools → store; one draw per frame; cancelled drag restores state | 1 |
| End-to-end | Playwright | Draw, reload, select, edit, export, theme switch, keyboard-only flow, axe scan | 1 |
| Performance | Playwright + `bench/` | 1k / 5k / 10k shapes: frame times (median, p95), hit-test latency, memory | 1 |
| Security | Vitest + Playwright | Malformed, unauthorized, oversized, and flooding plugin messages; missed handshake | 2 |
| Collaboration | Playwright multi-context | 4 clients, concurrent edits, disconnect / reconnect, offline edits; all converge | 3 |

- Core coverage target: 90%+ lines for `src/core/`.
- Every Command has a do → undo → redo test that checks exact equality.
- Test behavior, not implementation details. No snapshot tests of large objects.
- A bug fix comes with a test that fails before the fix.
- Property tests that find a failure must save the seed so it can be replayed.

## 14. Code quality and Git

- ESLint (typescript-eslint strict + react-hooks + jsx-a11y) and Prettier. No disabled rules without a comment.
- Commit messages follow Conventional Commits: `feat(core): add rotate handle`, `fix(ui): focus ring on toolbar`.
- One logical change per commit.
- No commented-out code, no `console.log` left in committed code (use a small dev-only logger).
- Comments explain **why**, not what.

---

## 15. Definition of done (every milestone)

- [ ] Matches the milestone scope in `docs/PRD.md` — nothing more, nothing less
- [ ] `lint`, `typecheck`, `test`, `test:property`, and `e2e` all pass
- [ ] Document invariants hold; no invariant warnings in dev
- [ ] Works in light and dark themes
- [ ] Keyboard usable, focus visible, no axe critical issues
- [ ] No console errors or warnings in the browser
- [ ] Performance not worse than before; `bench` results saved when canvas code changed
- [ ] Decisions logged in `docs/decisions.md`
- [ ] Summary posted: what changed, how to test, trade-offs
- [ ] At a tier gate: README, write-up, and evidence numbers updated, then deploy