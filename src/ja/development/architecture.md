# アーキテクチャ

Formulon は 1 つの計算コアと、その周りを薄く包むパッケージング層で構成されています。WASM / Native Node / Python / CLI / MCP / `formulon-cell` のいずれも、同じ C++17 コアを C ABI 経由で利用します。

::: info 用語: C ABI 層
C++ 以外のホストにワークブックモデル・評価器・IO を公開するフラットな C 関数インタフェースです。安定境界はここだけで、バインディングはこれを呼び、実装はコア側にしかありません。詳しくは [バインディング](/ja/development/bindings)。
:::

::: info 用語: workbook モデル
開かれたワークブックを表すメモリ上の表現です。sheets / cells / styles / defined name / table / 依存関係グラフ / dirty 集合 / profile / 再計算に必要なエンジン状態を持ちます。バインディングはパース後のバイト列ではなく、このモデルへのハンドルを保持します。
:::

<DiagramLayers :layers="[
  { title: 'ホスト', nodes: ['Host API（JS / Python / CLI / MCP / cell UI）'] },
  { title: '境界', nodes: ['C ABI / バインディング層'] },
  { title: 'コア', nodes: ['C++17 ワークブックモデル'] },
  { title: '評価と IO', nodes: ['数式パーサと tree-walker 評価器', 'OOXML / XLSB の reader / writer'] },
  { title: '検証', nodes: ['Oracle テスト / 任意の VM parity'] }
]" />

## どこに何があるか

| 層 | 所有 |
| --- | --- |
| Host API | 言語別 API（JS / Python / CLI / MCP ツール / cell UI） |
| C ABI / バインディング | ライフタイム管理、ホスト値 ↔ エンジン値の変換 |
| Workbook モデル | sheet / cell / style / 依存関係グラフ / dirty 状態 / profile |
| Parser / Evaluator | 関数カタログ、本番の tree-walker、error 伝播。開発・テストビルドだけ実験的 bytecode VM を追加 |
| ファイル形式層 | OOXML / XLSB の reader / writer、passthrough 保持 |
| Oracle / parity テスト | Excel 由来の参照値、実行入口間の一致 |

コアはワークブック状態・数式の意味論・ファイルパース・依存追跡・再計算を所有します。バインディングはホスト値変換とライフタイム管理を担い、計算挙動には関与しません。

リリース用の CLI・WASM・バインディングバイナリは tree-walker を使い、実験的な bytecode compiler・optimizer・VM を含みません。開発・テストビルドでは `FORMULON_BUILD_VM=ON` でこれらをコンパイルできますが、parity 比較を有効にするのは `FORMULON_VM_PARITY_CHECK=ON` を明示したビルドだけです。

## なぜ分けるか

- **決定論的**: 計算源が 1 つなので、同じプロファイルで全実行入口が同じ値を返す。
- **組み込み**: コアは Node / Python / ブラウザの前提を持たないため、同じバイナリが 3 環境すべてを支えられる。
- **テスト**: Oracle データはエンジンそのものと突き合わせるため、各バインディングを別々に検証する必要がない。

## 次に読むもの

- [C++ コア](/ja/development/core) ─ 計算コア内部の規約
- [バインディング](/ja/development/bindings) ─ 担当 / 担当外
- [ソースからビルド](/ja/development/build-from-source) ─ 成果物の作り方
