# Makefile for the openframe-common crate

CARGO ?= cargo

.PHONY: fmt fmt-check clippy lint hack cross test clean

fmt:
	$(CARGO) fmt --all

fmt-check:
	$(CARGO) fmt --all -- --check

clippy:
	$(CARGO) clippy --all-targets --all-features --locked -- -D warnings

lint: fmt-check clippy

hack:
	$(CARGO) hack --feature-powerset clippy --all-targets --locked -- -D warnings

cross:
	$(CARGO) clippy --all-targets --all-features --locked --target $(TARGET) -- -D warnings

test:
	$(CARGO) test --all-features --locked

clean:
	$(CARGO) clean
