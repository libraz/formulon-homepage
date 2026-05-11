# C++ Core

The core is C++17 and follows a small-dependency, predictable-embedding approach. The same source compiles to a native library, a WebAssembly module, and a CLI binary.

::: info Glossary: predictable embedding
Build choices that minimize surprises when the core is linked into a host application. No exceptions, no RTTI, no global allocators, no UB-prone shortcuts. The goal is "the embedder's existing build flags do not change Formulon's behavior."
:::

::: info Glossary: `Expected<T, Error>`
A return type that carries either a success value or an error code, instead of using exceptions. Equivalent in spirit to `std::expected`, `absl::StatusOr`, and `Result<T, E>` in Rust. Callers branch on the result; no unwinding crosses the C ABI boundary.
:::

## Key choices

- **RAII** for lifetime management — every resource is owned by an object whose destructor releases it.
- **`Expected<T, Error>`** style error handling — fallible operations return a value, not throw.
- **`-fno-exceptions` and `-fno-rtti`** — predictable codegen, smaller binaries, no hidden control flow.
- **In-tree implementations** for spreadsheet-specific logic (formula parser, date math, OOXML quirks) where generic libraries would add size or semantic risk.
- **`miniz`** for ZIP container reading / writing.
- **`pugixml`** for XML / XPath 1.0.

## What the core must not depend on

The core should stay independent of browser, Python, and CLI assumptions:

- No Emscripten-only types in the public ABI.
- No `std::filesystem` for paths a binding might provide differently.
- No environment variables, no global state that a host cannot reset.
- No threading primitives that assume a specific scheduler — recalculation uses a controlled worker pool exposed through the binding layer.

## Why these constraints

| Constraint | Reason |
| --- | --- |
| No exceptions | The C ABI cannot unwind across hosts; exceptions would force every binding to wrap calls in catch blocks |
| No RTTI | Smaller binaries and stable symbol layout; the engine never needs to dynamically inspect types |
| Small dependency set | WASM size budget, build reproducibility, fewer transitive licenses |
| In-tree spreadsheet logic | Excel semantics are not reusable from generic math libraries; embedding our own keeps oracle alignment under our control |

## Read next

- [Architecture](/development/architecture) — where the core sits in the broader picture.
- [Bindings](/development/bindings) — what calls into the core.
- [Size budgets](/development/size-budgets) — why the dependency set stays small.
