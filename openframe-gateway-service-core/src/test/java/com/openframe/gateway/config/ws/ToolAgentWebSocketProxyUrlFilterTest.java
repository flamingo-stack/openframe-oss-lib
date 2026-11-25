package com.openframe.gateway.config.ws;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.gateway.upstream.ToolUpstreamResolver;
import com.openframe.gateway.upstream.ToolUpstreamResolverRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolAgentWebSocketProxyUrlFilterTest {

    private static final String MESH_TOOL_ID = "meshcentral-server";
    private static final String ENDPOINT_PREFIX = "/ws/tools/agent";
    private static final String AGENT_PATH = "/ws/tools/agent/meshcentral-server/agent.ashx";
    private static final String MESH_AUTH_HEADER = "x-meshauth";
    private static final URI RESOLVED_URI =
            URI.create("ws://mesh.tenant-1.svc:8383/tenant-1/agent.ashx?id=42");

    @Mock private ReactiveIntegratedToolRepository toolRepository;
    @Mock private ToolUpstreamResolverRegistry upstreamRegistry;
    @Mock private ToolUpstreamResolver upstreamResolver;
    @Mock private GatewayFilterChain chain;

    @Captor private ArgumentCaptor<ServerWebExchange> exchangeCaptor;

    @InjectMocks private ToolAgentWebSocketProxyUrlFilter filter;

    private IntegratedTool tool;

    @BeforeEach
    void setUp() {
        tool = new IntegratedTool();
        tool.setKey(MESH_TOOL_ID);
        tool.setName("MeshCentral Server");
        tool.setEnabled(true);
    }

    @Test
    void filter_clientSuppliesUpstreamAuthHeader_headerNotForwarded() {
        // setup
        MockServerHttpRequest request = MockServerHttpRequest.get(AGENT_PATH + "?id=42")
                .header(MESH_AUTH_HEADER, "client-value")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);
        when(toolRepository.findByKey(MESH_TOOL_ID)).thenReturn(Mono.just(tool));
        when(upstreamRegistry.resolve(MESH_TOOL_ID)).thenReturn(upstreamResolver);
        when(upstreamResolver.resolveWs(tool, exchange.getRequest(), ENDPOINT_PREFIX)).thenReturn(RESOLVED_URI);
        when(chain.filter(any(ServerWebExchange.class))).thenReturn(Mono.empty());

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        verify(chain).filter(exchangeCaptor.capture());
        assertThat(exchangeCaptor.getValue().getRequest().getHeaders().get(MESH_AUTH_HEADER)).isNull();
        assertThat(exchange.getAttributes())
                .containsEntry(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR, RESOLVED_URI);
    }
}
