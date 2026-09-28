package com.openframe.data.loki.config;

import com.openframe.data.loki.client.LokiClient;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.Assert;
import org.springframework.web.client.RestClient;

@Configuration
@ConditionalOnProperty(name = "openframe.loki.enabled", havingValue = "true")
@EnableConfigurationProperties(LokiProperties.class)
public class LokiConfig {

    /**
     * Built on Boot's auto-configured {@link RestClient.Builder} when there is one, so Loki calls carry the
     * standard {@code http.client.requests} observation (metrics and tracing) like other outbound calls.
     */
    @Bean
    public LokiClient lokiClient(ObjectProvider<RestClient.Builder> restClientBuilder, LokiProperties properties) {
        Assert.hasText(properties.getUrl(), "openframe.loki.url must be set when openframe.loki.enabled=true");

        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.DEFAULTS
                .withConnectTimeout(properties.getConnectTimeout())
                .withReadTimeout(properties.getReadTimeout());

        RestClient restClient = restClientBuilder.getIfAvailable(RestClient::builder)
                .baseUrl(properties.getUrl())
                .requestFactory(ClientHttpRequestFactories.get(settings))
                .build();
        return new LokiClient(restClient);
    }
}
