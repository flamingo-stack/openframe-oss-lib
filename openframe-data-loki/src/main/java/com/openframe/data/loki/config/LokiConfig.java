package com.openframe.data.loki.config;

import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.Assert;
import org.springframework.web.client.RestClient;

import java.time.Duration;

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
        return lokiClient(restClientBuilder, properties, properties.getReadTimeout());
    }

    @Bean
    public ToolEventLogRepository toolEventLogRepository(ObjectProvider<RestClient.Builder> restClientBuilder,
                                                         LokiProperties properties) {
        return new ToolEventLogRepository(lokiClient(restClientBuilder, properties, properties.getToolEventReadTimeout()));
    }

    private static LokiClient lokiClient(ObjectProvider<RestClient.Builder> restClientBuilder, LokiProperties properties,
                                         Duration readTimeout) {
        Assert.hasText(properties.getUrl(), "openframe.loki.url must be set when openframe.loki.enabled=true");

        HttpClientSettings settings = HttpClientSettings.defaults()
                .withTimeouts(properties.getConnectTimeout(), readTimeout);

        RestClient restClient = restClientBuilder.getIfAvailable(RestClient::builder)
                .baseUrl(properties.getUrl())
                .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
                .build();
        return new LokiClient(restClient, properties.getMaxQueryBytesRead());
    }
}
