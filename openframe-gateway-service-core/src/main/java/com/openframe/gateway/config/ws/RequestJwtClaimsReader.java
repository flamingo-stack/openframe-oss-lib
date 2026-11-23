package com.openframe.gateway.config.ws;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static com.openframe.gateway.config.ws.ToolWebSocketProxyUrlFilter.ORIGINAL_AUTHORIZATION_ATTR;
import static com.openframe.gateway.config.ws.WebSocketServiceSecurityDecorator.CLOCK_SKEW_SECONDS;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Component
@RequiredArgsConstructor
public class RequestJwtClaimsReader {

    private static final String MACHINE_ID_CLAIM = "machine_id";
    private static final String USER_ID_CLAIM = "userId";
    private static final String ROLES_CLAIM = "roles";

    public Instant getExpiration(ServerWebExchange exchange) {
        Claims jwtClaims = getClaims(exchange);
        return jwtClaims.getExpiration().toInstant();
    }

    public Optional<String> getSubject(ServerWebExchange exchange) {
        try {
            Claims claims = getClaims(exchange);
            Object sub = claims.get("sub");
            return sub == null ? Optional.empty() : Optional.of(String.valueOf(sub));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public Optional<String> getMachineId(ServerWebExchange exchange) {
        Claims claims = getClaims(exchange);
        Object machineId = claims.get(MACHINE_ID_CLAIM);
        return machineId == null ? Optional.empty() : Optional.of(String.valueOf(machineId));
    }

    /** The {@code userId} claim of a user token, or its {@code sub} when the claim is absent. */
    public String getUserId(ServerWebExchange exchange) {
        Claims claims = getClaims(exchange);
        Object userId = claims.get(USER_ID_CLAIM);
        if (userId != null) {
            return String.valueOf(userId);
        }
        return requireSubject(claims);
    }

    /** The {@code roles} claim as strings; empty when the token has none. */
    public List<String> getRoles(ServerWebExchange exchange) {
        Claims claims = getClaims(exchange);
        Object roles = claims.get(ROLES_CLAIM);
        if (!(roles instanceof Collection<?> values)) {
            return List.of();
        }
        return values.stream()
                .map(String::valueOf)
                .toList();
    }

    private static String requireSubject(Claims claims) {
        String subject = claims.getSubject();
        if (isBlank(subject)) {
            throw new IllegalStateException("Token carries neither a userId nor a sub claim");
        }
        return subject;
    }

    private Claims getClaims(ServerWebExchange exchange) {
        String authorization = extractAuthorization(exchange);

        if (isBlank(authorization)) {
            throw new IllegalStateException("No Authorization header found");
        }
        if (!authorization.startsWith("Bearer ")) {
            throw new IllegalStateException("No bearer token in Authorization header");
        }

        String jwtClaimsPart = authorization.substring(7, authorization.lastIndexOf('.') + 1);
        return Jwts.parserBuilder()
                .setAllowedClockSkewSeconds(CLOCK_SKEW_SECONDS)
                .build()
                .parseClaimsJwt(jwtClaimsPart)
                .getBody();
    }

    private String extractAuthorization(ServerWebExchange exchange) {
        String authorization = (String) exchange.getAttributes().get(ORIGINAL_AUTHORIZATION_ATTR);
        if (isNotBlank(authorization)) {
            return authorization;
        }

        // fallback for routes that don't go through ToolWebSocketProxyUrlFilter (e.g. /ws/nats)
        return exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
    }

}
