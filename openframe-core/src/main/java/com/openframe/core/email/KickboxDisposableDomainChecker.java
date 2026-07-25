package com.openframe.core.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Asks an external service whether a domain is disposable — by default Kickbox's open endpoint,
 * which answers {@code {"disposable": true|false}}.
 * <p>
 * Fail-open by design: any failure — timeout, non-2xx, unparseable body, DNS — is logged and
 * treated as "not disposable". This check only ever adds blocks on top of the built-in list; it can
 * never be the reason a signup fails. Timeouts live on the client in
 * {@link DisposableDomainClientConfig}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        prefix = "openframe.email-domain-policy.disposable-check",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
public class KickboxDisposableDomainChecker implements DisposableDomainChecker {

    private final DisposableDomainHttpClient client;

    @Override
    public boolean isDisposable(String domain) {
        try {
            DisposableDomainResponse response = client.check(domain);
            return response != null && response.disposable();
        } catch (Exception e) {
            log.warn("Disposable-domain check failed for '{}', allowing: {}", domain, e.toString());
            return false;
        }
    }
}
