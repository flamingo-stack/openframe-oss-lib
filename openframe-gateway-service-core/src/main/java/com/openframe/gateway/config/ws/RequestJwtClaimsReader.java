package com.openframe.gateway.config.ws;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtParser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import java.time.Instant;
import java.util.Optional;

import static com.openframe.gateway.config.ws.ToolWebSocketProxyUrlFilter.ORIGINAL_AUTHORIZATION_ATTR;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Component
@RequiredArgsConstructor
public class RequestJwtClaimsReader {

    private final JwtParser jwtParser;

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

    private Claims getClaims(ServerWebExchange exchange) {
        String authorization = extractAuthorization(exchange);

        if (isBlank(authorization)) {
            throw new IllegalStateException("No Authorization header found");
        }
        if (!authorization.startsWith("Bearer ")) {
            throw new IllegalStateException("No bearer token in Authorization header");
        }

        String jwt = authorization.substring(7);
        return jwtParser
                .parseClaimsJws(jwt)
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

