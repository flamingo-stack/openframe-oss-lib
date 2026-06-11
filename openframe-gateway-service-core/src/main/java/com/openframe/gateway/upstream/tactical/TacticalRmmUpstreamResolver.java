package com.openframe.gateway.upstream.tactical;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import com.openframe.gateway.upstream.ToolUpstreamResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Optional;

/**
 * Tactical-RMM specific routing strategy.
 *
 * Replaces the previous behavior of going through {@code tactical-nginx} (which
 * itself fanned out to backend / Daphne / NATS by path). After nginx removal,
 * tactical-rmm now exposes three independent upstreams and the gateway picks the
 * right one based on the request path:
 *
 *   - REST  →  backend (Django via uWSGI {@code http-socket})
 *   - WS, path containing the NATS path-prefix  →  NATS websocket listener
 *   - WS, anything else                          →  Daphne (ASGI websockets)
 *
 * Upstream addresses are read from {@link TacticalRmmRoutingProperties}, populated
 * from {@code openframe.tools.tactical-rmm.*} in {@code application.yml}.
 */
@Component
@RequiredArgsConstructor
public class TacticalRmmUpstreamResolver implements ToolUpstreamResolver {

    public static final String TOOL_ID = "tactical-rmm";

    private final TacticalRmmRoutingProperties props;
    private final ProxyUrlResolver proxyUrlResolver;

    /**
     * Multi-tenant routing mode. When true the trusted {@code X-Tenant-Ns} header is guaranteed by the
     * upstream tenant-context enforcement and drives the namespace rewrite; when false (single-tenant
     * pods) headers are never read and the configured host is used verbatim.
     */
    @Value("${openframe.gateway.tenant-routing.enabled:false}")
    private boolean tenantRoutingEnabled;

    @Override
    public Optional<String> supportsToolId() {
        return Optional.of(TOOL_ID);
    }

    @Override
    public URI resolveRest(IntegratedTool tool, ServerHttpRequest request, String stripPrefix) {
        return build(props.getBackend(), request, stripPrefix);
    }

    @Override
    public URI resolveWs(IntegratedTool tool, ServerHttpRequest request, String stripPrefix) {
        TacticalRmmRoutingProperties.Upstream upstream =
                isNatsPath(request.getURI().getPath()) ? props.getNats() : props.getWebsocket();
        return build(upstream, request, stripPrefix);
    }

    private boolean isNatsPath(String path) {
        return path.contains(props.getNats().getPathPrefix());
    }

    private URI build(TacticalRmmRoutingProperties.Upstream upstream,
                      ServerHttpRequest request, String stripPrefix) {
        URI resolved = proxyUrlResolver.resolve(
                TOOL_ID, upstream.getUrl(), upstream.getPort(), request.getURI(), stripPrefix);
        if (tenantRoutingEnabled) {
            // Multi-tenant pod: swap the namespace placeholder for the calling tenant's namespace.
            return TenantRoutingHeaders.applyToUri(resolved, TenantRoutingHeaders.tenantNamespace(request));
        }
        return resolved;
    }
}
