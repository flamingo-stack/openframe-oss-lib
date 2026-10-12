package com.openframe.gateway.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.core.clientversion.BundleVersions;
import com.openframe.core.clientversion.ClientIdentity;
import com.openframe.core.clientversion.ClientIdentityParser;
import com.openframe.core.clientversion.ClientKind;
import com.openframe.core.clientversion.MobileVersionPolicyProperties;
import com.openframe.gateway.metrics.GatewayTrafficMetrics;
import com.openframe.gateway.model.ClientUpgradeRequiredResponse;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;

import static com.openframe.core.constants.HttpHeaders.X_OPENFRAME_CLIENT;
import static org.springframework.http.HttpHeaders.UPGRADE;
import static org.springframework.http.HttpStatus.UPGRADE_REQUIRED;

@Slf4j
@Component
@RequiredArgsConstructor
public class ClientUpgradeGateFilter implements GlobalFilter, Ordered {

    private static final int ORDER = -200;
    private static final String WEBSOCKET = "websocket";
    private static final List<String> EXEMPT_PATH_PREFIXES = List.of("/oauth/", "/actuator", "/health", "/ws/");

    private final MobileVersionPolicyProperties properties;
    private final GatewayTrafficMetrics metrics;
    private final ObjectMapper objectMapper;

    @Override
    public int getOrder() {
        return ORDER;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        if (isExempt(request)) {
            return chain.filter(exchange);
        }
        String header = request.getHeaders().getFirst(X_OPENFRAME_CLIENT);
        if (header == null || header.isBlank()) {
            return handleMissingHeader(exchange, chain);
        }
        ClientIdentity identity = ClientIdentityParser.parse(header);
        if (isBelowMinimum(identity)) {
            return rejectUpgradeRequired(exchange, identity);
        }
        log.debug("Client gate passed: tenantId={} client={} path={}",
                TenantRoutingHeaders.tenantId(request), identity, request.getPath().value());
        return chain.filter(exchange);
    }

    private Mono<Void> handleMissingHeader(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (properties.isEnforceMissingHeader()) {
            return rejectUpgradeRequired(exchange, ClientIdentity.unknown());
        }
        ServerHttpRequest request = exchange.getRequest();
        log.debug("Client gate passed without client header: tenantId={} path={}",
                TenantRoutingHeaders.tenantId(request), request.getPath().value());
        return chain.filter(exchange);
    }

    private boolean isExempt(ServerHttpRequest request) {
        if (HttpMethod.OPTIONS.equals(request.getMethod())) {
            return true;
        }
        String upgrade = request.getHeaders().getFirst(UPGRADE);
        if (WEBSOCKET.equalsIgnoreCase(upgrade)) {
            return true;
        }
        String path = request.getPath().value();
        return EXEMPT_PATH_PREFIXES.stream().anyMatch(path::startsWith);
    }

    // Only the bundle is compared: the shell version is "-" for requests sent before the native bridge answers.
    private boolean isBelowMinimum(ClientIdentity identity) {
        if (!identity.getKind().isMobile()) {
            return false;
        }
        return BundleVersions.isBelow(identity.getBundleVersion(), properties.getMinBundleVersion());
    }

    private Mono<Void> rejectUpgradeRequired(ServerWebExchange exchange, ClientIdentity identity) {
        ServerHttpRequest request = exchange.getRequest();
        ClientKind kind = identity.getKind();
        log.info("Client upgrade required: tenantId={} client={} minBundleVersion={} method={} path={}",
                TenantRoutingHeaders.tenantId(request), identity, properties.getMinBundleVersion(),
                request.getMethod(), request.getPath().value());
        metrics.recordClientUpgradeRequired(kind.getLabel());

        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(UPGRADE_REQUIRED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String storeUrl = properties.storeUrl(kind);
        ClientUpgradeRequiredResponse body = new ClientUpgradeRequiredResponse(
                ClientUpgradeRequiredResponse.CODE, properties.getMinBundleVersion(), storeUrl);
        Mono<DataBuffer> buffer = Mono.fromCallable(() -> objectMapper.writeValueAsBytes(body))
                .map(response.bufferFactory()::wrap);
        return response.writeWith(buffer);
    }
}
