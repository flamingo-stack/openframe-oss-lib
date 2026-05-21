package com.openframe.gateway.upstream.meshcentral;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.gateway.upstream.ToolUpstreamResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Optional;

/**
 * MeshCentral-specific routing strategy.
 *
 * Reads upstream addresses from {@link MeshCentralRoutingProperties}, populated
 * from {@code openframe.tools.meshcentral.*} in {@code application.yml}.
 * This avoids a MongoDB lookup on every request (which the
 * {@link com.openframe.gateway.upstream.DefaultToolUpstreamResolver} would do).
 *
 * MeshCentral is a single service on one port — no path-based fan-out needed.
 * Both REST and WebSocket traffic go to the same host, just with different
 * URL schemes (http vs ws).
 */
@Component
@RequiredArgsConstructor
public class MeshCentralUpstreamResolver implements ToolUpstreamResolver {

    public static final String TOOL_ID = "meshcentral-server";

    private final MeshCentralRoutingProperties props;
    private final ProxyUrlResolver proxyUrlResolver;

    @Override
    public Optional<String> supportsToolId() {
        return Optional.of(TOOL_ID);
    }

    @Override
    public URI resolveRest(IntegratedTool tool, ServerHttpRequest request, String stripPrefix) {
        return build(props.getApi(), request, stripPrefix);
    }

    @Override
    public URI resolveWs(IntegratedTool tool, ServerHttpRequest request, String stripPrefix) {
        return build(props.getWebsocket(), request, stripPrefix);
    }

    private URI build(MeshCentralRoutingProperties.Upstream upstream,
                      ServerHttpRequest request, String stripPrefix) {
        URI resolved = proxyUrlResolver.resolve(
                TOOL_ID, upstream.getUrl(), upstream.getPort(), request.getURI(), stripPrefix);
        return prependPathPrefix(resolved, upstream.getPathPrefix());
    }

    private URI prependPathPrefix(URI uri, String pathPrefix) {
        if (pathPrefix == null || pathPrefix.isEmpty() || "/".equals(pathPrefix)) {
            return uri;
        }
        String prefix = pathPrefix.startsWith("/") ? pathPrefix : "/" + pathPrefix;
        if (prefix.endsWith("/")) {
            prefix = prefix.substring(0, prefix.length() - 1);
        }
        String existingPath = uri.getRawPath() == null ? "" : uri.getRawPath();
        return UriComponentsBuilder.fromUri(uri)
                .replacePath(prefix + existingPath)
                .build(true)
                .toUri();
    }
}
