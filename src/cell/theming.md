---
title: formulon-cell theming
description: Bundled themes, the data-fc-theme mechanism, and the --fc-* / --fc-tb-* token vocabulary for formulon-cell.
---

# Theming

`formulon-cell` ships three complete themes and a public CSS variable vocabulary so hosts can restyle the chrome without forking a stylesheet. This is a reference UI surface for Formulon integration testing, not a themable design system product — the token set below is the supported override surface; everything else in the shipped CSS is an implementation detail that can change between releases.

::: info Glossary: theme vs token
A *theme* (`paper`, `ink`, `contrast`) is a complete set of values assigned to the public tokens. A *token* is one `--fc-*` custom property. Switching themes reassigns every token at once; overriding a token changes one value regardless of which theme is active.
:::

## Bundled themes

| Theme | `data-fc-theme` value | Look |
| --- | --- | --- |
| Paper | `paper` (also the default when the attribute is absent) | Light spreadsheet look |
| Ink | `ink` | Dark mode |
| Contrast | `contrast` | WCAG-AAA hard-edge contrast — solid outlines in place of soft shadows |

```ts
instance.setTheme('paper')
instance.setTheme('ink')
instance.setTheme('contrast')
```

## The `data-fc-theme` mechanism

`SpreadsheetInstance.setTheme(name)` writes a `data-fc-theme` attribute on `.fc-host` — it does not swap stylesheets or reflow the DOM. The three bundled theme files each scope their token assignments to that attribute:

| Theme file | Selector |
| --- | --- |
| `theme-paper.css` | `.fc-host:not([data-fc-theme])` and `.fc-host[data-fc-theme="paper"]` |
| `theme-ink.css` | `.fc-host[data-fc-theme="ink"]` |
| `theme-contrast.css` | `.fc-host[data-fc-theme="contrast"]` |

`themeChange` fires on the instance's event bus after the attribute updates, so host chrome (a theme switcher, a persisted preference) can react without polling the DOM.

::: tip A custom theme name works the same way
`setTheme('brand')` writes `data-fc-theme="brand"`. There is nothing to register — any string is accepted, and the tokens simply resolve through the normal cascade against whatever rules match that attribute value.
:::

## The `--fc-*` token vocabulary

Every token below is declared in `tokens.css` and is safe to set on `.fc-host` (or any ancestor) — this is the file editor tooling (VS Code CSS IntelliSense) reads to surface autocomplete for the vocabulary. Tokens not listed there are internal and may be renamed without a major version bump.

| Group | Representative tokens | Paints |
| --- | --- | --- |
| Surfaces | `--fc-bg`, `--fc-bg-elev`, `--fc-bg-rail`, `--fc-bg-header`, `--fc-bg-hover` | Cell area, formula bar / status bar, header rail, hover rows |
| Foreground | `--fc-fg`, `--fc-fg-strong`, `--fc-fg-mute`, `--fc-fg-faint` | Cell text scale from default through disabled/placeholder |
| Rules | `--fc-rule`, `--fc-rule-strong`, `--fc-rule-soft`, `--fc-rule-subtle`, `--fc-hairline` | Gridlines, header dividers, list separators, hairline width |
| Accent | `--fc-accent`, `--fc-accent-strong`, `--fc-accent-soft`, `--fc-accent-fg` | Selection outline, focus ring, primary buttons |
| Cell values | `--fc-cell-error-fg`, `--fc-cell-formula-fg`, `--fc-cell-bool-fg`, `--fc-cell-num-fg` | `#REF!`/`#DIV/0!` text, Show Formulas mode, `TRUE`/`FALSE`, right-aligned numbers |
| Header rail | `--fc-header-fg`, `--fc-header-fg-active`, `--fc-header-bg`, `--fc-header-rule` | Column letters / row numbers, active header highlight |
| Hover | `--fc-hover-stripe`, `--fc-selection-fill` | Hovered row/column stripe, active-range wash |
| Typography | `--fc-font-ui`, `--fc-font-mono`, `--fc-font-display`, `--fc-text-cell`, `--fc-text-header`, `--fc-text-formula`, `--fc-text-rail`, `--fc-leading-cell`, `--fc-tracking-tight`, `--fc-tracking-wide` | UI chrome, cell content, status bar label, sizing |
| Radius | `--fc-radius-sm`, `--fc-radius-md`, `--fc-radius-lg` | Dialog and popover corner radii |
| Format Cells dialog | `--fc-fmtdlg-border-diag-color`, `--fc-fmtdlg-border-diag-width` | Diagonal border swatch in the Border tab |
| Menu icons | `--fc-menu-icon`, `--fc-menu-icon-color` | Per-row data-URL mask + color, set from JS per menu item |
| Motion | `--fc-dur-fast`, `--fc-dur-base`, `--fc-dur-slow`, `--fc-ease-out`, `--fc-ease-in-out` | Transition durations and easing |
| Elevation | `--fc-shadow-2`, `--fc-shadow-4`, `--fc-shadow-8`, `--fc-shadow-16` | Status bar lift, popovers, menus, modal dialogs (use by surface, not by pixel value) |

```css
.my-spreadsheet .fc-host {
  --fc-accent: #d63384;
  --fc-bg-rail: #fff8f0;
}

/* Or scope to a custom theme name and toggle it via data-fc-theme: */
.fc-host[data-fc-theme="brand"] {
  --fc-accent: #d63384;
}
```

::: info Stacking-floor tokens live on `:where(html)`, not `.fc-host`
`--fc-z-base`, `--fc-z-grid`, `--fc-z-dialog`, `--fc-z-tooltip`, `--fc-z-popover`, `--fc-z-callout`, `--fc-z-menu`, and `--fc-z-error` control the stacking order of floating UI (context menu, autocomplete, tooltips, …), some of which portals outside the `.fc-host` subtree. Override them at `:root`/`html` or a wrapping ancestor, not on `.fc-host` itself.
:::

## The `--fc-tb-*` toolbar token surface

The ribbon toolbar's overridable tokens ship under the `--fc-tb-*` vocabulary, kept distinct from the grid's `--fc-*` tokens but reachable through the same `data-fc-theme` attribute. Representative entries: `--fc-tb-ribbon-bg`, `--fc-tb-ribbon-rail`, `--fc-tb-ribbon-hover`, `--fc-tb-accent`, `--fc-tb-accent-strong`, `--fc-tb-accent-soft`.

The toolbar reads the same `paper` / `ink` / `contrast` values off the shared `data-fc-theme`, so putting that attribute on a common ancestor of the grid and toolbar — or just driving `instance.setTheme(name)` — themes both surfaces at once:

```css
.fc-host[data-fc-theme="ink"] { --fc-tb-ribbon-bg: #201f1e; /* … */ }
```

::: tip One theme vocabulary, one accent
When the ribbon is mounted inside `.fc-host` (single-call `mount({ toolbar })`), `--fc-tb-accent` / `--fc-tb-accent-strong` fall back to the grid's `--fc-accent` / `--fc-accent-strong`, so a single `.fc-host { --fc-accent: … }` override themes both surfaces. A standalone toolbar (host not under `.fc-host`) keeps the `--fc-tb-*` literals, which match the grid's per-theme accent so both mount modes look identical.
:::

## Authoring a brand theme

To ship a themed spreadsheet, copy one of the bundled theme files (`theme-paper.css`, `theme-ink.css`, or `theme-contrast.css`) as a starting point, change the selector's `data-fc-theme` value, and override only the tokens your brand actually needs — everything else falls through to the base theme you copied from:

```css
/* theme-mine.css */
.fc-host[data-fc-theme="mine"] {
  --fc-accent: #107c41;
  --fc-accent-strong: #0e6b39;
  --fc-bg-rail: #faf6e8;
  --fc-rule: #b09870;
}
```

```ts
import './theme-mine.css'

instance.setTheme('mine')
```

::: tip When to add a token vs. use a literal
Reach for one of the documented tokens when the value differs between themes, when consumers reasonably want to override it, or when the same value shows up in three or more places. One-off illustrations (chart legends, swatch grids, icon glyphs) are fine as literals — they are not themable surfaces.
:::

## Read next

- [API surface](/cell/api#theme-controller) — `setTheme()` on `SpreadsheetInstance`.
- [Embedding guide](/cell/embedding) — preset / extension composition.
- [Extension catalogue](/cell/extensions) — factory-by-factory feature reference.
