package com.openframe.test.helpers.ai;

/**
 * Signals an <em>infrastructure</em> failure (machine offline, box unreachable, dispatch timeout, LLM
 * 5xx) as opposed to a behavioral one. Device E2E cases must abort with this rather than fail an
 * assertion: if we could not reach the box or the run never completed, we do not know whether the
 * assistant did its job, so failing the build would be noise.
 */
public class InfraFailureException extends RuntimeException {

    public InfraFailureException(String message) {
        super(message);
    }

    public InfraFailureException(String message, Throwable cause) {
        super(message, cause);
    }
}
