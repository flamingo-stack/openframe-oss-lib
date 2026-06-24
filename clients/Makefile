# Makefile for the OpenFrame Rust client workspace (openframe-agent-lib).
# Run from this directory, or from the repo root via `make -C clients <target>`.

CARGO ?= cargo
OPENFRAME_VERSION ?= 0.0.0-dev
ARGS ?=

# Optional cross-compilation target, e.g. TARGET=x86_64-pc-windows-msvc
TARGET ?=
ifneq ($(TARGET),)
  TARGET_FLAG := --target $(TARGET)
endif

.PHONY: fmt fmt-check clippy lint build build-bin run-bin test clean setup-hooks

# Format all code in the workspace.
fmt:
	$(CARGO) fmt --all

# Check formatting without modifying files (pre-commit gate).
fmt-check:
	$(CARGO) fmt --all -- --check

# Lint with clippy across all targets/features; any warning fails (pre-push + CI gate).
clippy:
	OPENFRAME_VERSION=$(OPENFRAME_VERSION) $(CARGO) clippy --all-targets --all-features $(TARGET_FLAG) -- -D warnings

# Run fmt-check then clippy.
lint: fmt-check clippy

# Build the library (release).
build:
	OPENFRAME_VERSION=$(OPENFRAME_VERSION) $(CARGO) build --release --locked $(TARGET_FLAG)

# Build the openframe-client binary (enables the `bin` feature).
build-bin:
	OPENFRAME_VERSION=$(OPENFRAME_VERSION) $(CARGO) build --release --locked --features bin --bin openframe-client $(TARGET_FLAG)

# Run the binary locally, e.g. `make run-bin ARGS="--help"`.
run-bin:
	OPENFRAME_VERSION=$(OPENFRAME_VERSION) $(CARGO) run --features bin --bin openframe-client -- $(ARGS)

# Run tests.
test:
	OPENFRAME_VERSION=$(OPENFRAME_VERSION) $(CARGO) test --locked $(TARGET_FLAG)

# Remove build artifacts.
clean:
	$(CARGO) clean

# Enable the committed git hooks (fmt on pre-commit, clippy on pre-push). Run once after cloning.
setup-hooks:
	git config core.hooksPath "$$(git rev-parse --show-toplevel)/clients/.githooks"
	@echo "Git hooks enabled: pre-commit = cargo fmt --check, pre-push = cargo clippy -D warnings."
