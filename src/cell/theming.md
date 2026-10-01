---
title: Theming
description: Apply the built-in themes and override the public CSS tokens used by formulon-cell and its floating UI.
---

# Theming

Import `@libraz/formulon-cell/styles.css` once, then choose a built-in theme or provide a small set of CSS variable overrides. The same theme follows the grid, formula bar, menus, and dialogs mounted for that spreadsheet.

## Built-in themes

| Theme | Use it for |
| --- | --- |
| `paper` | Light application layouts; this is the default. |
| `ink` | Dark application layouts. |
| `contrast` | High-contrast layouts with stronger boundaries. |

```ts
instance.setTheme('paper')
instance.setTheme('ink')
instance.setTheme('contrast')
```

`themeChange` fires after `setTheme()`. Persist the name in the host when the user's choice should survive the next mount.

<CellEmbedDemo scenario="theme-locale" />

## Use a brand theme

Any string can be used as a theme name. A custom name requires a complete CSS palette; it does not inherit `paper`, `ink`, or `contrast`. The common recipe keeps the built-in `paper` theme and scopes brand overrides to a host-owned wrapper:

```css
.report-editor .fc-host[data-fc-theme="paper"],
.report-editor .fc-overlay-portal[data-fc-theme="paper"] {
  --fc-accent: #7c3aed;
  --fc-accent-strong: #6d28d9;
  --fc-accent-soft: color-mix(in srgb, var(--fc-accent) 12%, transparent);
  --fc-bg-rail: #f5f3ff;
  --fc-rule: #ddd6fe;
}
```

```ts
const instance = await Spreadsheet.mount(host, {
  workbook,
  ui: { theme: 'paper' },
  overlays: { root: overlayPortal },
})

instance.setTheme('paper')
```

Place `overlayPortal` inside the same `.report-editor` wrapper. This applies the overrides to menus and dialogs outside the grid subtree while keeping them scoped to this spreadsheet. A custom theme name is accepted, but the bundled theme selectors no longer match it, so a custom name must define every required palette token.

## Public grid tokens

The supported token names are declared in `styles/tokens.css`. Common groups are:

| Group | Example tokens | Affects |
| --- | --- | --- |
| Surfaces | `--fc-bg`, `--fc-bg-elev`, `--fc-bg-rail`, `--fc-bg-header`, `--fc-bg-hover` | Grid and surrounding control backgrounds. |
| Text | `--fc-fg`, `--fc-fg-strong`, `--fc-fg-mute`, `--fc-fg-faint` | Cell and supporting text. |
| Lines | `--fc-rule`, `--fc-rule-strong`, `--fc-rule-soft` | Gridlines and separators. |
| Selection | `--fc-accent`, `--fc-accent-strong`, `--fc-accent-soft`, `--fc-selection-fill` | Focus and selected ranges. |
| Cell values | `--fc-cell-error-fg`, `--fc-cell-formula-fg`, `--fc-cell-bool-fg`, `--fc-cell-num-fg` | Value-specific text colors. |
| Typography | `--fc-font-ui`, `--fc-font-mono`, `--fc-text-cell`, `--fc-text-header` | Fonts and cell sizing. |
| Dialog surfaces | `--fc-radius-md`, `--fc-shadow-8`, `--fc-shadow-16` | Floating controls and dialogs. |

Override tokens directly on `.fc-host`. Apply the same overrides to its `.fc-overlay-portal` when controls are outside the host subtree; the portal copies the theme name, not host-scoped CSS variable overrides. An ancestor selector can scope those rules, but setting only ancestor variables does not override the bundled host declarations. Host CSS outside the package's cascade layers can override the default values.

```css
.report-editor .fc-host,
.report-editor .fc-overlay-portal {
  --fc-font-ui: "Inter", system-ui, sans-serif;
  --fc-text-cell: 14px;
  --fc-bg-rail: #f8fafc;
  --fc-accent: #0f766e;
}
```

The page view tokens (`--fc-page-*`), menu icon tokens, motion tokens, and full token list are available in `styles/tokens.css`. Token names outside that file are implementation details.

## Coordinate a separate ribbon

The toolbar uses its own `--fc-tb-*` token group. A toolbar mounted inside `.fc-host` follows the grid accent automatically. For a standalone `SpreadsheetToolbar`, set the toolbar tokens on its wrapper.

```css
.app-toolbar {
  --fc-tb-accent: #0f766e;
  --fc-tb-accent-strong: #115e59;
  --fc-tb-ribbon-bg: #ffffff;
  --fc-tb-ribbon-hover: #f0fdfa;
}
```

Use the core stylesheet together with the adapter toolbar stylesheet when using React or Vue's separate toolbar component. A single-call `toolbar` mount already sits under the spreadsheet host.

## Overlay and modal colors

Dialogs and menus receive the theme name through their overlay root. The portal does not automatically inherit host-scoped CSS variable overrides. If the spreadsheet is inside a native `<dialog>`, a fullscreen element, or an application modal, set `overlays.root` to that element so the floating UI stays inside the same visual boundary. The [Modal and overlay guide](/cell/modals) covers placement; the token names remain the same.

## Read next

- [API surface](/cell/api#theme-controller) — switch themes from application code.
- [React and Vue adapters](/cell/frameworks) — import and size framework components.
- [Extensions](/cell/extensions) — choose the feature surface before styling it.
