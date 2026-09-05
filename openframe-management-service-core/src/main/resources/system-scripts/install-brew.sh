set -euo pipefail
{ [ -x /opt/homebrew/bin/brew ] || [ -x /usr/local/bin/brew ]; } && { echo "brew already installed"; exit 0; }

CONSOLE_USER=$(/usr/bin/stat -f %Su /dev/console)
{ [ -n "$CONSOLE_USER" ] && [ "$CONSOLE_USER" != "root" ]; } || { echo "no active console user"; exit 1; }

if [ "$(/usr/bin/uname -m)" = "arm64" ]; then
  PREFIX=/opt/homebrew
  /bin/mkdir -p "$PREFIX"
  /usr/sbin/chown "$CONSOLE_USER:admin" "$PREFIX"
  /usr/bin/sudo -u "$CONSOLE_USER" /bin/bash -c \
    'curl -fsSL https://github.com/Homebrew/brew/tarball/HEAD | tar xz --strip-components 1 -C /opt/homebrew'
  /usr/bin/sudo -u "$CONSOLE_USER" /opt/homebrew/bin/brew --version
else
  PREFIX=/usr/local/Homebrew
  /bin/mkdir -p "$PREFIX" /usr/local/bin
  /usr/sbin/chown -R "$CONSOLE_USER:admin" "$PREFIX"
  /usr/bin/sudo -u "$CONSOLE_USER" /bin/bash -c \
    'curl -fsSL https://github.com/Homebrew/brew/tarball/HEAD | tar xz --strip-components 1 -C /usr/local/Homebrew'
  /bin/ln -sf "$PREFIX/bin/brew" /usr/local/bin/brew
  /usr/bin/sudo -u "$CONSOLE_USER" /usr/local/bin/brew --version
fi
