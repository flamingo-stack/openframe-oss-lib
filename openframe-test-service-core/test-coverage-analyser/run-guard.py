#!/usr/bin/env python3
"""PreToolUse guard for the headless report run.

Claude Code's permission rules match a Bash command by prefix and cannot express "writes
here, nowhere else", so the run's rules are enforced here instead: shell out only through
the read-only git shim, write only the three paths prompt.md declares writable. Exit 2
blocks the call and hands the message back to the model.
"""
import json, os, sys

ANALYSER_DIR = os.path.realpath(os.environ.get("ANALYSER_DIR", os.path.dirname(os.path.realpath(__file__))))
SHIM = os.path.join(ANALYSER_DIR, "git-ro")
WRITE_FILES = {os.path.join(ANALYSER_DIR, n) for n in ("coverage-plan.toml", "known-gaps.md")}
WRITE_TREE = os.path.join(ANALYSER_DIR, "results") + os.sep


def block(msg):
    print(msg, file=sys.stderr)
    sys.exit(2)


def main():
    try:
        event = json.load(sys.stdin)
    except Exception as e:
        block("run-guard: unreadable hook payload: %s" % e)
    tool = event.get("tool_name", "")
    args = event.get("tool_input", {}) or {}

    if tool == "Bash":
        cmd = (args.get("command") or "").strip()
        first = cmd.split()[0] if cmd.split() else ""
        if first not in ("./git-ro", SHIM):
            block("run-guard: this run may only shell out through ./git-ro (read-only git). "
                  "Refused: %s" % cmd[:200])
        if any(sep in cmd for sep in ("&&", "||", ";", "|", "$(", "`", ">")):
            block("run-guard: no shell chaining or redirection in this run. Refused: %s" % cmd[:200])
        sys.exit(0)

    if tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        path = args.get("file_path") or args.get("notebook_path") or ""
        real = os.path.realpath(os.path.join(ANALYSER_DIR, path))
        if real in WRITE_FILES or real.startswith(WRITE_TREE):
            sys.exit(0)
        block("run-guard: writable paths are results/**, coverage-plan.toml and known-gaps.md. "
              "Refused: %s" % path)

    sys.exit(0)


if __name__ == "__main__":
    main()
