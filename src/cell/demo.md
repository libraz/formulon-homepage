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

The full demo header has a UI platform selector with `Default`, `Mac`, and `Auto`. It calls `setUi()` when the selection changes, so the same workbook stays mounted while the platform surface is resolved again. The seeded table has `Region`, `Revenue`, `Cost`, and `Margin` headers: `B2:B9` and `C2:C9` contain numbers, and `D2:D9` starts with formulas such as `=B2-C2`.

Choose `Mac` to try the Draw tab, the Function Arguments picker with live catalog, families, and Recent, and the Data and Review dialog routes. See [Platform and Mac UI](/cell/platform) for the available actions and limits. Draw ink is session-only and is not saved to `.xlsx`. Hold `Ctrl` or `Cmd` while dragging to add a second selection area, then use `Ctrl+Enter` or `Cmd+Enter` to fill every area. Ribbon formatting, Clear, named styles, and the Format Cells underline selector apply across the selected areas when each area is authorized.

## Try embedding options

Switch UI profiles to change the surrounding controls while keeping the same workbook. The modal example opens formatting and search inside a host dialog.

<CellEmbedDemo scenario="profiles" />

<CellEmbedDemo scenario="overlay" />
