# PRD: Mini Canvas Design Tool

Oct 1, 2026 · @Anshu

## Overview and goals

We are building a small, browser-based design tool (like a mini Excalidraw) from scratch, with our own scene graph on the raw Canvas 2D API. The goal is a portfolio project that proves founding-level frontend skills for roles like Figr's Frontend Engineer.

The project ships in three tiers, and each tier must be solid before the next starts:

| Tier | What ships | Why it matters |
| --- | --- | --- |
| 1. Must ship | Core editor, measurable performance, document integrity, baseline accessibility, public deploy | A complete, usable product on its own |
| 2. Technical differentiator | Secure plugin sandbox with permissions, lifecycle, and security tests | Shows browser internals and system boundaries |
| 3. Advanced extension | Real-time multiplayer and the full design system (Storybook, versioned components) | Added only once Tiers 1 and 2 are stable |

Tier 1 goes live publicly before Tier 2 starts, so there is always a working demo to share.

**Success means:**

- It runs smoothly at 60 fps with 1,000+ shapes on screen.
- Every feature works locally first, then on a public live link.
- Each key design choice is explained in the README, so a reviewer can see how we think.
- The project maps clearly to the JD: frontend system design, browser internals, iframes + postMessage, web workers, design systems, accessibility, and editor-grade UI.

## Tech stack

React + TypeScript + Vite for the app shell, and our own scene graph drawn with the raw Canvas 2D API. React owns the UI around the canvas (toolbar, panels, menus); it never re-renders per shape.

| Area | Choice | Why |
| --- | --- | --- |
| App shell | React 18 + TypeScript (strict) + Vite | Fast dev loop, typed code, matches JD |
| Canvas rendering | Raw Canvas 2D API, own scene graph | Shows browser internals and editor-grade skills |
| Editor state | Zustand (small store) outside React | Canvas reads state without React re-renders |
| Undo / redo | Command pattern (do / undo per action) | Clear, testable history |
| Styling | CSS Modules + design tokens (CSS variables) | Phase 2 design system builds on this |
| UI primitives | Radix UI (headless) | Accessible menus, dialogs, tooltips |
| Heavy work | Web Worker (export, hit-test index) | Keeps main thread free |
| Plugins (Phase 2) | Sandboxed iframe + postMessage | Matches "Runtimes and IPC" in JD |
| Multiplayer (Phase 2) | Yjs (CRDT) + y-websocket server | Conflict-free real-time edits |
| Testing | Vitest (unit) + Playwright (end-to-end) | Confidence before deploy |
| Lint / format | ESLint + Prettier | Clean, consistent code |
| Deploy | Vercel (frontend) + Render or Fly.io (WebSocket server) | Free tiers, easy live links |

**Also used:** zod for validating all outside data (imported JSON, plugin messages, WebSocket updates), fast-check for property-based tests, and Playwright's tracing plus a small in-app benchmark harness for performance runs. No backend is needed except a tiny y-websocket relay in Tier 3.

**Key decision:** the editor core (scene graph, tools, commands) is plain TypeScript with no React imports. This keeps it fast, testable, and easy to explain in interviews.

## Architecture

The editor core is plain TypeScript and owns the scene, the history, and the canvas. React only draws the panels around it, so drawing stays fast.

&#91;embedded content: app architecture · UI shell, editor core, side services\]

Each pointer event goes to the active Tool, which creates a Command. The Command updates the Store, and the Renderer redraws once in the next animation frame.

**Folder structure:**

```
src/
  core/        scene graph, camera, store, commands, tools, renderer, invariants (no React)
  ui/          React components: toolbar, panels, dialogs, error boundaries
  design/      tokens and themes (Tier 1); shared components and Storybook (Tier 3)
  workers/     export, import parsing, and spatial-index worker
  plugins/     host API, permissions, sandbox bridge, sample plugins (Tier 2)
  collab/      Yjs bindings, awareness, cursors (Tier 3)
bench/         benchmark page and saved results
server/        y-websocket relay (Tier 3)
docs/          PRD.md, decisions.md, write-up.md
```

## Tier 1 (must ship): core editor

Tier 1 delivers a complete single-user editor that saves in the browser, performs well, and keeps the document correct. It is done when every item below passes locally and the app is live.

### 1A. Features

| Feature | What it does | Done when |
| --- | --- | --- |
| Infinite canvas | Pan (space + drag, trackpad) and zoom (Ctrl + wheel, pinch) around the cursor | Zoom stays centered on cursor from 10% to 400% |
| Shapes | Rectangle, ellipse, line, arrow, freehand pen, text | Each tool has a keyboard shortcut (R, O, L, A, P, T) |
| Selection | Click, Shift + click, and drag a marquee box | Follows the selection rules in 1C |
| Transform | Move, resize (8 handles), rotate | Follows the transform rules in 1C |
| Snapping and guides | Snap to other shapes' edges and centers, with guide lines; hold Ctrl / Cmd to turn off | Built after the core transforms work |
| Style panel | Stroke color, fill color, stroke width, opacity | Changes apply to all selected shapes as one undo step |
| Layers | Bring forward / send back, z-order | Order is kept after reload |
| Undo / redo | Ctrl + Z / Ctrl + Shift + Z for every action | Meets the invariants in 1D |
| Copy / paste / duplicate | Ctrl + C, Ctrl + V, Ctrl + D | Pasted shapes offset slightly |
| Delete | Delete / Backspace | Undo brings shapes back with the same IDs |
| Persistence | Autosave to IndexedDB, plus export / import as versioned JSON | Meets the recovery rules in 1D |
| Export | Selection or whole canvas as PNG and SVG | Runs in a web worker |
| UX states | Empty canvas hint, loading state, clear error toasts | No action fails silently |
| Baseline accessibility | Keyboard access to all tools, visible focus, ARIA labels, design tokens with light / dark theme | Lighthouse accessibility 90+, no axe critical issues |

### 1B. Rendering engine

The renderer must draw the scene correctly at every zoom level and stay at 60 fps with 1,000 shapes. Each subsystem below has a rule that tests can check.

| Subsystem | Specification | Correctness check |
| --- | --- | --- |
| Coordinate systems | Three spaces: world (shape positions), screen (CSS pixels), and device (backing-store pixels). One camera (x, y, zoom) converts between them in `core/camera.ts` only. Shapes are stored in world space; pointer events arrive in screen space | `screenToWorld(worldToScreen(p)) === p` within 1e-9, at any zoom |
| High-DPI | Backing store = CSS size × `devicePixelRatio`; the context is scaled once per frame. Re-measure on resize and when DPR changes (moving between monitors) | Lines stay 1 device pixel sharp on 1x, 2x, and 3x screens |
| Render invalidation | Changes mark the scene dirty; one `requestAnimationFrame` draws all pending changes. Full redraw by default; dirty rectangles only when profiling proves it helps (logged in decisions). Camera moves always do a full redraw | Ten changes in one frame cause exactly one draw; an idle editor draws zero frames |
| Spatial index | Uniform grid keyed by world-space cells. Each shape is indexed by its rotated bounding box. Update on create, move, resize, rotate, delete, undo, and redo through one `index.update(shape)` path | After any command sequence, the index matches a full rebuild exactly |
| Hit-testing | Index gives candidates; exact test per shape in its local space (point is un-rotated first). Top-most shape wins by z-order. Thin lines get a hit tolerance of 6 screen pixels at any zoom. Shapes with no fill are hit only on their stroke; filled shapes on fill or stroke | Matches a brute-force test on 10,000 random points |
| Text | Fonts load with the FontFace API before first text render; text redraws when fonts finish loading. Width from `measureText`, height from font metrics. Wrap at word boundaries inside a fixed width; long words break by character. Bounds cover all lines | Same text gives the same bounds after reload and in export |

The renderer never reads DOM layout inside the draw loop, and hot paths (draw, pointermove) avoid new allocations where possible.

### 1C. Interaction model

Every interaction is a small state machine (idle → pressing → dragging → idle) owned by the active tool. Any interaction can be cancelled, and cancelling always returns the document to its state before the gesture.

| Interaction | Behavior |
| --- | --- |
| Selection | Click selects the top-most hit shape. Alt + click cycles to the shape below at the same point. Shift + click adds or removes. Click on empty canvas or Escape deselects. Marquee selects shapes fully inside the box; holding Ctrl selects shapes it touches |
| Dragging | `setPointerCapture` on pointerdown, so release outside the canvas or window still ends the drag. Drag starts after 3 screen pixels of movement. Escape, `pointercancel`, `lostpointercapture`, or window blur cancels and restores the original positions. One drag = one undo step |
| Resizing | Opposite handle is the anchor; Alt resizes from the center; Shift keeps aspect ratio. Minimum size 1 world unit. Dragging past the anchor flips the shape and stores the flip, instead of a negative width |
| Rotation | Rotates around the selection's center. Shift snaps to 15° steps. Angle stored in radians, normalized to 0–2π |
| Multi-selection | One shared bounding box (axis-aligned for mixed rotations). Move, resize, and rotate apply to the group as one command. Align and distribute act on the selection |
| Keyboard | Shortcuts work only when the canvas or toolbar has focus, never while typing in an input or editing text. Ctrl + D, Ctrl + S, and Ctrl + wheel call `preventDefault` so the browser doesn't bookmark, save, or zoom the page. Arrow keys nudge 1 unit, Shift + arrow 10 units |
| Pointer types | Mouse, pen, and touch all use pointer events. Trackpad two-finger scroll pans; pinch (Ctrl + wheel) zooms. Pen pressure sets freehand line width. Touch: one finger draws or selects, two fingers pan and zoom |
| Snapping | Snaps to edges and centers of nearby shapes within 6 screen pixels, with guide lines shown during the drag. Holding Ctrl (Cmd on Mac) while dragging disables snapping, so it never clashes with Alt-resize. Snap targets come from the spatial index, not a scan of all shapes |

### 1D. Document integrity and recovery

Document integrity is an engineering goal: every successful command, undo, and redo must leave the document valid.

**Invariants (checked in tests and in dev builds after every command):**

- Every shape ID is unique, and every ID in the selection exists in the scene.
- z-order values are unique and contiguous.
- All numbers are finite (no NaN or Infinity); sizes are at least 1 world unit.
- The spatial index matches the scene.
- The document passes its zod schema.

**Rules:**

- **Transactional commands:** a command builds its changes first, then applies them in one step. If anything throws, nothing is applied and the error is reported.
- **Undo / redo:** undo then redo restores the exact same document, including selection and every property. Undo restores the same shape IDs, not new copies.
- **Autosave:** saves are debounced (500 ms) and written as a full snapshot in one IndexedDB transaction, with a version counter. A save cut off by a closed tab leaves the last complete snapshot intact. The previous snapshot is kept as a backup.
- **Storage unavailable:** if IndexedDB fails (private mode, quota full), show a clear banner, keep working in memory, and offer JSON export so no work is lost.
- **Versioned format:** every file has a `version` field. Older versions run through migration functions in order (v1 → v2 → v3). Unknown future versions are refused with a clear message, never half-loaded.
- **Large documents:** limits of 20 MB per import, 20,000 shapes, and 10,000 points per freehand path. Larger paths are simplified on import. Imports are parsed in a worker and show progress; files over the limits are refused with a message saying which limit was hit.
- **Error boundaries:** each panel, the plugin host, and export have their own error boundary. A failure shows an error in that area only; the canvas and document keep working.

## Tier 2 (technical differentiator): plugin sandbox

Plugins run untrusted code in a sandboxed iframe, and the host validates and limits every request. The iframe only blocks access to the host page; the host is still responsible for making every plugin action safe.

| Area | Requirement |
| --- | --- |
| Isolation | `sandbox="allow-scripts"` only, never `allow-same-origin`. Plugin code loads through `srcdoc` or a blob URL, so it gets an opaque origin even on the same static site |
| Message checks | Each message must come from that plugin's iframe (`event.source`), pass its zod schema, use a known message type, and match the protocol version. Anything else is dropped and logged |
| Capability permissions | A plugin's manifest lists what it needs: `selection:read`, `shapes:create`, `shapes:update`, `notify`. The user approves on first run. Calls outside the granted list are rejected |
| Resource limits | Each call times out after 2 s. Messages over 256 KB are rejected. Max 50 calls per second and 500 shapes changed per call; a plugin that floods the host is stopped |
| Lifecycle | load → handshake (plugin declares its API version) → ready → running → stopped. Supports reload and restart after a crash. A plugin that misses the handshake within 3 s is stopped |
| API versioning | The host supports a list of API versions. A plugin asking for an unsupported version is refused with a clear message |
| Revocation | The plugin panel shows running plugins and their permissions. The user can stop a plugin or revoke a permission at any time; the iframe is removed and pending calls fail |
| Undo | Everything a plugin changes is one undo step, labeled with the plugin's name |

**Sample plugins:** "Align and distribute", "Random color palette", and "Generate grid of shapes", plus one **malicious test plugin** that tries to read the host page, call APIs it wasn't granted, send oversized messages, and flood requests. Every attempt is rejected, and the editor keeps working. This is the main demo for the security story.

**Done when:** all four plugins behave as above, and the security tests in the testing matrix pass.

### 2B. Editor extras

| Feature | What it does | Done when |
| --- | --- | --- |
| Connected arrows | Drawing an arrow, or dragging one of its ends, near a shape snaps the end to one of the shape's anchor points (edge midpoints and center), which show while dragging. The end stays attached: moving, resizing, or rotating the shape re-aims the arrow in the same undo step. Deleting the shape detaches the arrow; copy / paste and duplicate keep attachments within the copied group | Attachments survive save and reload (file format v2, with a migration from v1), and the invariants checker verifies every attachment points to a shape that exists |
| Snap to grid | While the grid is shown, moving, resizing, and drawing snap to grid lines; holding Ctrl / Cmd turns it off | Snapped positions are exact multiples of the grid spacing |

## Tier 3 (advanced extension): multiplayer and design system

Tier 3 starts only after Tiers 1 and 2 are stable and live. It needs one small server: a y-websocket relay with no database or business logic.

### 3A. Real-time multiplayer

- Scene state moves into a Yjs document; a small Node y-websocket server (Render or Fly.io) relays updates between users in a room.
- Share a room link to edit together. Each user sees others' live cursors, names, and selections (Yjs awareness).
- Undo / redo is per user, so one user's undo never removes another's work.
- Offline edits merge when the connection returns; a badge shows Connected / Reconnecting / Offline.
- Incoming updates are validated like any outside input, and the document invariants from 1D still hold after every merge.
- **Done when:** the collaboration tests in the testing matrix pass with at least 4 clients.

### 3B. Full design system

- Builds on the Tier 1 tokens and themes: 8–10 shared components (Button, IconButton, Toolbar, Popover, ColorPicker, Slider, Dialog, Tooltip, Toast) on Radix, with clear, typed prop APIs.
- Storybook with one story per component and all its states (default, hover, focus, disabled, error).
- Components are versioned as an internal package with a changelog.
- Screen-reader support: a hidden, live shape list that mirrors the canvas and supports selection.
- **Done when:** every UI element uses shared components and tokens, and the app works fully with keyboard and screen reader.

## Testing matrix

Tests must prove the architecture works, not just that the app opens. All of them run locally with no hosted backend; collaboration tests start the y-websocket relay on the test machine.

| Level | Tool | Example tests | Tier |
| --- | --- | --- | --- |
| Unit | Vitest | Coordinate round-trips, hit-testing vs brute force, spatial index vs full rebuild, every command's do / undo, schema and migrations | 1 |
| Property-based | Vitest + fast-check | 1,000 random sequences of create, move, resize, rotate, delete, undo, and redo; invariants hold after every step; undo-all returns the empty document | 1 |
| Integration | Vitest + jsdom | Pointer events through tools into the store; one draw per frame; drag cancelled by `pointercancel` restores state | 1 |
| End-to-end | Playwright | Draw a 50-shape document, reload, select, edit, export PNG / SVG, theme switch, keyboard-only flow, axe scan | 1 |
| Performance | Playwright + benchmark page | 1,000, 5,000, and 10,000 shapes: frame times during pan, zoom, and drag; hit-test latency; memory after 5 minutes | 1 |
| Security | Vitest + Playwright | Malformed messages, unauthorized calls, oversized payloads, request floods, missed handshake; editor stays responsive | 2 |
| Collaboration | Playwright (multi-context) | 4 clients editing the same shapes, network drop and reconnect, offline edits; all clients converge to the same document | 3 |

Coverage target: 90%+ lines for `src/core/`, run in GitHub Actions on every pull request.

## Non-goals

These are out of scope, so the project stays shippable:

- User accounts, login, or a database of saved files (rooms are link-based).
- Mobile app or touch-first layout (desktop browser first; basic touch pan/zoom only).
- Figma import, AI shape generation, or a plugin marketplace.
- Vector boolean operations, grouping inside groups, or full text editing features like rich text.

## Milestones, local checks, and deployment

Each milestone is built and verified locally before the next one starts. Tier 1 is deployed publicly before any Tier 2 work begins.

**Tier 1 milestones:**

- [x] M1. Project setup: Vite + React + TS, ESLint, Prettier, Vitest, fast-check, GitHub Actions, folder structure
- [x] M2. Rendering core: camera and coordinate systems, high-DPI, render invalidation, scene graph, rectangle tool
- [x] M3. Spatial index and hit-testing, all shape tools, text measurement
- [x] M4. Interaction model: selection, drag with capture and cancel, resize, rotate, multi-selection, keyboard
- [x] M5. Commands, undo / redo, invariants checker, property-based tests
- [x] M6. Persistence: versioned format, migrations, autosave and recovery, import limits, export in a worker
- [x] M7. Style panel, layers, snapping and guides, tokens and themes, baseline accessibility, error boundaries
- [x] M8. Performance pass and benchmark suite at 1k / 5k / 10k shapes
- [ ] Gate: Tier 1 verified locally
- [ ] M9. Deploy Tier 1 on Vercel, README, demo video, technical write-up

**Tier 2 milestones:**

- [ ] M10. Plugin host: protocol, handshake, lifecycle, capability permissions, limits
- [ ] M11. Sample plugins, malicious test plugin, security tests
- [ ] M11b. Editor extras (2B): connected arrows and snap to grid
- [ ] Gate: Tier 2 verified locally, then redeploy

**Tier 3 milestones:**

- [ ] M12. Multiplayer: Yjs, y-websocket relay, presence, per-user undo, collaboration tests
- [ ] M13. Full design system: components, Storybook, versioning, screen-reader shape list
- [ ] Gate: Tier 3 verified locally, then redeploy

**Local verification checklist (every gate):**

- `npm run dev` starts with no console errors or warnings.
- `npm test`, `npm run test:property`, and `npm run e2e` all pass; core coverage is 90%+.
- `npm run bench` meets the performance targets, and results are saved.
- Manual test of every feature in the tier, in light and dark themes, plus a keyboard-only pass.

**Deployment:**

- Frontend on Vercel, auto-deployed from `main`; preview deploys for every pull request.
- From Tier 3: the y-websocket relay on Render or Fly.io; the frontend reads its URL from an env variable.
- GitHub Actions runs lint, typecheck, tests, and build on every pull request.

## Engineering outcomes and portfolio evidence

Every resume claim must be backed by something a reviewer can open or a number we measured. Collect evidence while building, not at the end.

**Required deliverables:**

1. A live editor that opens with a sample document, plus a 2-minute demo video.
2. An architecture diagram of the renderer, scene graph, store, and command pipeline (the one above, kept up to date).
3. A technical write-up on the rendering strategy, coordinate transforms, hit-testing, and performance trade-offs.
4. A reproducible benchmark suite (`npm run bench`) with saved results for each document size.
5. A plugin security demo: the malicious plugin being blocked while the editor keeps working (Tier 2).
6. A test report: coverage of core modules and the count of automated scenarios at each level.
7. A README with setup steps, key decisions, known limitations, and a roadmap.

**Numbers to record (with the machine and browser used):**

| Metric | Measured at |
| --- | --- |
| Frame-time distribution (median and 95th percentile) during pan, zoom, and drag | 1k, 5k, and 10k shapes |
| Hit-test latency | 1k, 5k, and 10k shapes |
| Initial render time and import / export time | Sample documents of each size |
| Memory after a 5-minute editing session | 5k shapes |
| Core test coverage and number of automated scenarios | Each tier gate |
| Concurrent clients tested and recovery time after a network drop | Tier 3 |

These numbers go into the README, the write-up, and 2–3 resume bullets.

## How to build with Claude Code

Give Claude Code one milestone at a time, and review every change before moving on. This keeps you in control and lets you explain every line in interviews.

1. Export this PRD as Markdown and save it in the repo as `docs/PRD.md`.
2. Create a `CLAUDE.md` with the rules: TypeScript strict, editor core has no React imports, every feature needs tests, keep components small.
3. Prompt per milestone, for example: "Read docs/PRD.md. Build milestone M2 only. Write tests. Stop and summarize what you changed."
4. Run the app and tests yourself after each milestone; commit only what you understand.
5. Do not trust agent output blindly: read the diff, check performance in DevTools, and fix anything that feels like a hack.
6. Keep a short `docs/decisions.md` log of key choices; it becomes your README and interview notes.
