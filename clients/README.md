# OpenFrame Rust client (`openframe-agent-lib`)

This Cargo workspace holds the cross-platform OpenFrame agent, published as the
library crate **`openframe-agent-lib`** (crate/lib name `openframe`). The tenant
repos (`openframe-oss-tenant`, `openframe-saas-tenant`) depend on this library
and ship only a thin binary that calls `openframe::run()`.

```
clients/
├── Makefile            # hook setup only: `make -C clients setup-hooks`
├── Cargo.toml          # workspace + shared clippy lints
├── rustfmt.toml        # formatting config
├── .githooks/          # pre-commit (fmt) + pre-push (clippy)
└── openframe-client/   # the library crate (openframe-agent-lib)
    └── Makefile        # fmt / fmt-check / clippy / lint / build / test
```

## One-time setup

```bash
# from the repo root
make -C clients setup-hooks
```

This enables the committed git hooks:

- **pre-commit** → `cargo fmt --all -- --check` (fails on unformatted Rust).
- **pre-push** → `cargo clippy --all-targets -- -D warnings`.

Both hooks only fire when the change touches the Rust client, and skip cleanly
if `cargo` is not installed, so they do not get in the way of Java-only work.
CI (`.github/workflows/rust-client.yml`) runs the same gate authoritatively.

Requires a stable Rust toolchain (`rustup` recommended) with the `rustfmt` and
`clippy` components.

## Common commands

Dev commands live in the crate's own Makefile — run from
`clients/openframe-client` (or `make -C clients/openframe-client <target>`).
`OPENFRAME_VERSION` is injected at build time (defaults to `0.0.0-dev`).

```bash
make fmt          # format
make lint         # fmt --check + clippy -D warnings (the required gate)
make build        # release build of the library
make test         # build + test
```

The binary is **off by default** — it is gated behind the `bin` cargo feature so
the crate stays lean for library consumers. To build/run it directly here:

```bash
OPENFRAME_VERSION=0.0.0-dev cargo build --features bin --bin openframe-client
OPENFRAME_VERSION=0.0.0-dev cargo run   --features bin --bin openframe-client -- --help
```

## Consuming the library from a tenant repo

Tenant bin crates depend on this library via a git dependency pinned to a
release tag:

```toml
[dependencies]
openframe-agent-lib = { git = "https://github.com/flamingo-stack/openframe-oss-lib.git", tag = "v0.1.0" }
```

Their `main.rs` is simply:

```rust
fn main() -> anyhow::Result<()> {
    openframe::run()
}
```
