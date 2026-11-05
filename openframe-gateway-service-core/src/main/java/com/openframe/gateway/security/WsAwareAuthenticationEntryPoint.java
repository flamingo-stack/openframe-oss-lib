package com.openframe.gateway.security;

import com.nimbusds.jwt.JWTParser;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.gateway.config.ws.WebSocketServiceSecurityDecorator;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import com.openframe.gateway.service.ReactiveAuditRecorder;
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

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import static com.openframe.data.document.audit.AuditAction.AUTH_TOKEN_FAIL;
import static com.openframe.data.document.audit.AuditOutcome.FAILURE;
import static com.openframe.data.document.audit.AuditRequestContext.CLIENT_IP_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.REQUEST_ID_HEADER;

@Component
@RequiredArgsConstructor
@Slf4j
public class WsAwareAuthenticationEntryPoint implements ServerAuthenticationEntryPoint {

    private final GatewayTrafficMetrics gatewayTrafficMetrics;
    private final ReactiveAuditRecorder auditRecorder;
    private final ServerAuthenticationEntryPoint delegate = new BearerTokenServerAuthenticationEntryPoint();

    @Override
    public Mono<Void> commence(ServerWebExchange exchange, AuthenticationException ex) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();
        String rawToken = rawToken(request);
        String reason = classify(rawToken, ex);
        if (isWebSocketUpgrade(request)) {
            gatewayTrafficMetrics.recordUpgradeRejected(WebSocketServiceSecurityDecorator.toolFromPath(path), reason);
            log.debug("WS upgrade REJECTED path={} sub={} reason={} : {}",
                    path, claimOf(rawToken, "sub"), reason, ex.getMessage());
        } else {
            log.debug("Request rejected (401) path={} : {}", path, ex.getMessage());
        }
        String source = Objects.requireNonNullElse(request.getHeaders().getFirst(CLIENT_IP_HEADER), "-");
        return auditRecorder.recordOnce(tokenFailure(request, path, rawToken, reason), exchange, source)
                .then(delegate.commence(exchange, ex));
    }

    private static AuditEntry tokenFailure(ServerHttpRequest request, String path, String rawToken, String reason) {
        Map<String, Object> details = new HashMap<>();
        details.put("path", path);
        details.put("sub", claimOf(rawToken, "sub"));
        return AuditEntry.builder()
                .action(AUTH_TOKEN_FAIL)
                .outcome(FAILURE)
                .reason(reason)
                .targetId(request.getHeaders().getFirst(REQUEST_ID_HEADER))
                .deviceId(claimOf(rawToken, "machine_id"))
                .details(details)
                .build();
    }

    private static boolean isWebSocketUpgrade(ServerHttpRequest request) {
        String upgrade = request.getHeaders().getFirst(HttpHeaders.UPGRADE);
        return (upgrade != null && upgrade.equalsIgnoreCase("websocket"))
                || request.getPath().value().startsWith("/ws/");
    }

    private static String classify(String rawToken, AuthenticationException ex) {
        if (rawToken == null) {
            return "missing_token";
        }
        String message = String.valueOf(ex.getMessage()).toLowerCase(Locale.ROOT);
        return message.contains("expired") ? "expired_token" : "invalid_token";
    }

    private static String claimOf(String rawToken, String name) {
        if (rawToken == null) {
            return null;
        }
        try {
            return JWTParser.parse(rawToken).getJWTClaimsSet().getStringClaim(name);
        } catch (Exception e) {
            return null;
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
