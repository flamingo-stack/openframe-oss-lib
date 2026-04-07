package com.openframe.gateway.upstream;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.service.ToolUrlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Optional;

/**
 * Default fallback resolver. Reads the upstream URL from the {@link IntegratedTool}
 * Mongo document via {@link ToolUrlService}. Preserves the previous behavior for
 * every tool that does not register a dedicated {@link ToolUpstreamResolver}.
 */
@Component
@RequiredArgsConstructor
public class DefaultToolUpstreamResolver implements ToolUpstreamResolver {

    private final ToolUrlService toolUrlService;
    private final ProxyUrlResolver proxyUrlResolver;

    @Override
    public Optional<String> supportsToolId() {
        return Optional.empty();
    }

    @Override
    public URI resolveRest(IntegratedTool tool, ServerHttpRequest request, String stripPrefix) {
        return resolveByType(tool, request, stripPrefix, ToolUrlType.API);
    }

    @Override
    public URI resolveWs(IntegratedTool tool, ServerHttpRequest request, String stripPrefix) {
        return resolveByType(tool, request, stripPrefix, ToolUrlType.WS);
    }

    private URI resolveByType(IntegratedTool tool, ServerHttpRequest request,
                              String stripPrefix, ToolUrlType type) {
        ToolUrl toolUrl = toolUrlService.getUrlByToolType(tool, type)
                .orElseThrow(() -> new IllegalStateException(
                        "Tool " + tool.getId() + " has no " + type + " url configured"));
        return proxyUrlResolver.resolve(
                tool.getId(), toolUrl.getUrl(), toolUrl.getPort(), request.getURI(), stripPrefix);
    }
}
