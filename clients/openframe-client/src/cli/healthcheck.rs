use std::process;

use tokio::runtime::Runtime;

pub(super) fn run(rt: &Runtime) -> ! {
    let report = rt.block_on(crate::doctor::run_healthcheck());
    report.print();

    if report.has_failures() {
        println!(
            "\n{} check(s) failed. Please fix the issues above and try again.",
            report.failure_count()
        );
        process::exit(1);
    }

    let warns = report.warn_count();
    if warns > 0 {
        println!(
            "\n{} warning(s). The agent may have connectivity issues.",
            warns
        );
        process::exit(1);
    }

    println!("\nAll checks passed.");
    process::exit(0);
}
