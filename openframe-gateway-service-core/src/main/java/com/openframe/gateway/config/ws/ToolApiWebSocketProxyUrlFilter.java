package com.openframe.gateway.config.ws;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.gateway.service.ToolApiKeyHeadersResolver;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.data.service.ToolUrlService;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import java.util.Map;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.TOOLS_API_WS_ENDPOINT_PREFIX;

@Component
public class ToolApiWebSocketProxyUrlFilter extends ToolWebSocketProxyUrlFilter {

    private final ToolApiKeyHeadersResolver apiKeyHeadersResolver;

    public ToolApiWebSocketProxyUrlFilter(
            ReactiveIntegratedToolRepository toolRepository,
            ToolUrlService toolUrlService,
            ProxyUrlResolver proxyUrlResolver,
            ToolApiKeyHeadersResolver apiKeyHeadersResolver
    ) {
        super(toolRepository, toolUrlService, proxyUrlResolver);
        this.apiKeyHeadersResolver = apiKeyHeadersResolver;
    }

    @Override
    protected String getRequestToolId(String path) {
        return path.split("/")[3];
    }

    @Override
    protected String getEndpointPrefix() {
        return TOOLS_API_WS_ENDPOINT_PREFIX;
    }

    @Override
    protected ServerWebExchange mutateExchange(ServerWebExchange exchange, IntegratedTool tool) {
        Map<String, String> apiKeyHeaders = apiKeyHeadersResolver.resolve(tool);
        if (apiKeyHeaders.isEmpty()) {
            return exchange;
        }

        return exchange.mutate()
                .request(r -> apiKeyHeaders.forEach(r::header))
                .build();
    }
}
