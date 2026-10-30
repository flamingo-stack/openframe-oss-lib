/// Apple silicon first, then Intel.
pub(crate) const PATHS: [&str; 2] = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"];

/// A bash script that runs `body` with `$BREW` set to the first executable of [`PATHS`].
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub(crate) fn script(body: &str) -> String {
    format!(
        "#!/bin/bash\nset -euo pipefail\nfor BREW in {}; do if [ -x \"$BREW\" ]; then break; fi; done\n{body}",
        PATHS.join(" ")
    )
}
