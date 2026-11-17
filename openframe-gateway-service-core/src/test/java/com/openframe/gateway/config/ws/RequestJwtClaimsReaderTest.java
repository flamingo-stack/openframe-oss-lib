package com.openframe.gateway.config.ws;

import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static com.openframe.gateway.config.ws.ToolWebSocketProxyUrlFilter.ORIGINAL_AUTHORIZATION_ATTR;
import static org.assertj.core.api.Assertions.assertThat;

class RequestJwtClaimsReaderTest {

    private static final String MACHINE_ID = "8daa5e90-707c-4fab-8cda-d11550b0d26b";
    private static final String SUBJECT = "agent_8daa5e90-707c-4fab-8cda-d11550b0d26b";
    private static final String MACHINE_ID_CLAIM = "machine_id";
    private static final long NUMERIC_MACHINE_ID = 42L;

    private RequestJwtClaimsReader reader;

    @BeforeEach
    void setUp() {
        reader = new RequestJwtClaimsReader();
    }

    @Test
    void getMachineId_deviceTokenInAuthorizationHeader_returnsMachineId() {
        // setup
        Map<String, Object> claims = deviceClaims(MACHINE_ID);
        MockServerWebExchange exchange = exchangeWithAuthorizationHeader(claims);

        // execution
        Optional<String> machineId = reader.getMachineId(exchange);

        // verifications
        assertThat(machineId).contains(MACHINE_ID);
    }

    @Test
    void getMachineId_deviceTokenInOriginalAuthorizationAttribute_returnsMachineId() {
        // setup
        Map<String, Object> claims = deviceClaims(MACHINE_ID);
        MockServerWebExchange exchange = exchangeWithOriginalAuthorizationAttribute(claims);

        // execution
        Optional<String> machineId = reader.getMachineId(exchange);

        // verifications
        assertThat(machineId).contains(MACHINE_ID);
    }

    @Test
    void getMachineId_userTokenWithoutMachineClaim_returnsEmpty() {
        // setup
        Map<String, Object> claims = new HashMap<>();
        claims.put("sub", "technician@example.com");
        MockServerWebExchange exchange = exchangeWithAuthorizationHeader(claims);

        // execution
        Optional<String> machineId = reader.getMachineId(exchange);

        // verifications
        assertThat(machineId).isEmpty();
    }

    @Test
    void getMachineId_numericMachineClaim_returnsItAsText() {
        // setup
        Map<String, Object> claims = deviceClaims(NUMERIC_MACHINE_ID);
        MockServerWebExchange exchange = exchangeWithAuthorizationHeader(claims);

        // execution
        Optional<String> machineId = reader.getMachineId(exchange);

        // verifications
        assertThat(machineId).contains("42");
    }

    private static Map<String, Object> deviceClaims(Object machineId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("sub", SUBJECT);
        claims.put(MACHINE_ID_CLAIM, machineId);
        return claims;
    }

    private static MockServerWebExchange exchangeWithAuthorizationHeader(Map<String, Object> claims) {
        String bearer = bearerToken(claims);
        MockServerHttpRequest request = MockServerHttpRequest.get("/ws/tools/agent/meshcentral-server/meshrelay.ashx")
                .header(HttpHeaders.AUTHORIZATION, bearer)
                .build();
        return MockServerWebExchange.from(request);
    }

    private static MockServerWebExchange exchangeWithOriginalAuthorizationAttribute(Map<String, Object> claims) {
        String bearer = bearerToken(claims);
        MockServerHttpRequest request = MockServerHttpRequest.get("/ws/tools/agent/meshcentral-server/meshrelay.ashx")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        exchange.getAttributes().put(ORIGINAL_AUTHORIZATION_ATTR, bearer);
        return exchange;
    }

    private static String bearerToken(Map<String, Object> claims) {
        Instant expiresAt = Instant.now().plus(1, ChronoUnit.HOURS);
        String unsigned = Jwts.builder()
                .setClaims(claims)
                .setExpiration(Date.from(expiresAt))
                .compact();
        return "Bearer " + unsigned + "signature";
    }
}
