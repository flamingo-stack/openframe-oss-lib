# OpenFrame Rust client (`openframe-agent-lib`)

This directory holds the cross-platform OpenFrame agent, published as the
standalone library crate **`openframe-agent-lib`** (crate/lib name `openframe`).
The tenant repos (`openframe-oss-tenant`, `openframe-saas-tenant`) depend on this
library and ship only a thin binary that calls `openframe::run()`.

Each crate under `clients/` is standalone (its own `Cargo.toml`, `Cargo.lock`,
lints and build `Makefile`), so a future `clients/openframe-chat` is fully
independent. Shared, repo-level tooling stays here at `clients/`.

```
clients/
├── Makefile            # hook setup only: `make -C clients setup-hooks`
├── rustfmt.toml        # formatting config (applies to every crate below it)
├── .githooks/          # pre-commit (fmt) + pre-push (clippy)
└── openframe-client/   # the standalone library crate (openframe-agent-lib)
    ├── Cargo.toml      # incl. [lints.clippy] policy
    ├── Cargo.lock
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

## OpenFrame Client (device agent): install, enrol, remove

`openframe-client/` is the source of the OpenFrame device agent, published by Flamingo as a prebuilt, signed binary (macOS: Developer ID signed and notarized universal binary; Windows: Authenticode-signed x64 executable). Official downloads, always the current production release: `https://openframe.ai/v0/api/assets/download?agent=client&platform=macos` and `...&platform=windows`.

Installation is two steps. Step 1 registers the agent as a system service; step 2 connects it to your OpenFrame tenant. Between the two steps the service waits idle and sends nothing anywhere.

Step 1: extract the archive and run `sudo ./openframe-client install` (macOS) or `.\openframe-client.exe install` (Windows, elevated). The downloaded file is named `openframe-client`.

Step 2, on every platform, with the values shown in your dashboard under **Devices → Add device** (a new terminal on Windows, because the install adds the program folder to PATH):

    sudo openframe-client auth --serverUrl <tenant host> --initialKey <key> --orgId <organization id> --userId <user id>

What the commands do:

- `install` (administrator/sudo, no arguments): copies the binary to `/usr/local/bin/openframe-client` or `C:\Program Files\OpenFrame\bin\`, registers the system service `com.openframe.client` (a LaunchDaemon running as root on macOS, a Windows service on Windows) and starts it.
- `auth` (administrator/sudo): validates the parameters and the network path to the tenant, writes the configuration, restarts the service; the device registers within a minute.
- `doctor`: read-only health check of the installed agent.
- `uninstall` (administrator/sudo): stops and removes the service, deregisters the device from the tenant, uninstalls the integrated tools, deletes the binaries and the data directory.

Files: data and configuration in `/Library/Application Support/OpenFrame/` or `C:\ProgramData\OpenFrame\`; logs in `/Library/Logs/OpenFrame/` or `C:\ProgramData\OpenFrame\logs\`; the macOS service definition at `/Library/LaunchDaemons/com.openframe.client.plist`.

Updates are delivered by the OpenFrame platform. Re-running `install` on an enrolled device deregisters it and returns it to the waiting state; run `auth` again afterwards. The device keeps its identity, so re-authenticating re-registers the same device.
