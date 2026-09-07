#!/bin/bash
set -euo pipefail

# --- 1. Idempotency: if Homebrew is already installed, stop here ---
if command -v brew >/dev/null 2>&1 || [ -x /opt/homebrew/bin/brew ] || [ -x /usr/local/bin/brew ]; then
  echo "brew already installed"
  exit 0
fi

# --- 2. Resolve the logged-in (console) user ---
# We run as root (LaunchDaemon), but Homebrew refuses root, so brew must run as a real user.
CONSOLE_USER=$(/usr/bin/stat -f %Su /dev/console)
if [ -z "$CONSOLE_USER" ] || [ "$CONSOLE_USER" = "root" ] || [ "$CONSOLE_USER" = "loginwindow" ]; then
  # Nobody logged in -> cannot run brew now. Defer (retry later), not a failure.
  echo "no active console user; deferring"
  exit 75
fi
CONSOLE_UID=$(/usr/bin/id -u "$CONSOLE_USER")

# --- 3. Ensure Xcode Command Line Tools (brew needs git + compilers) ---
if ! /usr/bin/xcode-select -p >/dev/null 2>&1; then
  # This touch file makes `softwareupdate` expose the CLT package for a headless install.
  CLT_FLAG=/tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress
  /usr/bin/touch "$CLT_FLAG"
  CLT_LABEL=$(/usr/sbin/softwareupdate -l 2>/dev/null \
    | awk '/\* Label: Command Line Tools/ {sub(/^ *\* Label: /,""); print}' | tail -n1)
  [ -n "$CLT_LABEL" ] && /usr/sbin/softwareupdate -i "$CLT_LABEL" --verbose || true
  /bin/rm -f "$CLT_FLAG"
  # If CLT still absent, brew would be non-functional -> defer.
  /usr/bin/xcode-select -p >/dev/null 2>&1 || { echo "Command Line Tools missing; deferring"; exit 75; }
fi

# --- 4. Pre-create the prefix and give it to the user (so the installer needs no sudo) ---
if [ "$(/usr/bin/uname -m)" = "arm64" ]; then
  PREFIX=/opt/homebrew                       # Apple Silicon default prefix
  /bin/mkdir -p "$PREFIX"
  /usr/sbin/chown -R "$CONSOLE_USER:admin" "$PREFIX"
else
  PREFIX=/usr/local                          # Intel prefix (shared dir)
  # Chown only Homebrew's own subdirs, not all of /usr/local, to avoid breaking other software.
  for d in bin etc include lib sbin share var opt Cellar Caskroom Frameworks Homebrew; do
    /bin/mkdir -p "$PREFIX/$d"
    /usr/sbin/chown "$CONSOLE_USER:admin" "$PREFIX/$d"
  done
fi

# --- 5. Run the official installer AS the user, fully unattended ---
# launchctl asuser bridges into the user's session; sudo -u drops root -> the user.
# NONINTERACTIVE=1 skips prompts; prefix is pre-owned + CLT present.
/bin/launchctl asuser "$CONSOLE_UID" /usr/bin/sudo -u "$CONSOLE_USER" -H \
  /bin/bash -c 'NONINTERACTIVE=1 /bin/bash -c "$(/usr/bin/curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'

# --- 6. Verify brew works as the user ---
/bin/launchctl asuser "$CONSOLE_UID" /usr/bin/sudo -u "$CONSOLE_USER" "$PREFIX/bin/brew" --version
