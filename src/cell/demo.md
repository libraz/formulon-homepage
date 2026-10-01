---
title: formulon-cell demo
description: Explore the formulon-cell spreadsheet surface in the browser.
---

# formulon-cell demo

This demo embeds formulon-cell with a seeded workbook and built-in spreadsheet controls. Use it to try editing, selecting ranges, opening menus and dialogs, switching themes, and changing the visible UI controls.

<ClientOnly>
  <CellFullDemo />
</ClientOnly>

For an application embed, start with the [Embedding guide](/cell/embedding), choose a profile, and add only the options and extensions your host needs. For framework integrations, see [React and Vue adapters](/cell/frameworks).

## Try embedding options

Switch UI profiles to change the surrounding controls while keeping the same workbook. The modal example opens formatting and search inside a host dialog.

<CellEmbedDemo scenario="profiles" />

<CellEmbedDemo scenario="overlay" />
