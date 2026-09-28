package com.openframe.core.email;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// Conditioned opposite to KickboxDisposableDomainChecker so exactly one exists; not
// @ConditionalOnMissingBean because both are component-scanned and that depends on registration order.
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
