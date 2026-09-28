package com.openframe.gateway.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.WebFilterChainProxy;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The auth-skip chain ({@link GatewaySecurityConfig#authSkipFilterChain}) exists for
 * machine-to-machine proxy paths whose callers authenticate to the UPSTREAM with an opaque
 * token: the main chain's resource server decodes any {@code Authorization: Bearer} value as an
 * OpenFrame JWT during authentication — before permitAll is consulted — and 401s opaque tokens.
 * These tests pin the contract: requests on skip paths bypass security entirely (bearer intact),
 * and everything else still falls through to the next (main) chain.
 */
class AuthSkipSecurityChainTest {

    private SecurityWebFilterChain skipChain;

    /** Stand-in for the main chain's bearer trap: matches everything, always 401s. */
    private final SecurityWebFilterChain rejectingMainChain = new SecurityWebFilterChain() {
        @Override
        public Mono<Boolean> matches(ServerWebExchange exchange) {
            return Mono.just(true);
        }

        @Override
        public Flux<WebFilter> getWebFilters() {
            return Flux.just((exchange, chain) -> {
                exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                return exchange.getResponse().setComplete();
            });
        }
    };

    @BeforeEach
    void setUp() {
        skipChain = new GatewaySecurityConfig().authSkipFilterChain(
                ServerHttpSecurity.http(), new String[]{"/v0/fleet/enrichment/**"});
    }

    private MockServerWebExchange run(WebFilterChainProxy proxy, String path, boolean withOpaqueBearer,
                                      AtomicBoolean reachedDownstream) {
        MockServerHttpRequest.BaseBuilder<?> req = MockServerHttpRequest.get(path);
        if (withOpaqueBearer) {
            req.header("Authorization", "Bearer opaque-fleet-api-token-without-dots");
        }
        MockServerWebExchange exchange = MockServerWebExchange.from((MockServerHttpRequest.BaseBuilder<?>) req);
        proxy.filter(exchange, ex -> {
            reachedDownstream.set(true);
            return Mono.empty();
        }).block();
        return exchange;
    }

    @Test
    @DisplayName("skip path + opaque bearer: security skipped, request reaches the route with header intact")
    void skipPathBypassesBearerAuthentication() {
        WebFilterChainProxy proxy = new WebFilterChainProxy(List.of(skipChain, rejectingMainChain));
        AtomicBoolean downstream = new AtomicBoolean();

        MockServerWebExchange exchange = run(proxy, "/v0/fleet/enrichment/api/v1/fleet/queries/2", true, downstream);

        assertThat(downstream).isTrue();
        assertThat(exchange.getResponse().getStatusCode()).isNotEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("non-skip path: falls through to the main chain (still rejected)")
    void otherPathsKeepMainChainBehavior() {
        WebFilterChainProxy proxy = new WebFilterChainProxy(List.of(skipChain, rejectingMainChain));
        AtomicBoolean downstream = new AtomicBoolean();

        MockServerWebExchange exchange = run(proxy, "/api/v1/anything", true, downstream);

        assertThat(downstream).isFalse();
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("skip path without any Authorization header also passes")
    void skipPathWithoutBearerPasses() {
        WebFilterChainProxy proxy = new WebFilterChainProxy(List.of(skipChain, rejectingMainChain));
        AtomicBoolean downstream = new AtomicBoolean();

        run(proxy, "/v0/fleet/enrichment/api/v1/fleet/global/policies/1", false, downstream);

        assertThat(downstream).isTrue();
    }
}
