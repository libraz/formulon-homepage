---
title: formulon-cell のテーマ
description: formulon-cell の同梱テーマ、data-fc-theme の仕組み、--fc-* / --fc-tb-* トークン語彙。
---

# テーマ

`formulon-cell` は 3 つの完全なテーマと公開 CSS 変数語彙を同梱しており、ホストはスタイルシートを fork せずに chrome の見た目を変えられます。これは Formulon 結合試験のための参考 UI であって、テーマ可能なデザインシステム製品ではありません ─ 以下のトークンセットがサポート対象の上書き面で、同梱 CSS のそれ以外はリリース間で変わりうる実装詳細です。

::: info 用語: テーマとトークン
*テーマ* は公開トークン全体に値を割り当てた一式です（`paper` / `ink` / `contrast`）。*トークン* は 1 個の `--fc-*` カスタムプロパティです。テーマを切り替えるとすべてのトークンが一括で再割り当てされ、トークンを上書きするとアクティブなテーマに関係なくその 1 値だけが変わります。
:::

## 同梱テーマ

| テーマ | `data-fc-theme` の値 | 見た目 |
| --- | --- | --- |
| Paper | `paper`（属性が無い場合のデフォルトでもある） | 明るいスプレッドシート調 |
| Ink | `ink` | ダークモード |
| Contrast | `contrast` | WCAG-AAA のハードエッジコントラスト ─ 柔らかい影の代わりにソリッドな輪郭線 |

```ts
instance.setTheme('paper')
instance.setTheme('ink')
instance.setTheme('contrast')
```

## `data-fc-theme` の仕組み

`SpreadsheetInstance.setTheme(name)` は `.fc-host` に `data-fc-theme` 属性を書き込むだけです ─ スタイルシートの差し替えも DOM の reflow も行いません。同梱の 3 テーマファイルは、それぞれこの属性にスコープしてトークンを割り当てています。

| テーマファイル | セレクタ |
| --- | --- |
| `theme-paper.css` | `.fc-host:not([data-fc-theme])` と `.fc-host[data-fc-theme="paper"]` |
| `theme-ink.css` | `.fc-host[data-fc-theme="ink"]` |
| `theme-contrast.css` | `.fc-host[data-fc-theme="contrast"]` |

属性の更新後にインスタンスのイベントバスで `themeChange` が発火するため、ホスト側の chrome（テーマスイッチャや設定の永続化）は DOM をポーリングせずに反応できます。

同梱テーマは `@layer fc.theme` の中で宣言されているため、ホスト側の上書きに詳細度の勝負は不要です。カスケードレイヤの外に書いたルールは、パッケージが出荷するレイヤ内のルールすべてに勝ちます。

<CellTokenCascade :labels="{
  paperNote: '.fc-host:not([data-fc-theme]) ─ 属性が無い場合のデフォルト',
  attrNote: 'setTheme() が書く data-fc-theme で選択される',
  hostTag: 'すべての @layer の外',
  host: '.fc-host かその祖先に書いたホスト側 CSS',
  resolvedTag: '解決値',
  resolved: 'グリッドが実際に塗る値',
  resolvedNote: 'リボンの --fc-tb-accent は --fc-accent にフォールバック',
  caption: '下の帯ほど強い。レイヤ外のホスト CSS は、セレクタに関係なく同梱テーマのどのルールにも勝つ。',
  aria: 'formulon-cell のトークン優先順位: @layer fc.theme の同梱テーマファイルをレイヤ外のホスト CSS が上書きし、グリッドが塗る値が決まる図'
}" />

::: tip カスタムテーマ名も同じ仕組みで動く
`setTheme('brand')` は `data-fc-theme="brand"` を書き込みます。登録手続きはありません ─ どんな文字列でも受け付けられ、その属性値にマッチするルールに対して通常のカスケードでトークンが解決されるだけです。
:::

## `--fc-*` トークン語彙

以下のトークンはすべて `tokens.css` で宣言されており、`.fc-host`（またはその祖先）に安全に設定できます ─ エディタツーリング（VS Code の CSS IntelliSense）がこのファイルを読んで語彙の自動補完を出します。そこに載っていないトークンは内部用で、メジャーバージョンを上げずに改名される可能性があります。

| グループ | 代表的なトークン | 塗る対象 |
| --- | --- | --- |
| サーフェス | `--fc-bg`, `--fc-bg-elev`, `--fc-bg-rail`, `--fc-bg-header`, `--fc-bg-hover` | セル領域、数式バー / ステータスバー、ヘッダーレール、ホバー行 |
| 前景 | `--fc-fg`, `--fc-fg-strong`, `--fc-fg-mute`, `--fc-fg-faint` | デフォルトから disabled / placeholder までのセルテキスト階調 |
| 罫線 | `--fc-rule`, `--fc-rule-strong`, `--fc-rule-soft`, `--fc-rule-subtle`, `--fc-hairline` | グリッド線、ヘッダー区切り、リスト区切り、ヘアライン幅 |
| アクセント | `--fc-accent`, `--fc-accent-strong`, `--fc-accent-soft`, `--fc-accent-fg` | 選択範囲の輪郭、フォーカスリング、プライマリボタン |
| セル値 | `--fc-cell-error-fg`, `--fc-cell-formula-fg`, `--fc-cell-bool-fg`, `--fc-cell-num-fg` | `#REF!` / `#DIV/0!` のテキスト、数式の表示モード、`TRUE` / `FALSE`、右寄せ数値 |
| ヘッダーレール | `--fc-header-fg`, `--fc-header-fg-active`, `--fc-header-bg`, `--fc-header-rule` | 列文字 / 行番号、アクティブヘッダーの強調 |
| ホバー | `--fc-hover-stripe`, `--fc-selection-fill` | ホバー中の行 / 列ストライプ、アクティブ範囲の塗り |
| タイポグラフィ | `--fc-font-ui`, `--fc-font-mono`, `--fc-font-display`, `--fc-text-cell`, `--fc-text-header`, `--fc-text-formula`, `--fc-text-rail`, `--fc-leading-cell`, `--fc-tracking-tight`, `--fc-tracking-wide` | UI chrome、セル内容、ステータスバーラベル、サイズ |
| 角丸 | `--fc-radius-sm`, `--fc-radius-md`, `--fc-radius-lg` | ダイアログとポップオーバーの角丸半径 |
| セルの書式設定ダイアログ | `--fc-fmtdlg-border-diag-color`, `--fc-fmtdlg-border-diag-width` | 罫線タブの斜め罫線スウォッチ |
| メニューアイコン | `--fc-menu-icon`, `--fc-menu-icon-color` | 行ごとの data-URL マスクと色。メニュー項目単位で JS から設定 |
| モーション | `--fc-dur-fast`, `--fc-dur-base`, `--fc-dur-slow`, `--fc-ease-out`, `--fc-ease-in-out` | トランジションの時間とイージング |
| 立体感 | `--fc-shadow-2`, `--fc-shadow-4`, `--fc-shadow-8`, `--fc-shadow-16` | ステータスバーの浮き、ポップオーバー、メニュー、モーダルダイアログ（ピクセル値ではなくサーフェス単位で使う） |

```css
.my-spreadsheet .fc-host {
  --fc-accent: #d63384;
  --fc-bg-rail: #fff8f0;
}

/* あるいはカスタムテーマ名にスコープし、data-fc-theme で切り替える */
.fc-host[data-fc-theme="brand"] {
  --fc-accent: #d63384;
}
```

::: info スタッキング基準のトークンは `.fc-host` ではなく `:where(html)` にある
`--fc-z-base`、`--fc-z-grid`、`--fc-z-dialog`、`--fc-z-tooltip`、`--fc-z-popover`、`--fc-z-callout`、`--fc-z-menu`、`--fc-z-error` はフローティング UI（コンテキストメニュー、自動補完、ツールチップなど）の重なり順を制御し、その一部は `.fc-host` サブツリーの外へポータルされます。上書きは `.fc-host` 自身ではなく、`:root` / `html` かそれを包む祖先で行ってください。
:::

## `--fc-tb-*` ツールバートークン

リボンツールバーのオーバーライド可能なトークンは `--fc-tb-*` 語彙で提供されます。グリッドの `--fc-*` とは別に保たれますが、同じ `data-fc-theme` 属性を通じて到達できます。代表例: `--fc-tb-ribbon-bg`、`--fc-tb-ribbon-rail`、`--fc-tb-ribbon-hover`、`--fc-tb-accent`、`--fc-tb-accent-strong`、`--fc-tb-accent-soft`。

ツールバーは共有された `data-fc-theme` から同じ `paper` / `ink` / `contrast` の値を読むため、この属性をグリッドとツールバーの共通祖先に置く（あるいは `instance.setTheme(name)` を呼ぶ）だけで両面が同時にテーマ切り替えされます。

```css
.fc-host[data-fc-theme="ink"] { --fc-tb-ribbon-bg: #201f1e; /* … */ }
```

::: tip テーマ語彙もアクセントも 1 つ
リボンを `.fc-host` の内部にマウントした場合（単一呼び出しの `mount({ toolbar })`）、`--fc-tb-accent` / `--fc-tb-accent-strong` はグリッドの `--fc-accent` / `--fc-accent-strong` にフォールバックするため、`.fc-host { --fc-accent: … }` を 1 つ上書きすれば両面がテーマされます。独立ツールバー（ホストが `.fc-host` 配下にない）は `--fc-tb-*` のリテラル値を保ちますが、その値はグリッドのテーマ別アクセントと一致するため、どちらのマウント方法でも見た目は同一になります。
:::

## ブランドテーマの作り方

テーマ済みスプレッドシートを出荷するには、同梱テーマファイル（`theme-paper.css`、`theme-ink.css`、`theme-contrast.css`）のいずれかを出発点としてコピーし、セレクタの `data-fc-theme` 値を変えたうえで、ブランドに本当に必要なトークンだけを上書きします ─ 残りはコピー元のベーステーマの値がそのまま効きます。

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

::: tip トークンを増やすかリテラルで書くか
値がテーマ間で異なるとき、利用側が上書きしたくなるのが自然なとき、同じ値が 3 か所以上に現れるときは、ドキュメント化されたトークンを使ってください。1 回限りの装飾（チャートの凡例、スウォッチグリッド、アイコングリフ）はリテラルで構いません ─ それらはテーマ対象の面ではありません。
:::

## 次に読むもの

- [API 一覧](/ja/cell/api#テーマコントローラ) ─ `SpreadsheetInstance` の `setTheme()`
- [埋め込みガイド](/ja/cell/embedding) ─ プリセット / 拡張の組み合わせ
- [拡張カタログ](/ja/cell/extensions) ─ ファクトリ単位の機能リファレンス
