# ロケールプロファイル

Excel の挙動は完全にはロケール非依存ではありません。関数名・区切り文字・日付解析・文字幅・通貨・テキスト処理が platform と locale で変わることがあります。そのため Formulon は単一のグローバル互換モードではなく、名前付き **プロファイル** を公開します。

::: info 用語: compatibility profile（互換性プロファイル）
Excel build と locale の組に名前を付け、Formulon がそれと一致することを示す oracle データを紐付けたもの。ロケール依存の関数挙動はこの profile に従います。アプリやテストはホスト OS の locale ではなく profile を明示的に pin します。
:::

## 現在のプロファイル

| Profile | 状態 | 目的 |
| --- | --- | --- |
| `win-365-ja_JP` | 既定 | 主な実行ターゲット |
| `mac-365-ja_JP` | oracle-backed | 比較と回帰追跡 |

英語ロケールの profile は、対応する oracle coverage が用意できてから公開します。データが揃わない profile は「未検証の互換性を匂わせない」ために非公開のままです。

## profile が評価に与える影響

ロケール依存の領域は次のようなものです（網羅ではありません）。

- 一部レガシーパスでの引数 / リスト区切り
- `TEXT()` / `VALUE()` の整形ルール
- `DATEVALUE()` / `TIMEVALUE()` の解析
- 通貨・会計の数値書式
- 関数名のエイリアス（非英語 Excel の翻訳名）
- 半角 / 全角混在ワークブックでの `LEN` と文字幅処理

::: warning profile を暗黙に切り替えない
同じ数式に見えても、別 profile で再計算すると結果が変わる場合があります。アプリや CI は対象 profile を保存・主張し、起動時に確認してください。
:::

## profile の保存

各 binding 経由:

```ts
wb.setExcelProfileId('win-365-ja_JP')
const id = wb.excelProfileId()
```

```python
wb.set_excel_profile_id('win-365-ja_JP')
```

profile はワークブックの寿命に紐づく状態であり、ランタイムのグローバルフラグではありません。同じプロセス内のワークブックがそれぞれ別 profile を持って共存できます。

## 次に読むもの

- [互換性モデル](/ja/compatibility/model) ─ なぜ profile が必要か
- [Oracle テスト](/ja/compatibility/oracle-testing) ─ profile を裏付けるデータ
