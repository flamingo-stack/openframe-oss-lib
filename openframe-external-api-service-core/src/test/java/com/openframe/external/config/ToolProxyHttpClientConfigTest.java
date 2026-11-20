package com.openframe.external.config;

import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class ToolProxyHttpClientConfigTest {

    private static final Duration GATEWAY_RESPONSE_TIMEOUT = Duration.ofSeconds(30);

    @Test
    void defaults_connectTwoSecondsResponseTwentyFiveSeconds() {
        // setup
        Duration connect = ToolProxyHttpClientConfig.CONNECT_TIMEOUT;

        // execution
        Duration response = ToolProxyHttpClientConfig.RESPONSE_TIMEOUT;

        // verifications
        assertThat(connect).isEqualTo(Duration.ofSeconds(2));
        assertThat(response).isEqualTo(Duration.ofSeconds(25)).isLessThan(GATEWAY_RESPONSE_TIMEOUT);
    }

    @Test
    void defaults_leaseAndResponseStayUnderTheGatewayTimeout() {
        // setup
        Duration lease = ToolProxyHttpClientConfig.CONNECTION_REQUEST_TIMEOUT;

        // execution
        Duration worstCase = lease.plus(ToolProxyHttpClientConfig.RESPONSE_TIMEOUT);

        // verifications
        assertThat(lease).isEqualTo(Duration.ofSeconds(3));
        assertThat(worstCase).isLessThan(GATEWAY_RESPONSE_TIMEOUT);
    }

    @Test
    void defaults_poolTwentyPerRouteFiftyTotal() {
        // setup
        int perRoute = ToolProxyHttpClientConfig.MAX_CONNECTIONS_PER_ROUTE;

        // execution
        int total = ToolProxyHttpClientConfig.MAX_CONNECTIONS_TOTAL;

        // verifications
        assertThat(perRoute).isEqualTo(20);
        assertThat(total).isEqualTo(50).isGreaterThanOrEqualTo(perRoute);
    }

    @Test
    void toolProxyHttpClient_created_isUsable() throws IOException {
        // setup
        ToolProxyHttpClientConfig config = new ToolProxyHttpClientConfig();

        // execution
        CloseableHttpClient client = config.toolProxyHttpClient();

        // verifications
        assertThat(client).isNotNull();
        client.close();
    }
}
