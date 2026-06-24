# OpenFrame Rust client (`openframe-agent-lib`)

This Cargo workspace holds the cross-platform OpenFrame agent, published as the
library crate **`openframe-agent-lib`** (crate/lib name `openframe`). The tenant
repos (`openframe-oss-tenant`, `openframe-saas-tenant`) depend on this library
and ship only a thin binary that calls `openframe::run()`.

```
clients/
├── Cargo.toml          # workspace + shared clippy lints
├── rustfmt.toml        # formatting config
├── Makefile            # fmt / clippy / build / hooks
├── .githooks/          # pre-commit (fmt) + pre-push (clippy)
└── openframe-client/   # the library crate (openframe-agent-lib)
```

## One-time setup

```bash
# from the repo root
make -C clients setup-hooks
```

This enables the committed git hooks:

- **pre-commit** → `cargo fmt --all -- --check` (fails on unformatted Rust).
- **pre-push** → `cargo clippy --all-targets --all-features -- -D warnings`.

Both hooks only fire when the change touches the Rust client, and skip cleanly
if `cargo` is not installed, so they do not get in the way of Java-only work.
CI (`.github/workflows/rust-client.yml`) runs the same gate authoritatively.

Requires a stable Rust toolchain (`rustup` recommended) with the `rustfmt` and
`clippy` components.

## Common commands

All commands run from `clients/` (or `make -C clients <target>` from the root).
`OPENFRAME_VERSION` is injected at build time (defaults to `0.0.0-dev`).

```bash
make fmt          # format the workspace
make lint         # fmt --check + clippy -D warnings (the required gate)
make build        # release build of the library only

make build-bin    # build the openframe-client binary (enables the `bin` feature)
make run-bin ARGS="--help"     # run the binary locally
make run-bin ARGS="doctor"
```

The binary is **off by default** (`cargo build` produces the library only); it is
gated behind the `bin` cargo feature so the crate stays lean for library consumers.

## Consuming the library from a tenant repo

Tenant bin crates depend on this library via a git dependency:

```toml
[dependencies]
# Production: pin a tag for stability
# openframe-agent-lib = { git = "https://github.com/flamingo-stack/openframe-oss-lib.git", tag = "v0.1.0" }
# Development: track main (default)
openframe-agent-lib = { git = "https://github.com/flamingo-stack/openframe-oss-lib.git", branch = "main" }
```

Their `main.rs` is simply:

```rust
fn main() -> anyhow::Result<()> {
    openframe::run()
}
```
