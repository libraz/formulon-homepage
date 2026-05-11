---
title: Full UI demo
description: Full formulon-cell demo surface for inspecting Formulon in the browser.
---

# Full UI Demo

This page opens the bundled `formulon-cell` playground in an overlay child
window. It is deliberately framed as demo UI/UX: Formulon remains the headless
calculation engine, while this surface exists to make the browser build
inspectable through spreadsheet workflows.

<ClientOnly>
  <CellFullDemo />
</ClientOnly>

The playground mounts `formulon-cell` with its default full chrome and a seeded
workbook. Try selection, formula editing, keyboard navigation, context menus,
dialogs, and theme switching. For headless usage, continue with the Formulon
runtime and API pages rather than treating this UI as the required integration
path.
