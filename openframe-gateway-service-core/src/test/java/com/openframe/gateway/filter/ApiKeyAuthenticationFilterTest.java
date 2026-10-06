package com.openframe.gateway.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.apikey.ApiKey;
import com.openframe.gateway.config.prop.RateLimitProperties;
import com.openframe.gateway.model.RateLimitStatus;
import com.openframe.gateway.service.ApiKeyValidationService;
import com.openframe.gateway.service.ApiKeyValidationService.ApiKeyValidationResult;
import com.openframe.gateway.service.RateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Mono;

import java.lang.reflect.Constructor;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ApiKeyAuthenticationFilterTest {

    private static final String FULL_KEY = "ak_12345678abc.sk_0123456789abcdefSECRET";

    private final ApiKeyValidationService validation = mock(ApiKeyValidationService.class);
    private final RateLimitService rateLimit = mock(RateLimitService.class);
    private final RateLimitProperties properties = new RateLimitProperties();
    private ApiKeyAuthenticationFilter filter;
    private final AtomicReference<ServerHttpRequest> forwarded = new AtomicReference<>();
    private final GatewayFilterChain chain = exchange -> {
        forwarded.set(exchange.getRequest());
        return Mono.empty();
    };

    private final ApiKey apiKey = ApiKey.builder().keyId("ak_12345678abc").userId("user-1").build();
    private final RateLimitStatus status = new RateLimitStatus("ak_12345678abc", 3, 60, 3, 1000, 3, 10000, false, false, false);

    @BeforeEach
    void setUp() {
        properties.setIncludeHeaders(true);
        filter = new ApiKeyAuthenticationFilter(validation, rateLimit, properties, new ObjectMapper());
        when(rateLimit.getRateLimitStatus(anyString(), any())).thenReturn(Mono.just(status));
    }

    private static ApiKeyValidationResult valid(ApiKey key) throws Exception {
        Constructor<ApiKeyValidationResult> ctor = ApiKeyValidationResult.class
                .getDeclaredConstructor(boolean.class, String.class, ApiKey.class);
        ctor.setAccessible(true);
        return ctor.newInstance(true, null, key);
    }

    private MockServerWebExchange run(MockServerHttpRequest.BaseBuilder<?> request) {
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        filter.filter(exchange, chain).block();
        return exchange;
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/graphql", "/api-docs/v3", "/swagger-ui/index.html", "/swagger-ui.html", "/webjars/x.js", "/"})
    void shouldLeaveNonExternalApiPathsAlone(String path) {
        run(MockServerHttpRequest.get(path));

        assertThat(forwarded.get()).isNotNull();
        verifyNoInteractions(validation, rateLimit);
    }

    @Test
    void shouldRejectExternalApiCallWithoutKey() {
        MockServerWebExchange exchange = run(MockServerHttpRequest.get("/external-api/v1/devices"));

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(exchange.getResponse().getBodyAsString().block()).contains("\"code\":\"UNAUTHORIZED\"");
        assertThat(forwarded.get()).isNull();
    }

    @Test
    void shouldRejectInvalidKeyWithItsReason() {
        when(validation.validateApiKey(FULL_KEY, null)).thenReturn(Mono.just(ApiKeyValidationResult.invalid("Invalid API key secret")));

        MockServerWebExchange exchange = run(MockServerHttpRequest.get("/external-api/v1/devices").header("X-API-Key", FULL_KEY));

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(exchange.getResponse().getBodyAsString().block()).contains("Invalid API key secret");
        assertThat(forwarded.get()).isNull();
        verify(rateLimit, never()).isAllowed(anyString(), any());
    }

    @Test
    void shouldForwardWithKeyContextAndWithoutTheSecret() throws Exception {
        when(validation.validateApiKey(FULL_KEY, null)).thenReturn(Mono.just(valid(apiKey)));
        when(rateLimit.isAllowed("ak_12345678abc", null)).thenReturn(Mono.just(true));

        MockServerWebExchange exchange = run(MockServerHttpRequest.get("/external-api/v1/devices")
                .header("X-API-Key", FULL_KEY)
                .header("X-User-Id", "spoofed-admin")
                .header("X-API-Key-Id", "spoofed-key"));

        assertThat(forwarded.get().getHeaders().get("X-User-Id")).containsExactly("user-1");
        assertThat(forwarded.get().getHeaders().get("X-API-Key-Id")).containsExactly("ak_12345678abc");
        assertThat(forwarded.get().getHeaders().containsKey("X-API-Key")).isFalse();
        verify(validation).recordSuccessfulRequest("ak_12345678abc", null);
        exchange.getResponse().setComplete().block();
        assertThat(exchange.getResponse().getHeaders().getFirst("X-RateLimit-Remaining-Minute")).isEqualTo("57");
    }

    @Test
    void shouldAnswerTooManyRequestsWhenLimitIsReached() throws Exception {
        when(validation.validateApiKey(FULL_KEY, null)).thenReturn(Mono.just(valid(apiKey)));
        when(rateLimit.isAllowed("ak_12345678abc", null)).thenReturn(Mono.just(false));

        MockServerWebExchange exchange = run(MockServerHttpRequest.get("/external-api/v1/devices").header("X-API-Key", FULL_KEY));

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(exchange.getResponse().getHeaders().getFirst("Retry-After")).isEqualTo("60");
        assertThat(exchange.getResponse().getBodyAsString().block()).contains("RATE_LIMIT_EXCEEDED");
        assertThat(forwarded.get()).isNull();
        verify(validation).recordFailedRequest("ak_12345678abc", null);
    }

    @Test
    void shouldScopeValidationAndLimitsToCallingTenantInMultiTenantMode() throws Exception {
        ReflectionTestUtils.setField(filter, "tenantRoutingEnabled", true);
        when(validation.validateApiKey(FULL_KEY, "tenant-a")).thenReturn(Mono.just(valid(apiKey)));
        when(rateLimit.isAllowed("ak_12345678abc", "tenant-a")).thenReturn(Mono.just(true));

        run(MockServerHttpRequest.get("/external-api/v1/devices").header("X-API-Key", FULL_KEY).header("X-Tenant-Id", "tenant-a"));

        verify(rateLimit).isAllowed("ak_12345678abc", "tenant-a");
        assertThat(forwarded.get()).isNotNull();
    }

    @Test
    void shouldAnswerInternalErrorWhenValidationBlowsUp() {
        when(validation.validateApiKey(FULL_KEY, null)).thenReturn(Mono.error(new IllegalStateException("boom")));

        MockServerWebExchange exchange = run(MockServerHttpRequest.get("/external-api/v1/devices").header("X-API-Key", FULL_KEY));

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(exchange.getResponse().getBodyAsString().block()).doesNotContain("boom");
    }

    @Test
    void shouldRunBeforeOtherGlobalFilters() {
        assertThat(filter.getOrder()).isEqualTo(-100);
    }
}
