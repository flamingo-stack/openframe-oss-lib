package com.openframe.data.document.rmm;

/**
 * Shell interpreter the agent uses to execute a {@link Script}.
 *
 * <p>New interpreters may be added as agent-side support is implemented.
 */
public enum ScriptShell {
    POWERSHELL,
    CMD,
    BASH,
    PYTHON,
    NUSHELL,
    SHELL
}
