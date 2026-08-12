package com.openframe.test.helpers.ai;

import org.opentest4j.TestAbortedException;

/**
 * The model provider was unavailable — overloaded, rate-limited, or 5xx — on every attempt, so no real
 * run ever happened and we learned nothing about the product.
 *
 * <p>Extends {@link TestAbortedException} so JUnit reports the case as <b>ABORTED</b> rather than FAILED
 * (see the {@code ABORTED} branch in {@code LoggingTestListener}): a provider outage is not a signal
 * about our system, and failing the nightly on it is noise.
 *
 * <p>This is deliberately narrower than {@link InfraFailureException}, which still reports as FAILED. A
 * machine that is offline or unreachable means the target environment is broken and should keep stopping
 * the build — otherwise a box down for a week would leave the nightly green with AI coverage silently at
 * zero.
 */
public class ProviderUnavailableException extends TestAbortedException {

    public ProviderUnavailableException(String message) {
        super(message);
    }
}
