package com.openframe.gateway.config.ws;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import java.time.Instant;

import static com.openframe.gateway.config.ws.ToolWebSocketProxyUrlFilter.ORIGINAL_AUTHORIZATION_ATTR;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@RequiredArgsConstructor
public class RequestJwtСlaimsReader {

    public Instant getExpiration(ServerWebExchange exchange) {
        Claims jwtClaims = getClaims(exchange);
        return jwtClaims.getExpiration().toInstant();
    }

    private Claims getClaims(ServerWebExchange exchange) {
        String authorization = (String) exchange.getAttributes().get(ORIGINAL_AUTHORIZATION_ATTR);

        if (isBlank(authorization)) {
            throw new IllegalStateException("No Authorization header found");
        }
        if (!authorization.startsWith("Bearer ")) {
            throw new IllegalStateException("No bearer token in Authorization header");
        }

        String jwtClaimsPart = authorization.substring(7, authorization.lastIndexOf('.') + 1);
        return Jwts.parserBuilder()
                .build()
                .parseClaimsJwt(jwtClaimsPart)
                .getBody();
    }

}
