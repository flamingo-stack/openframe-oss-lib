package com.openframe.gateway.security;

import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Guards the observability contract for silently-rejected WS upgrades: an agent with an expired JWT
 * must produce a metric (tool + reason) and still receive the standard 401.
 */
class WsAwareAuthenticationEntryPointTest {

    private static final String MESH_PATH = "/ws/tools/agent/meshcentral-server/agent.ashx";

    private final GatewayTrafficMetrics metrics = mock(GatewayTrafficMetrics.class);
    private final WsAwareAuthenticationEntryPoint entryPoint = new WsAwareAuthenticationEntryPoint(metrics);

    @Test
    void expiredTokenOnWsPath_countsExpiredToken_andStill401s() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get(MESH_PATH)
                        .header(HttpHeaders.UPGRADE, "websocket")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + unsignedJwt("agent_x")));

        entryPoint.commence(exchange, oauthError("Jwt expired at 2026-07-01T22:56:55Z")).block();

        verify(metrics).recordUpgradeRejected("meshcentral-server", "expired_token");
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void noTokenOnWsPath_countsMissingToken() {
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/ws/nats"));

        entryPoint.commence(exchange, oauthError("Not Authenticated")).block();

        verify(metrics).recordUpgradeRejected("nats", "missing_token");
    }

    @Test
    void badTokenOnWsPath_countsInvalidToken() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get(MESH_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer garbage"));

        entryPoint.commence(exchange, oauthError("An error occurred while attempting to decode the Jwt: Invalid JWT")).block();

        verify(metrics).recordUpgradeRejected("meshcentral-server", "invalid_token");
    }

    @Test
    void plainHttpRequest_isNotCounted() {
        MockServerWebExchange exchange = MockServerWebExchange.from(MockServerHttpRequest.get("/api/v1/devices"));

        entryPoint.commence(exchange, oauthError("Jwt expired at 2026-07-01T22:56:55Z")).block();

        verifyNoInteractions(metrics);
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private static OAuth2AuthenticationException oauthError(String description) {
        return new OAuth2AuthenticationException(new OAuth2Error("invalid_token", description, null), description);
    }

    // Unsecured JWT (alg=none) — the entry point reads sub without verifying the signature.
    private static String unsignedJwt(String sub) {
        return Jwts.builder().setSubject(sub).compact();
    }
}
