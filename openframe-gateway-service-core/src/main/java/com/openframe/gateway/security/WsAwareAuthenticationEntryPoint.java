package com.openframe.gateway.security;

import com.nimbusds.jwt.JWTParser;
import com.openframe.gateway.config.ws.WebSocketServiceSecurityDecorator;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.web.server.BearerTokenServerAuthenticationEntryPoint;
import org.springframework.security.web.server.ServerAuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Locale;

/**
 * Delegates 401 handling to the standard bearer-token entry point, but first makes WebSocket upgrade
 * rejections OBSERVABLE. Without this, an agent presenting an expired JWT is rejected silently
 * (Spring Security 401, nothing in gateway logs, no session ever opens) — from the outside the fleet
 * just "goes offline" one machine at a time as token rotation breaks, and the only evidence is on the
 * endpoints. A WARN log line (path + sub + why) plus the
 * {@code openframe.tenant.gateway.websocket.upgrade.rejected{tool,reason}} counter make that failure
 * mode visible on the gateway within one scrape interval.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WsAwareAuthenticationEntryPoint implements ServerAuthenticationEntryPoint {

    private final GatewayTrafficMetrics gatewayTrafficMetrics;
    private final ServerAuthenticationEntryPoint delegate = new BearerTokenServerAuthenticationEntryPoint();

    @Override
    public Mono<Void> commence(ServerWebExchange exchange, AuthenticationException ex) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        if (isWebSocketUpgrade(request)) {
            String rawToken = rawToken(request);
            String reason = classify(rawToken, ex);
            gatewayTrafficMetrics.recordUpgradeRejected(WebSocketServiceSecurityDecorator.toolFromPath(path), reason);
            log.debug("WS upgrade REJECTED path={} sub={} reason={} : {}",
                    path, subOf(rawToken), reason, ex.getMessage());
        } else {
            log.debug("Request rejected (401) path={} : {}", path, ex.getMessage());
        }
        return delegate.commence(exchange, ex);
    }

    private static boolean isWebSocketUpgrade(ServerHttpRequest request) {
        String upgrade = request.getHeaders().getFirst(HttpHeaders.UPGRADE);
        return (upgrade != null && upgrade.equalsIgnoreCase("websocket"))
                || request.getPath().value().startsWith("/ws/");
    }

    /** Low-cardinality reason tag: expired_token / invalid_token / missing_token. */
    private static String classify(String rawToken, AuthenticationException ex) {
        if (rawToken == null) {
            return "missing_token";
        }
        String message = String.valueOf(ex.getMessage()).toLowerCase(Locale.ROOT);
        return message.contains("expired") ? "expired_token" : "invalid_token";
    }

    /** JWT {@code sub} parsed WITHOUT signature verification — authentication already failed here, so the
     *  raw token is the only available source; logging/correlation only. */
    private static String subOf(String rawToken) {
        if (rawToken == null) {
            return "-";
        }
        try {
            String sub = JWTParser.parse(rawToken).getJWTClaimsSet().getSubject();
            return sub == null ? "-" : sub;
        } catch (Exception e) {
            return "-";
        }
    }

    private static String rawToken(ServerHttpRequest request) {
        String auth = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7);
        }
        String query = request.getURI().getRawQuery();
        if (query != null) {
            for (String kv : query.split("&")) {
                if (kv.startsWith("authorization=")) {
                    return kv.substring("authorization=".length());
                }
            }
        }
        return null;
    }
}
