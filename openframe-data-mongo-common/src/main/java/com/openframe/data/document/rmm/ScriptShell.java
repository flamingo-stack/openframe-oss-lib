package com.openframe.data.document.rmm;

/**
 * Shell interpreter the agent uses to execute a {@link Script}.
 *
 * <p>The set intentionally mirrors what Tactical RMM exposed so existing
 * scripts can be migrated without rewriting their shebangs. New interpreters
 * may be added as agent-side support is implemented.
 */
public enum ScriptShell {
    POWERSHELL,
    CMD,
    BASH,
    PYTHON,
    NUSHELL,
    SHELL
}
