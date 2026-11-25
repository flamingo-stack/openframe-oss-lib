package com.openframe.gateway.config.ws;

import com.openframe.gateway.service.ToolApiKeyHeadersResolver;
import com.openframe.gateway.upstream.ToolUpstreamResolverRegistry;
import com.openframe.gateway.upstream.meshcentral.MeshControlUpstreamAuth;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;

import java.net.URI;
import java.util.Map;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.TOOLS_API_WS_ENDPOINT_PREFIX;

@Component
public class ToolApiWebSocketProxyUrlFilter extends ToolWebSocketProxyUrlFilter {

    private final ToolApiKeyHeadersResolver apiKeyHeadersResolver;
    private final MeshControlUpstreamAuth meshControlUpstreamAuth;

    public ToolApiWebSocketProxyUrlFilter(
            ReactiveIntegratedToolRepository toolRepository,
            ToolUpstreamResolverRegistry upstreamRegistry,
            ToolApiKeyHeadersResolver apiKeyHeadersResolver,
            MeshControlUpstreamAuth meshControlUpstreamAuth
    ) {
        super(toolRepository, upstreamRegistry);
        this.apiKeyHeadersResolver = apiKeyHeadersResolver;
        this.meshControlUpstreamAuth = meshControlUpstreamAuth;
    }

    @Override
    protected String getRequestToolId(String path) {
        String[] segments = path.split("/");
        if (segments.length < 4) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid WebSocket proxy path: " + path);
        }
        return segments[3];
    }

    @Override
    protected String getEndpointPrefix() {
        return TOOLS_API_WS_ENDPOINT_PREFIX;
    }

    @Override
    protected URI adjustProxyUri(URI proxyUri, String path) {
        if (meshControlUpstreamAuth.appliesTo(path)) {
            return meshControlUpstreamAuth.withoutCredentialParams(proxyUri);
        }
        return proxyUri;
    }

    @Override
    protected ServerWebExchange mutateExchange(ServerWebExchange exchange, IntegratedTool tool) {
        Map<String, String> apiKeyHeaders = apiKeyHeadersResolver.resolve(tool);
        String path = exchange.getRequest().getURI().getPath();
        boolean meshControlAuth = meshControlUpstreamAuth.appliesTo(path);

        return exchange.mutate()
                .request(r -> r.headers(h -> {
                    h.remove(HttpHeaders.ORIGIN);
                    apiKeyHeaders.forEach(h::set);
                    if (meshControlAuth) {
                        h.set(MeshControlUpstreamAuth.MESH_AUTH_HEADER, meshControlUpstreamAuth.headerValue());
                    }
                }))
                .build();
    }
}

