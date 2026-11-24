package com.openframe.gateway.config.ws;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.gateway.service.ToolApiKeyHeadersResolver;
import com.openframe.gateway.upstream.ToolUpstreamResolver;
import com.openframe.gateway.upstream.ToolUpstreamResolverRegistry;
import com.openframe.gateway.upstream.meshcentral.MeshControlUpstreamAuth;
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
import org.springframework.http.HttpHeaders;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolApiWebSocketProxyUrlFilterTest {

    private static final String MESH_TOOL_ID = "meshcentral-server";
    private static final String ENDPOINT_PREFIX = "/ws/tools";
    private static final String CONTROL_PATH = "/ws/tools/meshcentral-server/control.ashx";
    private static final String RELAY_PATH = "/ws/tools/meshcentral-server/meshrelay.ashx";
    private static final String MESH_AUTH_HEADER = "x-meshauth";
    private static final String GATEWAY_HEADER_VALUE = "Z2F0ZXdheQ==,c2VjcmV0";
    private static final String CLIENT_HEADER_VALUE = "Y2xpZW50,Y2xpZW50";
    private static final URI RESOLVED_CONTROL_URI =
            URI.create("ws://mesh.tenant-1.svc:8383/tenant-1/control.ashx?user=a&pass=b&key=1");
    private static final URI CLEAN_CONTROL_URI = URI.create("ws://mesh.tenant-1.svc:8383/tenant-1/control.ashx?key=1");
    private static final URI RESOLVED_RELAY_URI =
            URI.create("ws://mesh.tenant-1.svc:8383/tenant-1/meshrelay.ashx?auth=c==&user=a&pass=b");

    @Mock private ReactiveIntegratedToolRepository toolRepository;
    @Mock private ToolUpstreamResolverRegistry upstreamRegistry;
    @Mock private ToolApiKeyHeadersResolver apiKeyHeadersResolver;
    @Mock private MeshControlUpstreamAuth meshControlUpstreamAuth;
    @Mock private ToolUpstreamResolver upstreamResolver;
    @Mock private GatewayFilterChain chain;

    @Captor private ArgumentCaptor<ServerWebExchange> exchangeCaptor;

    @InjectMocks private ToolApiWebSocketProxyUrlFilter filter;

    private IntegratedTool tool;

    @BeforeEach
    void setUp() {
        tool = new IntegratedTool();
        tool.setKey(MESH_TOOL_ID);
        tool.setName("MeshCentral Server");
        tool.setEnabled(true);
    }

    @Test
    void filter_controlPathWithUpstreamAuth_headerReplacedAndCredentialParamsRemoved() {
        // setup
        MockServerWebExchange exchange = exchange(CONTROL_PATH + "?user=a&pass=b&key=1");
        stubRouting(exchange, RESOLVED_CONTROL_URI);
        when(meshControlUpstreamAuth.appliesTo(CONTROL_PATH)).thenReturn(true);
        when(meshControlUpstreamAuth.withoutCredentialParams(RESOLVED_CONTROL_URI)).thenReturn(CLEAN_CONTROL_URI);
        when(meshControlUpstreamAuth.headerValue()).thenReturn(GATEWAY_HEADER_VALUE);

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        verify(chain).filter(exchangeCaptor.capture());
        ServerWebExchange forwarded = exchangeCaptor.getValue();
        assertThat(forwarded.getRequest().getHeaders().get(MESH_AUTH_HEADER)).containsExactly(GATEWAY_HEADER_VALUE);
        assertThat(forwarded.getRequest().getHeaders().getFirst(HttpHeaders.ORIGIN)).isNull();
        assertThat(exchange.getAttributes())
                .containsEntry(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR, CLEAN_CONTROL_URI);
    }

    @Test
    void filter_relayPath_clientHeaderRemovedAndQueryUntouched() {
        // setup
        MockServerWebExchange exchange = exchange(RELAY_PATH + "?auth=c==&user=a&pass=b");
        stubRouting(exchange, RESOLVED_RELAY_URI);
        when(meshControlUpstreamAuth.appliesTo(RELAY_PATH)).thenReturn(false);

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        verify(chain).filter(exchangeCaptor.capture());
        ServerWebExchange forwarded = exchangeCaptor.getValue();
        assertThat(forwarded.getRequest().getHeaders().get(MESH_AUTH_HEADER)).isNull();
        assertThat(exchange.getAttributes())
                .containsEntry(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR, RESOLVED_RELAY_URI);
        verify(meshControlUpstreamAuth, never()).headerValue();
        verify(meshControlUpstreamAuth, never()).withoutCredentialParams(RESOLVED_RELAY_URI);
    }

    @Test
    void filter_controlPathWithoutUpstreamAuth_clientHeaderRemovedAndQueryUntouched() {
        // setup
        MockServerWebExchange exchange = exchange(CONTROL_PATH + "?user=a&pass=b&key=1");
        stubRouting(exchange, RESOLVED_CONTROL_URI);
        when(meshControlUpstreamAuth.appliesTo(CONTROL_PATH)).thenReturn(false);

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        verify(chain).filter(exchangeCaptor.capture());
        ServerWebExchange forwarded = exchangeCaptor.getValue();
        assertThat(forwarded.getRequest().getHeaders().get(MESH_AUTH_HEADER)).isNull();
        assertThat(exchange.getAttributes())
                .containsEntry(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR, RESOLVED_CONTROL_URI);
        verify(meshControlUpstreamAuth, never()).headerValue();
    }

    @Test
    void filter_toolApiKeyHeaders_stillSetOnTheForwardedRequest() {
        // setup
        MockServerWebExchange exchange = exchange(RELAY_PATH);
        when(toolRepository.findByKey(MESH_TOOL_ID)).thenReturn(Mono.just(tool));
        when(upstreamRegistry.resolve(MESH_TOOL_ID)).thenReturn(upstreamResolver);
        when(upstreamResolver.resolveWs(tool, exchange.getRequest(), ENDPOINT_PREFIX)).thenReturn(RESOLVED_RELAY_URI);
        when(apiKeyHeadersResolver.resolve(tool)).thenReturn(Map.of("X-Api-Key", "tool-key"));
        when(meshControlUpstreamAuth.appliesTo(RELAY_PATH)).thenReturn(false);
        when(chain.filter(any(ServerWebExchange.class))).thenReturn(Mono.empty());

        // execution
        filter.filter(exchange, chain).block();

        // verifications
        verify(chain).filter(exchangeCaptor.capture());
        assertThat(exchangeCaptor.getValue().getRequest().getHeaders().getFirst("X-Api-Key")).isEqualTo("tool-key");
    }

    private MockServerWebExchange exchange(String pathAndQuery) {
        MockServerHttpRequest request = MockServerHttpRequest.get(pathAndQuery)
                .header("X-MeshAuth", CLIENT_HEADER_VALUE, "second-client-value")
                .header(HttpHeaders.ORIGIN, "https://tenant.example.com")
                .build();
        return MockServerWebExchange.from(request);
    }

    private void stubRouting(MockServerWebExchange exchange, URI resolvedUri) {
        when(toolRepository.findByKey(MESH_TOOL_ID)).thenReturn(Mono.just(tool));
        when(upstreamRegistry.resolve(MESH_TOOL_ID)).thenReturn(upstreamResolver);
        when(upstreamResolver.resolveWs(tool, exchange.getRequest(), ENDPOINT_PREFIX)).thenReturn(resolvedUri);
        when(apiKeyHeadersResolver.resolve(tool)).thenReturn(Map.of());
        when(chain.filter(any(ServerWebExchange.class))).thenReturn(Mono.empty());
    }
}
