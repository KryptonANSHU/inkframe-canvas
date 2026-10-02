# Changelog

All notable changes to `@inkframe/design`. The package follows semantic versioning:
a breaking change to a component's props is a new major version.

## 1.2.0 — 2026-10-02

- Added `StatusBadge`: a short status (connected, reconnecting, offline) whose marker differs in shape as well as color.
- Added `peerColors` tokens for collaborators' cursors and selections.

## 1.1.0 — 2026-10-02

- Added `Listbox`: a multi-select listbox (WAI-ARIA pattern, `aria-activedescendant`) that renders only the 50 options around the active one, for lists of any length.

## 1.0.0 — 2026-10-02

First version as a package, extracted from the app's UI.

- Tokens and themes: colors (light and dark), spacing, radii, type, shadows, z-index, motion.
- Components (all on Radix where a widget needs behavior):
  - Chrome: `Surface` (panel or bar), `Divider`, `Toolbar` with its parts, `Banner`.
  - Actions: `Button` (primary, secondary, ghost, danger, add), `IconButton`, `IconTrigger`.
  - Overlays: `Tooltip` (with `TooltipProvider`), `Popover`, `Menu` with its items, `Dialog`, `Toast` (with `ToastProvider` and `ToastViewport`).
  - Inputs: `ColorPicker`, `SegmentedControl`, `Slider`, `Chip`.
  - Text: `Kbd`, plus `shortcutKeys` and `shortcutText`.
- Storybook: one story file per component (`npm run storybook`), covering default, hover, focus, disabled, and error states where they apply, in light and dark themes; every story passes axe.
