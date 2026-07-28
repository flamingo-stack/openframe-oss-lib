package com.openframe.test.helpers.ai;

/**
 * How the harness responds when the assistant pauses for command approval.
 * <ul>
 *   <li>{@link #AUTO_APPROVE} — approve every request and keep waiting (default).</li>
 *   <li>{@link #AUTO_REJECT} — reject every request (the rejection-path scenario).</li>
 *   <li>{@link #MANUAL} — return control to the test as soon as an approval is pending.</li>
 * </ul>
 */
public enum ApprovalPolicy {
    AUTO_APPROVE,
    AUTO_REJECT,
    MANUAL
}
