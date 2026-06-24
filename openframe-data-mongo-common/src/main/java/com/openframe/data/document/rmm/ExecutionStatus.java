package com.openframe.data.document.rmm;

/**
 * Lifecycle of a single script execution (one row in the History list).
 *
 * <ul>
 *   <li>{@link #RUNNING} — server published the dispatch over NATS; awaiting the
 *       agent's result frame. Initial state immediately after persist.</li>
 *   <li>{@link #SUCCESS} — agent reported {@code exitCode == 0}, not timed out,
 *       no error.</li>
 *   <li>{@link #FAILING} — anything else: non-zero exit, timeout, agent error,
 *       or watchdog-detected stuck execution (see management scheduler).</li>
 * </ul>
 */
public enum ExecutionStatus {
    RUNNING,
    SUCCESS,
    FAILING
}
