package com.openframe.test.helpers.ai;

/**
 * Signals an <em>infrastructure</em> failure (machine offline, box unreachable, dispatch timeout) as
 * opposed to a behavioral one: if we could not reach the box or the run never completed, we do not know
 * whether the assistant did its job, so the assertion that follows would be meaningless.
 *
 * <p><b>This reports as FAILED, not ABORTED.</b> It is an ordinary {@link RuntimeException} and nothing
 * converts it, which is deliberate — a target environment that is broken should keep stopping the build.
 * For the one case where the failure is genuinely not ours to fix, an outage at the model provider, see
 * {@link ProviderUnavailableException}, which does abort.
 */
public class InfraFailureException extends RuntimeException {

    public InfraFailureException(String message) {
        super(message);
    }

    public InfraFailureException(String message, Throwable cause) {
        super(message, cause);
    }
}
