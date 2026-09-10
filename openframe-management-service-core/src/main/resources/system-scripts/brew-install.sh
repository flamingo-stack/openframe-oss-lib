#!/bin/bash
set -euo pipefail

# Install a Homebrew package. The package token(s) arrive as arguments:
#   brew-install.sh --cask slack   -> brew install --cask slack
#   brew-install.sh wireshark      -> brew install wireshark
# Runs as the logged-in user (USER privilege). Homebrew itself is provisioned separately.

if [ "$#" -eq 0 ]; then
  echo "no package specified"
  exit 64
fi

# Locate brew (Apple Silicon / Intel prefixes), falling back to PATH.
if [ -x /opt/homebrew/bin/brew ]; then
  BREW=/opt/homebrew/bin/brew
elif [ -x /usr/local/bin/brew ]; then
  BREW=/usr/local/bin/brew
else
  BREW=brew
fi

"$BREW" install "$@"
