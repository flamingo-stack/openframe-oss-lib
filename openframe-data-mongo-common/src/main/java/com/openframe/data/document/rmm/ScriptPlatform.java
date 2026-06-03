package com.openframe.data.document.rmm;

/**
 * Operating-system platform on which a {@link Script} is supported.
 *
 * <p>The set is intentionally minimal; finer-grained distinctions (e.g.
 * specific Windows or distro versions) are expressed in the script body or
 * via execution-time arguments rather than as separate platform values.
 */
public enum ScriptPlatform {
    WINDOWS,
    LINUX,
    MACOS
}
