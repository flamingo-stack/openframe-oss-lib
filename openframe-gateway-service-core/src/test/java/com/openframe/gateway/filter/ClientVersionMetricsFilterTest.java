package com.openframe.gateway.filter;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import reactor.core.publisher.Mono;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.ORIGIN;

@ExtendWith(OutputCaptureExtension.class)
class ClientVersionMetricsFilterTest {

    private static final String HEADER = "X-OpenFrame-Client";
    private static final String TENANT_HEADER = "X-Tenant-Id";
    private static final String API_PATH = "/api/graphql";
    private static final String REQUESTS_COUNTER = "openframe.tenant.gateway.client.requests";
    private static final String SUB = "user-1";
    private static final String SEEN_LOG = "Client seen: tenantId=tenant-a sub=user-1 kind=ios shell=1.0.1 bundle=1.0.127";

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final AtomicBoolean forwarded = new AtomicBoolean(false);
    private final GatewayFilterChain chain = exchange -> {
        forwarded.set(true);
        return Mono.empty();
    };

    private ClientVersionMetricsFilter filter;

    @BeforeEach
    void setUp() {
        filter = new ClientVersionMetricsFilter(new GatewayTrafficMetrics(registry));
    }

    @Test
    void filter_authenticatedClient_countsRequestByKindAndVersions() {
        // execution
        runAs(SUB, request("ios/1.0.1 bundle/1.0.127"));
        runAs(SUB, request("ios/1.0.1 bundle/1.0.127"));

        // verifications
        assertThat(forwarded).isTrue();
        assertThat(requests("ios", "1.0.1", "1.0.127")).isEqualTo(2.0);
    }

    @Test
    void filter_sameUserAndBuild_logsClientSeenOnce(CapturedOutput output) {
        // execution
        runAs(SUB, request("ios/1.0.1 bundle/1.0.127"));
        runAs(SUB, request("ios/1.0.1 bundle/1.0.127"));

        // verifications
        assertThat(output.getOut().split(SEEN_LOG, -1)).hasSize(2);
    }

    @Test
    void filter_userUpdatesBundle_logsClientSeenForNewBuild(CapturedOutput output) {
        // execution
        runAs(SUB, request("ios/1.0.1 bundle/1.0.127"));
        runAs(SUB, request("ios/1.0.2 bundle/1.0.130"));

        // verifications
        assertThat(output.getOut())
                .contains(SEEN_LOG)
                .contains("Client seen: tenantId=tenant-a sub=user-1 kind=ios shell=1.0.2 bundle=1.0.130");
    }

    @Test
    void filter_otherUserSameBuild_logsClientSeenForEach(CapturedOutput output) {
        // execution
        runAs(SUB, request("android/1.0.1 bundle/1.0.127"));
        runAs("user-2", request("android/1.0.1 bundle/1.0.127"));

        // verifications
        assertThat(output.getOut())
                .contains("sub=user-1 kind=android")
                .contains("sub=user-2 kind=android");
    }

    @Test
    void filter_anonymousRequest_notCounted() {
        // setup
        MockServerWebExchange exchange = MockServerWebExchange.from(request("ios/1.0.1 bundle/1.0.127"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
        assertThat(registry.find(REQUESTS_COUNTER).counter()).isNull();
    }

    @Test
    void filter_noClientHeaderNoShellOrigin_countedAsNoneWithoutClientSeen(CapturedOutput output) {
        // execution
        runAs(SUB, MockServerHttpRequest.get(API_PATH).header(TENANT_HEADER, "tenant-a"));

        // verifications
        assertThat(forwarded).isTrue();
        assertThat(requests("none", "-", "-")).isEqualTo(1.0);
        assertThat(output.getOut()).doesNotContain("Client seen:");
    }

    @ParameterizedTest
    @CsvSource({
            "capacitor://localhost, legacy-ios",
            "https://localhost, legacy-android",
            "tauri://localhost, legacy-desktop"
    })
    void filter_noClientHeaderShellOrigin_countedAsLegacyShell(String origin, String kind, CapturedOutput output) {
        // execution
        runAs(SUB, MockServerHttpRequest.get(API_PATH)
                .header(TENANT_HEADER, "tenant-a")
                .header(ORIGIN, origin));

        // verifications
        assertThat(forwarded).isTrue();
        assertThat(requests(kind, "-", "-")).isEqualTo(1.0);
        assertThat(output.getOut()).contains("Client seen: tenantId=tenant-a sub=user-1 kind=" + kind + " shell=- bundle=-");
    }

    @Test
    void filter_anonymousRequestWithoutClientHeader_notCounted() {
        // setup
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get(API_PATH)
                .header(ORIGIN, "capacitor://localhost"));

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        assertThat(forwarded).isTrue();
        assertThat(registry.find(REQUESTS_COUNTER).counter()).isNull();
    }

    @Test
    void filter_chatClient_countedAsChat(CapturedOutput output) {
        // execution
        runAs("agent_1", request("chat/1.5.107 bundle/1.5.107"));

        // verifications
        assertThat(requests("chat", "1.5.107", "1.5.107")).isEqualTo(1.0);
        assertThat(output.getOut())
                .contains("Client seen: tenantId=tenant-a sub=agent_1 kind=chat shell=1.5.107 bundle=1.5.107");
    }

    @Test
    void filter_malformedHeader_countedAsUnknown() {
        // execution
        runAs(SUB, request("garbage"));

        // verifications
        assertThat(requests("unknown", "-", "-")).isEqualTo(1.0);
    }

    @Test
    void filter_noTenantHeader_logsDashTenant(CapturedOutput output) {
        // execution
        runAs(SUB, MockServerHttpRequest.get(API_PATH).header(HEADER, "web/- bundle/1.0.127"));

        // verifications
        assertThat(output.getOut()).contains("Client seen: tenantId=- sub=user-1 kind=web shell=- bundle=1.0.127");
    }

    @Test
    void filter_metricsFail_requestStillForwarded(CapturedOutput output) {
        // setup
        GatewayTrafficMetrics failingMetrics = new GatewayTrafficMetrics(registry) {
            @Override
            public void recordClientRequest(String kind, String shellVersion, String bundleVersion) {
                throw new IllegalStateException("registry down");
            }
        };
        filter = new ClientVersionMetricsFilter(failingMetrics);

        // execution
        runAs(SUB, request("ios/1.0.1 bundle/1.0.127"));

        // verifications
        assertThat(forwarded).isTrue();
        assertThat(output.getOut()).contains("Client metrics not recorded");
    }

    private MockServerHttpRequest.BaseBuilder<?> request(String client) {
        return MockServerHttpRequest.get(API_PATH)
                .header(TENANT_HEADER, "tenant-a")
                .header(HEADER, client);
    }

    private void runAs(String sub, MockServerHttpRequest.BaseBuilder<?> request) {
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        TestingAuthenticationToken authentication = new TestingAuthenticationToken(sub, null, "ROLE_USER");
        filter.filter(exchange, chain)
                .contextWrite(ReactiveSecurityContextHolder.withAuthentication(authentication))
                .block();
    }

    private double requests(String kind, String shell, String bundle) {
        Counter counter = registry.get(REQUESTS_COUNTER)
                .tag("kind", kind)
                .tag("shell", shell)
                .tag("bundle", bundle)
                .counter();
        return counter.count();
    }
}
