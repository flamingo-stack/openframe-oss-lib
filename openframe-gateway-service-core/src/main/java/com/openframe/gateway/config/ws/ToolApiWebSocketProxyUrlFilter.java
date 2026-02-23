package com.openframe.gateway.config.ws;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.data.service.ToolUrlService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

import static com.openframe.gateway.config.ws.WebSocketGatewayConfig.TOOLS_API_WS_ENDPOINT_PREFIX;

@Component
@Slf4j
public class ToolApiWebSocketProxyUrlFilter extends ToolWebSocketProxyUrlFilter {

    public ToolApiWebSocketProxyUrlFilter(
            ReactiveIntegratedToolRepository toolRepository,
            ToolUrlService toolUrlService,
            ProxyUrlResolver proxyUrlResolver
    ) {
        super(toolRepository, toolUrlService, proxyUrlResolver);
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
        ToolCredentials credentials = tool.getCredentials();
        APIKeyType apiKeyType = credentials != null && credentials.getApiKey() != null
                ? credentials.getApiKey().getType()
                : APIKeyType.NONE;

        switch (apiKeyType) {
            case HEADER:
                String keyName = credentials.getApiKey().getKeyName();
                String key = credentials.getApiKey().getKey();
                log.debug("Adding API key header '{}' for tool: {}", keyName, tool.getId());
                return exchange.mutate()
                        .request(r -> r.header(keyName, key))
                        .build();
            case BEARER_TOKEN:
                String token = credentials.getApiKey().getKey();
                log.debug("Adding Bearer token header for tool: {}", tool.getId());
                return exchange.mutate()
                        .request(r -> r.header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                        .build();
            default:
                return exchange;
        }
    }
}
