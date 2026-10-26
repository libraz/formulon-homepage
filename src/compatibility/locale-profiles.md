# Locale Profiles

Excel behavior is not fully locale-neutral. Function names, separators, date parsing, width handling, currency, and text behavior can vary by platform and locale. Formulon therefore exposes named profiles instead of a single global compatibility mode.

::: info Glossary: compatibility profile
A named binding between an Excel 365 host and a locale, plus the oracle data that supports the compatibility claim. The profile drives locale-sensitive evaluation; applications and tests pin to a profile explicitly rather than relying on host-OS defaults.
:::

## Profiles today

Formulon ships 28 profile IDs: `{mac,win}-365-{ja_JP,en_US,de_DE,fr_FR,zh_CN,ko_KR,th_TH,es_ES,es_MX,pt_BR,ru_RU,zh_TW,it_IT,nl_NL}`. A new workbook uses `win-365-en_US` unless the application selects another profile. `createForProfile(profileId)` also gives the new workbook the fonts, style names, and sheet names Excel uses in that locale; see [Workbook lifecycle](/workbook/lifecycle).

| Host | Profiles | Measurement status |
| --- | --- | --- |
| Mac Excel 365 | `mac-365-` followed by all 14 locale codes | All 14 are measured. `mac-365-ja_JP` is the primary formula and conditional-formatting oracle; the other 13 locales have their own formula goldens. |
| Windows Microsoft 365 | `win-365-` followed by all 14 locale codes | `win-365-ja_JP` is measured and is the workbook (PivotTable and print) oracle. The other 13 Windows profiles are estimates until a Windows capture replaces them. |

`localeFacts(profileId)` exposes two measurement flags. `measured` describes the scalar locale facts; `collationMeasured` describes text ordering separately. The latter is true for all Mac profiles and false for every Windows profile, including `win-365-ja_JP`. Neither flag says whether a particular formula is implemented. Python uses `collation_measured`; the C record uses the same snake-case field.

## Locale facts

The following values are the current `localeFacts()` data. The `array` column is `(column separator, row separator)`. Currency `prefix` / `suffix` describes the symbol position; `space` means one space is emitted between the symbol and the number. These scalar facts are shared by the Mac and Windows profile for a locale; the `measured` flag differs as described above.

| Locale | Decimal | Group | List | Array | Boolean names | Date order | Currency |
| --- | ---: | ---: | ---: | --- | --- | --- | --- |
| `ja_JP` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `ymd` | `¥`, prefix, 0 decimals |
| `en_US` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `mdy` | `$`, prefix, 2 decimals |
| `de_DE` | `,` | `.` | `;` | `. ;` | `WAHR` / `FALSCH` | `dmy` | `€`, suffix, space, 2 decimals |
| `fr_FR` | `,` | space | `;` | `. ;` | `VRAI` / `FAUX` | `dmy` | `€`, suffix, space, 2 decimals |
| `zh_CN` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `ymd` | `¥`, prefix, 2 decimals |
| `ko_KR` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `ymd` | `₩`, prefix, 0 decimals |
| `th_TH` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `dmy` | `฿`, prefix, 2 decimals |
| `es_ES` | `,` | `.` | `;` | `\ ;` | `VERDADERO` / `FALSO` | `dmy` | `€`, suffix, space, 2 decimals |
| `es_MX` | `.` | `,` | `,` | `, ;` | `VERDADERO` / `FALSO` | `dmy` | `$`, prefix, 2 decimals |
| `pt_BR` | `,` | `.` | `;` | `\ ;` | `VERDADEIRO` / `FALSO` | `dmy` | `R$`, prefix, space, 2 decimals |
| `ru_RU` | `,` | space | `;` | `; :` | `ИСТИНА` / `ЛОЖЬ` | `dmy` | `₽`, suffix, space, 2 decimals |
| `zh_TW` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `ymd` | `$`, prefix, 2 decimals |
| `it_IT` | `,` | `.` | `;` | `\ .` | `VERO` / `FALSO` | `dmy` | `€`, suffix, space, 2 decimals |
| `nl_NL` | `,` | `.` | `;` | `\ ;` | `WAAR` / `ONWAAR` | `dmy` | `€`, prefix, space, 2 decimals |

`localeFacts()` also exposes localized error names. The profile controls R1C1 letters, date and time names, and `TEXT()` format rules internally, but those fields are not part of the public `LocaleFacts` result. Do not infer any of them from the currency or separator table.

## Code pages and width rules

The locale profile also selects the code-page behavior of byte-counting and character-code functions. `DbcsCodepage` is the double-byte page used by `LENB`, `LEFTB`, `RIGHTB`, `MIDB`, `CHAR`, and `CODE`; the `CHAR` / `CODE` single-byte page is listed separately.

| Locale | DBCS page | `CHAR` / `CODE` byte page | Width folding |
| --- | --- | --- | --- |
| `ja_JP` | JIS X 0208 | CP932 | Mac rules on `mac-*`; Windows rules on `win-*` |
| `zh_CN` | GB2312 | DBCS high bytes are blank | none |
| `ko_KR` | KS X 1001 | DBCS high bytes are blank | Mac rules on `mac-*`; Windows rules on `win-*` |
| `zh_TW` | Big5 | DBCS high bytes are blank | none |
| Other locales | none | MacRoman on `mac-*`; Windows-1252 on `win-*`, except `th_TH` and `ru_RU` | Mac rules on `mac-*`; Windows rules on `win-*` |

For `th_TH`, the byte page is MacThai; for `ru_RU`, it is MacCyrillic. These are profile facts even on the corresponding `win-*` IDs. Chinese profiles keep width and kana distinctions in the paths where the source collator says they are distinct; the exact function strength is covered in [Text collation](./text-collation).

## Pivot labels

Pivot captions are also profile data. `␠` below marks the trailing space present in the stored prefix. `grand total` is the ordinary total caption and `hierarchy total` is the hierarchy caption returned by `localeFacts()`.

| Locale | Grand total | Hierarchy total | Row prefix | Column prefix | Value prefix |
| --- | --- | --- | --- | --- | --- |
| `ja_JP` | `合計` | `総計` | `行フィールド␠` | `列フィールド␠` | `値␠` |
| `en_US` | `Total` | `Grand Total` | `Row Field␠` | `Column Field␠` | `Value␠` |
| `de_DE` | `Gesamt` | `Gesamtergebnis` | `Zeilenfeld␠` | `Spaltenfeld␠` | `Wert␠` |
| `fr_FR` | `Total` | `Total général` | `Champ de ligne␠` | `Champ de colonne␠` | `Valeur␠` |
| `zh_CN` | `总计` | `总计` | `行字段␠` | `列字段␠` | `值␠` |
| `ko_KR` | `합계` | `총합계` | `행 필드␠` | `열 필드␠` | `값␠` |
| `th_TH` | `ผลรวม` | `ผลรวมทั้งหมด` | `เขตข้อมูลแถว␠` | `เขตข้อมูลคอลัมน์␠` | `ค่า␠` |
| `es_ES`, `es_MX` | `Total` | `Total general` | `Campo de fila␠` | `Campo de columna␠` | `Valor␠` |
| `pt_BR` | `Total` | `Total Geral` | `Campo de linha␠` | `Campo de coluna␠` | `Valor␠` |
| `ru_RU` | `Итого` | `Общий итог` | `Поле строки␠` | `Поле столбца␠` | `Значение␠` |
| `zh_TW` | `總計` | `總計` | `列欄位␠` | `欄欄位␠` | `值␠` |
| `it_IT` | `Totale` | `Totale complessivo` | `Campo riga␠` | `Campo colonna␠` | `Valore␠` |
| `nl_NL` | `Totaal` | `Eindtotaal` | `Rijveld␠` | `Kolomveld␠` | `Waarde␠` |

## How a profile affects evaluation

The profile-controlled areas include:

- number, boolean, and error text and parsing: decimal and thousands separators, localized `TRUE` / `FALSE` names, and date order;
- `TEXT()` format letters, keywords, color names, and month and day names;
- text comparison, sorting, lookup, grouping, and coercion, including width and kana handling;
- R1C1 reference letters and `CELL()` codes;
- `FORMULATEXT()` function names and separators, including localized aliases where Excel has them;
- DBCS code pages and the single-byte `CHAR()` / `CODE()` pages;
- `GROUPBY()` / `PIVOTBY()` labels;
- environment-sensitive `INFO()` values;
- sheet-name rules: `History` in any case is refused on add and rename under `win-*` profiles and accepted under `mac-*`; and
- PivotTable labels and layout defaults.

Formulas are stored with English function names and invariant separators. The profile changes how formula text is interpreted and how results are rendered; it does not change the stored formula syntax. `functionMetadata(name)` is locale-invariant and returns structural metadata. Use the profile-aware localization methods when the user-facing function name or formula text must change. The [workbook language guide](/workbook/language) covers that boundary and the [cell language-switching guide](/cell/language-switching) covers editor behavior.

::: warning Do not silently switch profiles
A workbook recalculated under a different profile can produce different results even when the formulas look the same. Persist the profile targeted by the application and assert it at startup.
:::

## Selecting and persisting a profile

Through the JavaScript bindings:

::: code-group

```ts [WASM / Native Node]
const selected = 'mac-365-de_DE'
const status = wb.setExcelProfileId(selected)
if (!status.ok) throw new Error(status.message)
const profile = wb.excelProfileId()
if (!profile.status.ok) throw new Error(profile.status.message)
console.log(profile.value) // mac-365-de_DE
wb.recalc()
```

```python [Python]
selected = "mac-365-de_DE"
wb.set_excel_profile_id(selected)
print(wb.excel_profile_id())  # mac-365-de_DE
wb.recalc()
```

:::

The profile belongs to the workbook instance, not to a process-wide flag, so different workbooks in one process can target different profiles. The profile is not serialized into an XLSX or XLSB file. Persist the selected ID in application state and apply it again after loading. Changing the profile marks formulas dirty; call `recalc()` before reading values.

## Read next

- [Compatibility model](/compatibility/model) — why profiles exist.
- [Text collation](/compatibility/text-collation) — how comparisons, sorting, and lookup strength differ.
- [Workbook language](/workbook/language) — formula text and function-name localization.
- [Cell language switching](/cell/language-switching) — changing the editor language at runtime.
- [Oracle testing](/compatibility/oracle-testing) — how a profile is backed by data.

Source facts are defined by `src/excel_profile.h`, `src/excel_locale.h`, `src/excel_locale.cpp`, and the locale and collation oracle fixtures in the Formulon source tree.
