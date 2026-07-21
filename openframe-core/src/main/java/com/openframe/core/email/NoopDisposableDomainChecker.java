package com.openframe.core.email;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Fallback when the external check is switched off. Answers "not disposable" for everything, so
 * only the built-in blocklist applies.
 */
@Component
@ConditionalOnMissingBean(value = DisposableDomainChecker.class, ignored = NoopDisposableDomainChecker.class)
public class NoopDisposableDomainChecker implements DisposableDomainChecker {

    @Override
    public boolean isDisposable(String domain) {
        return false;
    }
}
