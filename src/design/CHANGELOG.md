# Changelog

All notable changes to `@inkframe/design`. The package follows semantic versioning:
a breaking change to a component's props is a new major version.

## 1.0.0 — 2026-10-02

First version as a package, extracted from the app's UI.

- Tokens and themes: colors (light and dark), spacing, radii, type, shadows, z-index, motion.
- Components (all on Radix where a widget needs behavior):
  - Chrome: `Surface` (panel or bar), `Divider`, `Toolbar` with its parts, `Banner`.
  - Actions: `Button` (primary, secondary, ghost, danger, add), `IconButton`, `IconTrigger`.
  - Overlays: `Tooltip` (with `TooltipProvider`), `Popover`, `Menu` with its items, `Dialog`, `Toast` (with `ToastProvider` and `ToastViewport`).
  - Inputs: `ColorPicker`, `SegmentedControl`, `Slider`, `Chip`.
  - Text: `Kbd`, plus `shortcutKeys` and `shortcutText`.
