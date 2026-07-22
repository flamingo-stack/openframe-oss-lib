package com.openframe.core.email;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

/**
 * Builds the declarative {@link DisposableDomainHttpClient}.
 * <p>
 * Connect and read are each capped by
 * {@code openframe.email-domain-policy.disposable-check.timeout-ms} — this runs inline in
 * registration and invitation, so a slow third party must not stall either.
 */
@Configuration
@ConditionalOnProperty(
        prefix = "openframe.email-domain-policy.disposable-check",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
public class DisposableDomainClientConfig {

    @Bean
    public DisposableDomainHttpClient disposableDomainHttpClient(EmailDomainPolicyProperties properties) {
        int timeoutMs = (int) properties.getDisposableCheck().getTimeoutMs();

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(timeoutMs);
        requestFactory.setReadTimeout(timeoutMs);

        RestClient restClient = RestClient.builder()
                .baseUrl(properties.getDisposableCheck().getUrl())
                .requestFactory(requestFactory)
                .build();

        RestClientAdapter adapter = RestClientAdapter.create(restClient);
        HttpServiceProxyFactory factory = HttpServiceProxyFactory.builderFor(adapter).build();
        return factory.createClient(DisposableDomainHttpClient.class);
    }
}
