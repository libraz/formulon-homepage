---
title: Reference UI playground
description: formulon-cell reference playground for browser integration testing.
---

# Reference UI Playground

This page opens the bundled `formulon-cell` playground in an overlay child
window. It is deliberately framed as a reference integration surface: Formulon
remains the headless calculation engine, while this UI exists to make the browser
build inspectable through spreadsheet workflows.

<ClientOnly>
  <CellFullDemo />
</ClientOnly>

The playground mounts `formulon-cell` with its default full chrome and a seeded
workbook. Try selection, formula editing, keyboard navigation, context menus,
dialogs, and theme switching. Feature coverage is partial, UI/UX does not aim
for exact Excel parity, and UI bugs may remain. For headless usage, continue
with the Formulon runtime and API pages rather than treating this UI as the
required integration path.
