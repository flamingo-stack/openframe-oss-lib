package com.openframe.core.email;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Fallback when the external check is switched off. Answers "not disposable" for everything, so
 * only the built-in blocklist applies.
 * <p>
 * Conditioned on the same property as {@link KickboxDisposableDomainChecker}, with the opposite
 * value, so exactly one of the two exists. Deliberately not {@code @ConditionalOnMissingBean}:
 * both are component-scanned, and that condition would depend on registration order.
 */
@Component
@ConditionalOnProperty(
        prefix = "openframe.email-domain-policy.disposable-check",
        name = "enabled",
        havingValue = "false")
public class NoopDisposableDomainChecker implements DisposableDomainChecker {

    @Override
    public boolean isDisposable(String domain) {
        return false;
    }
}
