# Install the git hooks for the Rust client (fmt on pre-commit, clippy on pre-push).
# Run once after cloning: make -C clients setup-hooks
.PHONY: setup-hooks
setup-hooks:
	git config core.hooksPath "$$(git rev-parse --show-toplevel)/clients/.githooks"
	@echo "Git hooks enabled: pre-commit = cargo fmt --check, pre-push = cargo clippy -D warnings."
