package com.openframe.core.email;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Asks an external service whether a domain is disposable — by default Kickbox's open endpoint,
 * which answers {@code {"disposable": true|false}}.
 * <p>
 * Bounded and fail-open by design. Connect and read are each capped by
 * {@code openframe.email-domain-policy.disposable-check.timeout-ms}, and any failure — timeout,
 * non-2xx, unparseable body, DNS — is logged and treated as "not disposable". This check only ever
 * adds blocks on top of the built-in list; it can never be the reason a signup fails.
 * <p>
 * Uses the synchronous {@link RestClient} rather than {@code WebClient}: every caller
 * (registration, invitation, SSO config) is a blocking servlet request, so there is nothing to gain
 * from a reactive client and no need to {@code block()} on it.
 */
@Slf4j
@Component
@ConditionalOnProperty(
        prefix = "openframe.email-domain-policy.disposable-check",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
public class KickboxDisposableDomainChecker implements DisposableDomainChecker {

    private final RestClient restClient;

    public KickboxDisposableDomainChecker(EmailDomainPolicyProperties properties) {
        int timeoutMs = (int) properties.getDisposableCheck().getTimeoutMs();

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(timeoutMs);
        requestFactory.setReadTimeout(timeoutMs);

        this.restClient = RestClient.builder()
                .baseUrl(properties.getDisposableCheck().getUrl())
                .requestFactory(requestFactory)
                .build();
    }

    @Override
    public boolean isDisposable(String domain) {
        try {
            DisposableResponse response = restClient.get()
                    .uri(domain)
                    .retrieve()
                    .body(DisposableResponse.class);
            return response != null && response.disposable();
        } catch (Exception e) {
            log.warn("Disposable-domain check failed for '{}', allowing: {}", domain, e.toString());
            return false;
        }
    }

    /** Response body of the disposable-domain endpoint. */
    record DisposableResponse(boolean disposable) {
    }
}
