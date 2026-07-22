package com.openframe.gateway.upstream.fleet;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.gateway.config.prop.FleetMultiTenancyProperties;
import com.openframe.gateway.upstream.DefaultToolUpstreamResolver;
import com.openframe.gateway.upstream.ToolUpstreamResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.isNotBlank;

/**
 * Fleet MDM routing strategy for shared-DB multi-tenancy.
 *
 * <p>Target topology: <b>one shared Fleet server per cluster</b> serving all of that cluster's
 * tenants against one shared MySQL — tenant isolation happens inside Fleet (per-request team pin
 * from {@code X-Tenant-Id} / host / enroll secret), not by deployment. The gateway's job is only to
 * send every tenant's {@code fleetmdm-server} traffic to that one shared Fleet.
 *
 * <p>When {@code openframe.fleet.multi-tenancy.enabled=true} AND the matching upstream URL is
 * configured, the request routes to the configured shared Fleet — a single URL per gateway (each
 * cluster's gateway hop owns this route). REST (browser proxy {@code /tools} and agent proxy
 * {@code /tools/agent}) is gated on {@code openframe.fleet.multi-tenancy.upstream.api.url}; the
 * WebSocket plane is gated independently on
 * {@code openframe.fleet.multi-tenancy.upstream.websocket.url}. Whichever URL is missing — flag off,
 * or the allowlist-only rollout phase — delegates that plane to the {@link DefaultToolUpstreamResolver},
 * i.e. the per-tenant URL stored in the tenant's {@link IntegratedTool} document, byte-identical to
 * today (a blank URL is never passed to the proxy resolver).
 *
 * <p>Config is shaped like {@code openframe.tools.meshcentral} for consistency: separate
 * {@code api} and {@code websocket} endpoints. Fleet serves both on one listener, so they are
 * typically the same host:port differing only by scheme ({@code http} vs {@code ws}).
 */
@Component
@RequiredArgsConstructor
public class FleetUpstreamResolver implements ToolUpstreamResolver {

    public static final String TOOL_ID = "fleetmdm-server";

    private final FleetMultiTenancyProperties multiTenancyProperties;
    private final ProxyUrlResolver proxyUrlResolver;
    private final DefaultToolUpstreamResolver defaultResolver;

    @Override
    public Optional<String> supportsToolId() {
        return Optional.of(TOOL_ID);
    }

    @Override
    public URI resolveRest(IntegratedTool tool, ServerHttpRequest request, String stripPrefix) {
        FleetMultiTenancyProperties.Endpoint api = multiTenancyProperties.getUpstream().getApi();
        if (sharedRoutingEnabled(api)) {
            return proxyUrlResolver.resolve(TOOL_ID, api.getUrl(), api.getPort(), request.getURI(), stripPrefix);
        }
        return defaultResolver.resolveRest(tool, request, stripPrefix);
    }

    @Override
    public URI resolveWs(IntegratedTool tool, ServerHttpRequest request, String stripPrefix) {
        FleetMultiTenancyProperties.Endpoint ws = multiTenancyProperties.getUpstream().getWebsocket();
        if (sharedRoutingEnabled(ws)) {
            return proxyUrlResolver.resolve(TOOL_ID, ws.getUrl(), ws.getPort(), request.getURI(), stripPrefix);
        }
        return defaultResolver.resolveWs(tool, request, stripPrefix);
    }

    /**
     * Shared-Fleet routing for a given plane engages only when multi-tenancy is on AND that plane's
     * upstream URL is configured. Each plane (api / websocket) is gated on its own URL so an
     * api-only configuration keeps per-tenant WebSocket routing rather than passing a blank URL to
     * the proxy resolver.
     */
    private boolean sharedRoutingEnabled(FleetMultiTenancyProperties.Endpoint endpoint) {
        return multiTenancyProperties.isEnabled() && isNotBlank(endpoint.getUrl());
    }
}
