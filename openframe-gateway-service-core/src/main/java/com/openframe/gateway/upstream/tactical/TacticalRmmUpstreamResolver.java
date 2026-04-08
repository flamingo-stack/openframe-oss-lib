package com.openframe.gateway.upstream.tactical;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.gateway.upstream.ToolUpstreamResolver;
import lombok.RequiredArgsConstructor;
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
        return proxyUrlResolver.resolve(
                TOOL_ID, upstream.getUrl(), upstream.getPort(), request.getURI(), stripPrefix);
    }
}
