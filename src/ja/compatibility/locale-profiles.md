# ロケールプロファイル

Excel の挙動は完全にはロケール非依存ではありません。関数名、区切り文字、日付解析、文字幅、通貨、テキスト処理は、プラットフォームとロケールによって変わることがあります。そのため Formulon は、単一のグローバル互換モードではなく、名前付きプロファイルを公開します。

::: info 用語: 互換性プロファイル
Excel 365 のホストとロケールの組に名前を付け、互換性の根拠となる Oracle データを紐付けたものです。ロケール依存の評価はプロファイルに従います。アプリとテストはホスト OS の既定値ではなく、プロファイルを明示的に固定してください。
:::

## 現在のプロファイル

Formulon は 28 個のプロファイル ID を提供します。形式は `{mac,win}-365-{ja_JP,en_US,de_DE,fr_FR,zh_CN,ko_KR,th_TH,es_ES,es_MX,pt_BR,ru_RU,zh_TW,it_IT,nl_NL}` です。新しいワークブックは、別のプロファイルを選択しない限り `win-365-en_US` を使います。`createForProfile(profileId)` を使うと、そのロケールの Excel と同じフォント、スタイル名、シート名を持つワークブックを作れます。詳しくは [ワークブックの流れ](/ja/workbook/lifecycle) を参照してください。

| ホスト | プロファイル | 測定状況 |
| --- | --- | --- |
| Mac Excel 365 | 14 ロケールすべてに対する `mac-365-` | 14 個すべて実測済みです。`mac-365-ja_JP` が数式と条件付き書式の主 Oracle で、ほかの 13 ロケールにも専用の数式ゴールデンがあります。 |
| Windows Microsoft 365 | 14 ロケールすべてに対する `win-365-` | `win-365-ja_JP` は実測済みで、ワークブック（ピボットテーブルと印刷）の Oracle です。ほかの 13 個は、Windows での取得に置き換わるまで推定値です。 |

`localeFacts(profileId)` は測定状況を 2 つのフラグで返します。`measured` は区切り文字や通貨などのロケール情報、`collationMeasured` は文字列の照合順序についての測定状況です。後者はすべての Mac プロファイルで true、`win-365-ja_JP` を含むすべての Windows プロファイルで false です。どちらも個々の関数が実装済みかどうかは示しません。Python と C のフィールド名は `collation_measured` です。

## ロケール情報

次の値は現在の `localeFacts()` の内容です。`配列` 列は（列区切り、行区切り）です。通貨の `prefix` / `suffix` は記号の位置を示し、`space` は記号と数値の間に 1 個の空白を出力することを示します。これらのスカラー値は同じロケールの Mac と Windows で共通で、`measured` の値だけが上記の測定状況に従って変わります。

| ロケール | 小数 | 桁区切り | リスト | 配列 | 真偽値の名前 | 日付順 | 通貨 |
| --- | ---: | ---: | ---: | --- | --- | --- | --- |
| `ja_JP` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `ymd` | `¥`、prefix、0 桁 |
| `en_US` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `mdy` | `$`、prefix、2 桁 |
| `de_DE` | `,` | `.` | `;` | `. ;` | `WAHR` / `FALSCH` | `dmy` | `€`、suffix、空白、2 桁 |
| `fr_FR` | `,` | 空白 | `;` | `. ;` | `VRAI` / `FAUX` | `dmy` | `€`、suffix、空白、2 桁 |
| `zh_CN` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `ymd` | `¥`、prefix、2 桁 |
| `ko_KR` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `ymd` | `₩`、prefix、0 桁 |
| `th_TH` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `dmy` | `฿`、prefix、2 桁 |
| `es_ES` | `,` | `.` | `;` | `\ ;` | `VERDADERO` / `FALSO` | `dmy` | `€`、suffix、空白、2 桁 |
| `es_MX` | `.` | `,` | `,` | `, ;` | `VERDADERO` / `FALSO` | `dmy` | `$`、prefix、2 桁 |
| `pt_BR` | `,` | `.` | `;` | `\ ;` | `VERDADEIRO` / `FALSO` | `dmy` | `R$`、prefix、空白、2 桁 |
| `ru_RU` | `,` | 空白 | `;` | `; :` | `ИСТИНА` / `ЛОЖЬ` | `dmy` | `₽`、suffix、空白、2 桁 |
| `zh_TW` | `.` | `,` | `,` | `, ;` | `TRUE` / `FALSE` | `ymd` | `$`、prefix、2 桁 |
| `it_IT` | `,` | `.` | `;` | `\ .` | `VERO` / `FALSO` | `dmy` | `€`、suffix、空白、2 桁 |
| `nl_NL` | `,` | `.` | `;` | `\ ;` | `WAAR` / `ONWAAR` | `dmy` | `€`、prefix、空白、2 桁 |

`localeFacts()` は、ローカライズされたエラー名も返します。R1C1 の文字、日付・時刻名、`TEXT()` の書式規則はプロファイルが内部で制御しますが、公開されている `LocaleFacts` の結果には含まれません。これらを通貨や区切り文字の表から推測しないでください。

## コードページと文字幅

ロケールプロファイルは、バイト数を数える関数と文字コード関数のコードページも選択します。`DbcsCodepage` は `LENB`、`LEFTB`、`RIGHTB`、`MIDB`、`CHAR`、`CODE` が使う 2 バイトページです。`CHAR` / `CODE` の 1 バイトページは別に示します。

| ロケール | DBCS ページ | `CHAR` / `CODE` のバイトページ | 文字幅の折りたたみ |
| --- | --- | --- | --- |
| `ja_JP` | JIS X 0208 | CP932 | `mac-*` は Mac 規則、`win-*` は Windows 規則 |
| `zh_CN` | GB2312 | DBCS の高位バイトは空白 | なし |
| `ko_KR` | KS X 1001 | DBCS の高位バイトは空白 | `mac-*` は Mac 規則、`win-*` は Windows 規則 |
| `zh_TW` | Big5 | DBCS の高位バイトは空白 | なし |
| その他 | なし | `mac-*` は MacRoman、`win-*` は Windows-1252。ただし `th_TH` と `ru_RU` は除く | `mac-*` は Mac 規則、`win-*` は Windows 規則 |

`th_TH` のバイトページは MacThai、`ru_RU` は MacCyrillic です。対応する `win-*` ID でも同じページを使います。中国語プロファイルでは、ソースの照合器が区別する経路で幅とかなを区別します。関数ごとの正確な強度は [テキスト照合](./text-collation) を参照してください。

## ピボットのラベル

ピボットの見出しもプロファイルデータです。以下では `␠` が保存される末尾の空白を表します。`grand total` は通常の合計見出し、`hierarchy total` は `localeFacts()` が返す階層合計見出しです。

| ロケール | Grand total | Hierarchy total | 行の接頭辞 | 列の接頭辞 | 値の接頭辞 |
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

## プロファイルが評価に与える影響

プロファイルが制御する領域は次のとおりです。

- 数値・真偽値・エラーの表記と解析（小数点・桁区切り、ローカライズされた `TRUE` / `FALSE` の名前、日付順）
- `TEXT()` の書式文字、キーワード、色名、月名、曜日名
- 文字列の比較、並べ替え、検索、グループ化、型変換（文字幅とかなの扱いを含む）
- R1C1 参照の文字と `CELL()` のコード
- `FORMULATEXT()` の関数名と区切り文字（Excel に別名がある場合を含む）
- DBCS コードページと 1 バイトの `CHAR()` / `CODE()` ページ
- `GROUPBY()` / `PIVOTBY()` のラベル
- 環境依存の `INFO()` の値
- シート名の規則（`win-*` プロファイルでは、追加と名前変更で大文字小文字を問わず `History` を拒否し、`mac-*` プロファイルでは受け付けます）
- ピボットテーブルのラベルとレイアウトの既定値

数式は、英語の関数名と不変の区切り文字で保存されます。プロファイルが変えるのは数式テキストの解釈と結果の表示であり、保存形式ではありません。`functionMetadata(name)` はロケールに依存せず、構造的なメタデータを返します。利用者向けの関数名や数式テキストを変える場合は、プロファイル対応のローカライズメソッドを使ってください。[ワークブックの言語ガイド](/ja/workbook/language)で境界を、[セルの言語切り替え](/ja/cell/language-switching)でエディターの挙動を説明しています。

::: warning プロファイルを暗黙に切り替えない
同じ数式に見えても、別プロファイルで再計算すると結果が変わる場合があります。アプリが対象にするプロファイル ID を永続化し、起動時に確認してください。
:::

## プロファイルの選択と永続化

JavaScript バインディングでは次のように選択します。

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

プロファイルはランタイム全体のフラグではなく、ワークブックのインスタンスに属します。そのため同じプロセスで異なるプロファイルのワークブックを共存させられます。プロファイルは XLSX / XLSB ファイルへシリアライズされません。アプリケーションの状態として ID を保存し、読み込み後に再適用してください。プロファイルを変更すると数式は再計算待ちになります。値を読む前に `recalc()` を呼び出してください。

## 次に読むもの

- [互換性モデル](/ja/compatibility/model) ─ なぜプロファイルが必要か
- [テキスト照合](/ja/compatibility/text-collation) ─ プロファイルごとの比較、並べ替え、検索の強度
- [ワークブックの言語](/ja/workbook/language) ─ 数式テキストと関数名のローカライズ
- [セルの言語切り替え](/ja/cell/language-switching) ─ エディター言語の実行時切り替え
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ プロファイルを裏付けるデータ

事実の根拠は Formulon の `src/excel_profile.h`、`src/excel_locale.h`、`src/excel_locale.cpp` と、ロケールおよび照合の Oracle 検証データです。
