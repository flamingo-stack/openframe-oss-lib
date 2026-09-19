#!/bin/bash
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME=/var/root

for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  if [ -x "$b" ]; then
    echo "brew already installed ($("$b" --version 2>/dev/null | /usr/bin/head -n1))"; exit 0
  fi
done

CONSOLE_USER=$(/usr/sbin/scutil <<< "show State:/Users/ConsoleUser" \
  | /usr/bin/awk '/Name :/ && ! /loginwindow/ { print $3 }')
if [ -z "$CONSOLE_USER" ] || [ "$CONSOLE_USER" = "root" ]; then
  echo "no active console user; deferring"; exit 75
fi
CONSOLE_UID=$(/usr/bin/id -u "$CONSOLE_USER")

if [ "$(/usr/bin/uname -m)" = "arm64" ]; then
  PREFIX=/opt/homebrew
else
  PREFIX=/usr/local
fi
BREW_BIN="$PREFIX/bin/brew"

if ! /usr/bin/xcode-select -p >/dev/null 2>&1; then
  CLT_FLAG=/tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress
  /usr/bin/touch "$CLT_FLAG"
  CLT_LABEL=$(/usr/sbin/softwareupdate -l 2>/dev/null \
    | /usr/bin/awk '/\* Label: Command Line Tools/ {sub(/^ *\* Label: /,""); print}' | /usr/bin/tail -n1)
  [ -n "$CLT_LABEL" ] && /usr/sbin/softwareupdate -i "$CLT_LABEL" --verbose || true
  /bin/rm -f "$CLT_FLAG"
  /usr/bin/xcode-select -p >/dev/null 2>&1 || { echo "Command Line Tools missing; deferring"; exit 75; }
fi

INSTALL_SH=$(/usr/bin/curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)
INSTALL_SH_AS_ROOT=$(printf '%s\n' "$INSTALL_SH" | /usr/bin/sed '/^check_run_command_as_root$/d')
if [ "$INSTALL_SH_AS_ROOT" = "$INSTALL_SH" ]; then
  echo "root-guard line not found (install.sh changed); aborting to avoid running unpatched"; exit 1
fi
INSTALL_LOG=$(/usr/bin/mktemp /tmp/brew_bootstrap.XXXXXX)
set +e
NONINTERACTIVE=1 /bin/bash -c "$INSTALL_SH_AS_ROOT" >"$INSTALL_LOG" 2>&1
INSTALL_RC=$?
set -e
if [ ! -x "$BREW_BIN" ]; then
  echo "brew install failed (rc=$INSTALL_RC); installer output:"
  /bin/cat "$INSTALL_LOG"; /bin/rm -f "$INSTALL_LOG"; exit 1
fi
/bin/rm -f "$INSTALL_LOG"

if [ "$PREFIX" = "/opt/homebrew" ]; then
  /usr/sbin/chown -R "$CONSOLE_USER:admin" "$PREFIX"
else
  for d in Homebrew Cellar Caskroom Frameworks bin etc include lib sbin share var opt; do
    [ -e "$PREFIX/$d" ] && /usr/sbin/chown -R "$CONSOLE_USER:admin" "$PREFIX/$d" || true
  done
fi

/bin/launchctl asuser "$CONSOLE_UID" /usr/bin/sudo -u "$CONSOLE_USER" -H "$BREW_BIN" update --force >/dev/null 2>&1 || true
BREW_VERSION=$(/bin/launchctl asuser "$CONSOLE_UID" /usr/bin/sudo -u "$CONSOLE_USER" -H "$BREW_BIN" --version 2>/dev/null | /usr/bin/head -n1)
[ -n "$BREW_VERSION" ] || BREW_VERSION="Homebrew"
echo "installed $BREW_VERSION"
