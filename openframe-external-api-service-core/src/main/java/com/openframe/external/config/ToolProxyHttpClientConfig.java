package com.openframe.external.config;

import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.Timeout;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class ToolProxyHttpClientConfig {

    static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(25);
    static final Duration CONNECTION_REQUEST_TIMEOUT = Duration.ofSeconds(3);
    static final int MAX_CONNECTIONS_PER_ROUTE = 20;
    static final int MAX_CONNECTIONS_TOTAL = 50;

    @Bean
    public CloseableHttpClient toolProxyHttpClient() {
        return create(CONNECT_TIMEOUT, RESPONSE_TIMEOUT);
    }

    public static CloseableHttpClient create(Duration connectTimeout, Duration responseTimeout) {
        Timeout leaseTimeout = Timeout.of(CONNECTION_REQUEST_TIMEOUT);
        Timeout readTimeout = Timeout.of(responseTimeout);
        Timeout connectionTimeout = Timeout.of(connectTimeout);
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectionRequestTimeout(leaseTimeout)
                .setResponseTimeout(readTimeout)
                .build();
        ConnectionConfig connectionConfig = ConnectionConfig.custom()
                .setConnectTimeout(connectionTimeout)
                .build();
        PoolingHttpClientConnectionManager connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
                .setDefaultConnectionConfig(connectionConfig)
                .setMaxConnPerRoute(MAX_CONNECTIONS_PER_ROUTE)
                .setMaxConnTotal(MAX_CONNECTIONS_TOTAL)
                .build();
        return HttpClients.custom()
                .setConnectionManager(connectionManager)
                .setDefaultRequestConfig(requestConfig)
                .build();
    }
}
