// Thin entry point for the OpenFrame client binary.
// Built only with `--features bin`; all logic lives in the library's `openframe::run`.
fn main() -> anyhow::Result<()> {
    openframe::run()
}
