package com.openframe.gateway.filter;

import tools.jackson.databind.ObjectMapper;
import com.openframe.core.clientversion.MobileVersionPolicyProperties;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import com.openframe.gateway.security.cors.CorsDisableConfig;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.server.WebHandler;
import reactor.core.publisher.Mono;

class ClientUpgradeGateCorsTest {

    private static final String HEADER = "X-OpenFrame-Client";

    private WebTestClient client;

    @BeforeEach
    void setUp() {
        MobileVersionPolicyProperties properties = new MobileVersionPolicyProperties();
        properties.setEnabled(true);
        properties.setMinBundleVersion("1.0.120");
        GatewayTrafficMetrics metrics = new GatewayTrafficMetrics(new SimpleMeterRegistry());
        ClientUpgradeGateFilter filter = new ClientUpgradeGateFilter(properties, metrics, new ObjectMapper());
        GatewayFilterChain chain = exchange -> Mono.empty();
        WebHandler gatewayHandler = exchange -> filter.filter(exchange, chain);
        CorsWebFilter corsWebFilter = new CorsDisableConfig().disabledCorsWebFilter();
        client = WebTestClient.bindToWebHandler(gatewayHandler).webFilter(corsWebFilter).build();
    }

    @ParameterizedTest
    @ValueSource(strings = {"capacitor://localhost", "https://localhost"})
    void filter_upgradeRequiredFromMobileOrigin_corsHeadersPresent(String origin) {
        // setup - client prepared in setUp

        // execution
        WebTestClient.ResponseSpec response = client.get().uri("http://tenant.openframe.test/api/graphql")
                .header("Origin", origin)
                .header(HEADER, "ios/1.0.1 bundle/1.0.100")
                .exchange();

        // verifications
        response.expectStatus().isEqualTo(HttpStatus.UPGRADE_REQUIRED)
                .expectHeader().valueEquals("Access-Control-Allow-Origin", origin)
                .expectHeader().valueEquals("Access-Control-Allow-Credentials", "true")
                .expectBody().jsonPath("$.code").isEqualTo("CLIENT_UPGRADE_REQUIRED");
    }
}
