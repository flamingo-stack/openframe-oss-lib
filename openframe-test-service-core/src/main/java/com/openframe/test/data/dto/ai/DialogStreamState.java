package com.openframe.test.data.dto.ai;

/**
 * Derived from the AI agent's Redis dialog lock. Reads {@code IDLE} in the window <em>before</em> an
 * async run acquires the lock, so it must not be used as the run-completion signal — poll the message
 * stream for a terminal marker instead (see {@code RunWaiter}). Diagnostic only.
 */
public enum DialogStreamState {
    IDLE,
    STREAMING
}
