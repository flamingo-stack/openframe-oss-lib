package com.openframe.gateway.config.ws;

import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.gateway.upstream.ToolUpstreamResolverRegistry;
import org.springframework.stereotype.Component;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.TOOLS_AGENT_WS_ENDPOINT_PREFIX;

@Component
public class ToolAgentWebSocketProxyUrlFilter extends ToolWebSocketProxyUrlFilter {

    public ToolAgentWebSocketProxyUrlFilter(
            ReactiveIntegratedToolRepository toolRepository,
            ToolUpstreamResolverRegistry upstreamRegistry
    ) {
        super(toolRepository, upstreamRegistry);
    }

    @Override
    protected String getRequestToolId(String path) {
        return path.split("/")[4];
    }

    @Override
    protected String getEndpointPrefix() {
        return TOOLS_AGENT_WS_ENDPOINT_PREFIX;
    }

}