#!/bin/bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "no package specified"
  exit 64
fi

if [ -x /opt/homebrew/bin/brew ]; then
  BREW=/opt/homebrew/bin/brew
elif [ -x /usr/local/bin/brew ]; then
  BREW=/usr/local/bin/brew
else
  BREW=brew
fi

"$BREW" upgrade "$@"
