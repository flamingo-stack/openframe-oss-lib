package com.openframe.security.oauth.service.redirect;

import org.junit.jupiter.api.Test;
import org.springframework.http.server.reactive.ServerHttpRequest;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;

class RedirectTargetResolverTest {

    private static final String NATIVE_APP = "com.openframe.app://auth";

    private static RedirectTargetResolver allowing(String allowed) {
        return new RedirectTargetResolver() {
            @Override
            public Mono<String> resolve(String tenantId, String userId, String requestedRedirectTo, ServerHttpRequest request) {
                return Mono.empty();
            }

            @Override
            public boolean isAllowedRedirectUri(String uri) {
                return allowed == null || allowed.equals(uri);
            }
        };
    }

    @Test
    void shouldLetOnlyAllowListedUriReceiveDevTicketByDefault() {
        RedirectTargetResolver resolver = allowing(NATIVE_APP);

        assertThat(resolver.canReceiveDevTicket(NATIVE_APP)).isTrue();
        assertThat(resolver.canReceiveDevTicket("/devices")).isFalse();
    }

    @Test
    void shouldNotLetNullTargetReceiveDevTicketEvenWhenEverythingIsAllowed() {
        RedirectTargetResolver allowAll = allowing(null);

        assertThat(allowAll.canReceiveDevTicket(NATIVE_APP)).isTrue();
        assertThat(allowAll.canReceiveDevTicket(null)).isFalse();
    }

    @Test
    void shouldFailClosedWithoutAllowList() {
        RedirectTargetResolver resolver = (tenantId, userId, requested, request) -> Mono.empty();

        assertThat(resolver.isAllowedRedirectUri(NATIVE_APP)).isFalse();
        assertThat(resolver.canReceiveDevTicket(NATIVE_APP)).isFalse();
    }

    @Test
    void shouldNotTreatNullAsLocalhostOrigin() {
        assertThat(RedirectTargetResolver.isLocalhostOrigin(null)).isFalse();
        assertThat(RedirectTargetResolver.isLocalhostOrigin("http://localhost:3000/")).isTrue();
    }
}
