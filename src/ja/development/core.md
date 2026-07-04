# C++ コア

コアは C++17 で書かれており、小さな依存セットと予測可能な組み込み挙動を重視しています。同じソースがネイティブライブラリ・WebAssembly モジュール・CLI バイナリにコンパイルされます。

::: info 用語: predictable embedding（予測可能な組み込み）
core をホストアプリにリンクしたときに、ホスト側のビルド設定が Formulon の挙動を変えないようにする方針。exception を使わず、RTTI も持たず、グローバルアロケータや UB に近いショートカットを避けます。狙いは「ホストのビルドフラグで Formulon の挙動が変わらない」こと。
:::

::: info 用語: `Expected<T, Error>`
成功値かエラーコードのどちらかを返す型。exception を投げずに失敗を表現します。`std::expected` / `absl::StatusOr` / Rust の `Result<T, E>` と同じ発想。呼び出し側は結果で分岐し、C ABI 境界を unwinding が跨ぐことはありません。
:::

## 重要な選択

- **RAII**: 全リソースを所有するオブジェクトのデストラクタで解放する。
- **`Expected<T, Error>` 型のエラー処理**: 失敗しうる操作は値で返す。throw しない。
- **`-fno-exceptions` と `-fno-rtti`**: コード生成が予測しやすく、バイナリが小さく、隠れた制御フローが無い。
- **スプレッドシート固有ロジックは in-tree 実装**: 数式パーサ・日付演算・OOXML の癖など、汎用ライブラリで実装するとサイズや意味論のリスクが大きい部分は自前で実装する。
- **`miniz`**: ZIP コンテナの読み書き。
- **`pugixml`**: XML / XPath 1.0。

## core が依存してはいけないもの

ブラウザ・Python・CLI の前提に core が侵食されないようにします。

- 公開 ABI に Emscripten 固有型を出さない。
- `std::filesystem` でホスト側に渡せないパス表現を強制しない。
- 環境変数・ホストがリセットできないグローバル状態を持たない。
- 特定スケジューラ前提のスレッドプリミティブを使わない ─ 再計算は binding 層が公開する制御済み worker pool を使う。

## 制約の理由

| 制約 | 理由 |
| --- | --- |
| 例外なし | C ABI を unwinding で跨げない。例外があると binding ごとに catch ラッパが必須になる |
| RTTI なし | バイナリが小さくシンボル配置が安定する。engine は型を動的検査する必要がない |
| 小さな依存セット | WASM サイズ予算、ビルド再現性、推移ライセンスの最小化 |
| in-tree のスプレッドシートロジック | Excel 意味論は汎用数学ライブラリでは表現しきれない。手元に置く方が oracle 整合性を制御しやすい |

## 次に読むもの

- [アーキテクチャ](/ja/development/architecture) ─ core 全体での位置づけ
- [バインディング](/ja/development/bindings) ─ core を呼ぶ層
- [サイズ予算](/ja/development/size-budgets) ─ 依存を小さく保つ理由
