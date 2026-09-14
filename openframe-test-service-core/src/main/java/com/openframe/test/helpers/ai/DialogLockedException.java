package com.openframe.test.helpers.ai;

/**
 * The approval endpoint refused with {@code 409 DIALOG_LOCKED}: the run still held the dialog lock at the
 * instant we tried to resolve its approval request.
 *
 * <p>This is a <em>race</em>, not a verdict about the product. An approval request becomes visible in the
 * message stream before the turn that emitted it has finished, so a poll landing in that window approves a
 * dialog the server still considers busy. Nothing the assistant did is wrong and the same approval
 * succeeds once the turn ends, so {@link RunWaiter} retries on this rather than failing the case; only a
 * lock that never clears reaches an assertion.
 *
 * <p>Deliberately unchecked and deliberately <em>not</em> an {@link AssertionError}: it has to stay
 * distinguishable from the genuine "the server refused this approval" failures that {@code ApprovalApi}
 * still raises as assertions, which are about the product and must keep failing the build.
 */
public class DialogLockedException extends RuntimeException {

    public DialogLockedException(String message) {
        super(message);
    }
}
