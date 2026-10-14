package com.openframe.gateway.filter;

import tools.jackson.databind.ObjectMapper;
import com.openframe.core.clientversion.MobileVersionPolicyProperties;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

class ClientUpgradeGateFilterTest {

    private static final String HEADER = "X-OpenFrame-Client";
    private static final String API_PATH = "/api/graphql";
    private static final String MIN_BUNDLE_VERSION = "1.0.120";
    private static final String IOS_STORE_URL = "itms-apps://apps.apple.com/app/id6801064262";
    private static final String ANDROID_STORE_URL = "market://details?id=ai.openframe.mobile";
    private static final String UPGRADE_COUNTER = "openframe.tenant.gateway.client.upgrade.required";

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final AtomicBoolean forwarded = new AtomicBoolean(false);
    private final GatewayFilterChain chain = exchange -> {
        forwarded.set(true);
        return Mono.empty();
    };

    private MobileVersionPolicyProperties properties;
    private ClientUpgradeGateFilter filter;

    @BeforeEach
    void setUp() {
        properties = new MobileVersionPolicyProperties();
        properties.setEnabled(true);
        properties.setMinBundleVersion(MIN_BUNDLE_VERSION);
        properties.getIos().setStoreUrl(IOS_STORE_URL);
        properties.getAndroid().setStoreUrl(ANDROID_STORE_URL);
        GatewayTrafficMetrics metrics = new GatewayTrafficMetrics(registry);
        filter = new ClientUpgradeGateFilter(properties, metrics, new ObjectMapper());
    }

    @Test
    void filter_iosBundleBelowMinimum_upgradeRequiredWithIosStoreUrl() {
        // setup
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get(API_PATH)
                .header(HEADER, "ios/1.0.1 bundle/1.0.100"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isFalse();
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UPGRADE_REQUIRED);
        assertThat(exchange.getResponse().getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_JSON);
        assertThat(exchange.getResponse().getBodyAsString().block()).isEqualTo(
                "{\"code\":\"CLIENT_UPGRADE_REQUIRED\",\"minBundleVersion\":\"1.0.120\",\"storeUrl\":\"" + IOS_STORE_URL + "\"}");
    }

    @Test
    void filter_androidBundleBelowMinimum_upgradeRequiredWithAndroidStoreUrl() {
        // setup
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.post(API_PATH)
                .header(HEADER, "android/1.0.1 bundle/1.0.119-3-gabcdef0"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isFalse();
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UPGRADE_REQUIRED);
        assertThat(exchange.getResponse().getBodyAsString().block()).contains("\"storeUrl\":\"" + ANDROID_STORE_URL + "\"");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "ios/- bundle/1.0.130",
            "ios/1.0.1 bundle/1.0.120",
            "ios/1.0.1 bundle/1.0.125-4-geae0416-dirty",
            "web/- bundle/1.0.100",
            "desktop/0.4.2 bundle/1.0.100",
            "tv/1.0.1 bundle/1.0.100",
            "ios/1.0.1 bundle/-",
            "ios/1.0.1 bundle/1.0",
            "ios/0.0.1 bundle/1.0.130",
            "not a client header"
    })
    void filter_clientNotBelowMinimum_requestForwarded(String header) {
        // setup
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get(API_PATH).header(HEADER, header));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }

    @Test
    void filter_suffixedBundleEqualToMinimum_requestForwarded() {
        // setup
        properties.setMinBundleVersion("1.0.125");
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get(API_PATH)
                .header(HEADER, "ios/1.0.1 bundle/1.0.125-4-geae0416-dirty"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }

    @Test
    void filter_headerMissingAndFlagOff_requestForwarded() {
        // setup
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get(API_PATH));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
    }

    @Test
    void filter_headerMissingAndFlagOn_upgradeRequiredWithoutStoreUrl() {
        // setup
        properties.setEnforceMissingHeader(true);
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get(API_PATH));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isFalse();
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UPGRADE_REQUIRED);
        assertThat(exchange.getResponse().getBodyAsString().block())
                .isEqualTo("{\"code\":\"CLIENT_UPGRADE_REQUIRED\",\"minBundleVersion\":\"1.0.120\"}");
    }

    @Test
    void filter_featureDisabled_oldBundleForwarded() {
        // setup
        properties.setEnabled(false);
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get(API_PATH)
                .header(HEADER, "ios/1.0.1 bundle/1.0.100"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertThat(registry.find(UPGRADE_COUNTER).counters()).isEmpty();
    }

    @Test
    void filter_featureDisabledAndEnforceFlagOn_headerlessRequestForwarded() {
        // setup
        properties.setEnabled(false);
        properties.setEnforceMissingHeader(true);
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get(API_PATH));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
    }

    @Test
    void filter_minimumNotConfigured_oldBundleForwarded() {
        // setup
        properties.setMinBundleVersion(null);
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get(API_PATH)
                .header(HEADER, "ios/1.0.1 bundle/0.0.1"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/oauth/refresh", "/oauth/login", "/actuator/health", "/health", "/ws/nats"})
    void filter_exemptPathWithOldBundleAndFlagOn_requestForwarded(String path) {
        // setup
        properties.setEnforceMissingHeader(true);
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get(path)
                .header(HEADER, "ios/1.0.1 bundle/1.0.100"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
    }

    @Test
    void filter_optionsRequestWithOldBundle_requestForwarded() {
        // setup
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.options(API_PATH)
                .header(HEADER, "ios/1.0.1 bundle/1.0.100"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
    }

    @Test
    void filter_webSocketUpgradeWithoutHeaderAndFlagOn_requestForwarded() {
        // setup
        properties.setEnforceMissingHeader(true);
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get("/tools/meshcentral/control.ashx")
                .header("Upgrade", "WebSocket"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
    }

    @Test
    void filter_upgradeRequired_counterIncrementedByKind() {
        // setup
        MockServerWebExchange first = exchange(MockServerHttpRequest.get(API_PATH)
                .header(HEADER, "ios/1.0.1 bundle/1.0.100"));
        MockServerWebExchange second = exchange(MockServerHttpRequest.get(API_PATH)
                .header(HEADER, "ios/1.0.1 bundle/1.0.101"));

        // execution
        filter.filter(first, chain).block();
        filter.filter(second, chain).block();

        // verifications
        Counter counter = registry.get(UPGRADE_COUNTER).tag("kind", "ios").counter();
        assertThat(counter.count()).isEqualTo(2.0);
    }

    @Test
    void filter_requestForwarded_counterNotRegistered() {
        // setup
        MockServerWebExchange exchange = exchange(MockServerHttpRequest.get(API_PATH)
                .header(HEADER, "ios/1.0.1 bundle/1.0.130"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(registry.find(UPGRADE_COUNTER).counters()).isEmpty();
    }

    @Test
    void getOrder_always_runsBeforeApiKeyAuthentication() {
        // setup - filter prepared in setUp

        // execution
        int order = filter.getOrder();

        // verifications
        assertThat(order).isLessThan(-100);
    }

    private MockServerWebExchange exchange(MockServerHttpRequest.BaseBuilder<?> request) {
        return MockServerWebExchange.from(request);
    }
}
