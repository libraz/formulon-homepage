# C++ Core

The core is C++17 and follows a small-dependency, predictable-embedding approach. The same C++ source can be built as a native library, a WebAssembly module, or a CLI binary.

::: info Glossary: predictable embedding
Build choices that minimize surprises when the core is linked into a host application. No exceptions, no RTTI, no global allocators, no UB-prone shortcuts. The goal is "the embedder's existing build flags do not change Formulon's behavior."
:::

::: info Glossary: `Expected<T, Error>`
A return type that carries either a success value or an error code, instead of using exceptions. Equivalent in spirit to `std::expected`, `absl::StatusOr`, and `Result<T, E>` in Rust. Callers branch on the result; no unwinding crosses the C ABI boundary.
:::

## Key choices

- **RAII** for lifetime management — every resource is owned by an object whose destructor releases it.
- **`Expected<T, Error>`** style error handling — fallible operations return a value instead of throwing.
- **`-fno-exceptions` and `-fno-rtti`** — predictable codegen, smaller binaries, no hidden control flow.
- **In-tree implementations** for spreadsheet-specific logic (formula parser, date math, OOXML quirks) where generic libraries would add size or semantic risk.
- **`miniz`** for ZIP container reading / writing.
- **`pugixml`** for XML / XPath 1.0.

## What the core must not depend on

The core should stay independent of browser, Python, and CLI assumptions:

- No Emscripten-only types in the public ABI.
- No `std::filesystem` for paths a binding might provide differently.
- No environment variables or other mutable state that the host cannot reset.
- Keep mutable workbook state inside the workbook.
- Thread-local diagnostics and random-number state remain implementation details; bindings expose parallel recalculation while scheduling remains in the core.

## Why these constraints

| Constraint | Reason |
| --- | --- |
| No exceptions | The C ABI cannot unwind across hosts; exceptions would force every binding to wrap calls in catch blocks |
| No RTTI | Smaller binaries; the engine never needs to dynamically inspect types |
| Small dependency set | WASM size budget, build reproducibility, fewer indirect license checks |
| In-tree spreadsheet logic | Excel semantics are not reusable from generic math libraries; embedding our own keeps oracle alignment under our control |

## Read next

- [Architecture](/development/architecture) — where the core sits in the broader picture.
- [Bindings](/development/bindings) — what calls into the core.
- [Size budgets](/development/size-budgets) — why the dependency set stays small.
