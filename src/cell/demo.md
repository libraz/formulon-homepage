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

The language selector below the formula bar is the built-in control enabled with `ui.features.localeSwitcher: true`. It switches between English, 日本語, Deutsch, Français, 中文, 한국어, and ไทย, and each change moves the UI dictionary and the calculation profile together while the workbook stays mounted. Choose `Deutsch`, for example, and the ribbon turns German, `B10` displays `=SUMME(B2:B9)`, the `C11` average reads `4373,75`, and the `B12` margin reads `38,8%`. The stored formula is still `=SUM(B2:B9)`. Switching the header's UI platform to `Mac` keeps the chosen language and moves the profile to `mac-de_DE`. See [Language switching](/cell/language-switching) for the locale-to-profile mapping.
## Try embedding options

Switch UI profiles to change the surrounding controls while keeping the same workbook. The modal example opens formatting and search inside a host dialog.

<CellEmbedDemo scenario="profiles" />

<CellEmbedDemo scenario="overlay" />
