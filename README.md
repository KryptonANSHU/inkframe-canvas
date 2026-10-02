<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logos/logo-dark.svg" />
    <img src="public/logos/logo-light.svg" alt="Inkframe" height="56" />
  </picture>
</p>

<p align="center">
  A canvas design tool for the browser, with its own rendering engine.<br />
  <a href="https://inkframe-chi.vercel.app"><strong>Open the live demo →</strong></a>
</p>

## Features

- Rectangles, ellipses, lines, arrows, freehand pen, and text in a hand-drawn, normal, or code font
- Select, move, resize, rotate, with snapping guides
- Undo and redo for every change, and grouping (Ctrl/⌘ + G)
- Styles, layers, light and dark themes, a grid, keyboard shortcuts (press `?`)
- Autosave in the browser, plus open and save as JSON
- Export to PNG and SVG
- Plugins in a sandboxed iframe, with permissions you approve and revoke: align and distribute, color palettes, grids, or your own from a file. A built-in malicious test plugin shows every attack being blocked
- Draw together: share a room link, see each other's cursors, undo only your own changes, keep editing offline
- 60 fps with 10,000 shapes on screen

## Getting started

Requires Node.js 24 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Commands

| Command             | What it does                               |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Start the dev server                       |
| `npm run relay`     | Start the collaboration relay              |
| `npm run build`     | Type-check and build for production        |
| `npm test`          | Run unit tests                             |
| `npm run e2e`       | Run end-to-end tests in Chromium           |
| `npm run bench`     | Run the benchmarks at 1k / 5k / 10k shapes |
| `npm run lint`      | Lint the code                              |
| `npm run storybook` | Browse the design system's components      |

Add `?debug=1` to the URL to see a live frame-time meter.

## Drawing together

Run the relay next to the dev server, then use **Draw together** (top right):

```bash
npm run relay
```

The app connects to `ws://localhost:1234` in development. For a deployed site, run `server/relay.ts` somewhere that keeps a process running (a [`render.yaml`](render.yaml) is included) and set `VITE_COLLAB_URL` to its `wss://` address when building the frontend.

## Built with

React, TypeScript, the Canvas 2D API, Web Workers, IndexedDB, Zustand, Zod, Radix UI, Vite, Vitest, fast-check, and Playwright.
