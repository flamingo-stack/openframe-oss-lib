package com.openframe.gateway.upstream.fleet;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.gateway.config.prop.FleetMultiTenancyProperties;
import com.openframe.gateway.upstream.DefaultToolUpstreamResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class FleetUpstreamResolverTest {

    private static final String API_URL = "http://fleet.fleet-shared.svc.cluster.local";
    private static final String WS_URL = "ws://fleet.fleet-shared.svc.cluster.local";
    private static final String PORT = "8080";

    private ProxyUrlResolver proxyUrlResolver;
    private DefaultToolUpstreamResolver defaultResolver;
    private FleetMultiTenancyProperties properties;
    private FleetUpstreamResolver resolver;

    @BeforeEach
    void setUp() {
        proxyUrlResolver = mock(ProxyUrlResolver.class);
        defaultResolver = mock(DefaultToolUpstreamResolver.class);
        properties = new FleetMultiTenancyProperties();
        resolver = new FleetUpstreamResolver(properties, proxyUrlResolver, defaultResolver);
    }

    private static ServerHttpRequest request(String path) {
        return MockServerHttpRequest.get(path).build();
    }

    private void configureSharedUpstream() {
        properties.setEnabled(true);
        properties.getUpstream().getApi().setUrl(API_URL);
        properties.getUpstream().getApi().setPort(PORT);
        properties.getUpstream().getWebsocket().setUrl(WS_URL);
        properties.getUpstream().getWebsocket().setPort(PORT);
    }

    @Test
    void routesRestToSharedFleetApiWhenEnabledAndConfigured() {
        configureSharedUpstream();
        URI expected = URI.create(API_URL + ":8080/api/latest/fleet/hosts");
        when(proxyUrlResolver.resolve(anyString(), anyString(), anyString(), any(), anyString())).thenReturn(expected);

        URI uri = resolver.resolveRest(mock(IntegratedTool.class),
                request("/tools/fleetmdm-server/api/latest/fleet/hosts"), "/tools");

        assertThat(uri).isEqualTo(expected);
        verify(proxyUrlResolver).resolve(eq(FleetUpstreamResolver.TOOL_ID), eq(API_URL), eq(PORT), any(), eq("/tools"));
        verifyNoInteractions(defaultResolver);
    }

    @Test
    void agentPlaneRoutesToSharedFleetApiToo() {
        configureSharedUpstream();
        when(proxyUrlResolver.resolve(anyString(), anyString(), anyString(), any(), anyString()))
                .thenReturn(URI.create(API_URL + ":8080/api/osquery/enroll"));

        resolver.resolveRest(mock(IntegratedTool.class),
                request("/tools/agent/fleetmdm-server/api/osquery/enroll"), "/tools/agent");

        verify(proxyUrlResolver).resolve(eq(FleetUpstreamResolver.TOOL_ID), eq(API_URL), eq(PORT), any(), eq("/tools/agent"));
        verifyNoInteractions(defaultResolver);
    }

    @Test
    void routesWsToSharedFleetWebsocketEndpoint() {
        configureSharedUpstream();
        when(proxyUrlResolver.resolve(anyString(), anyString(), anyString(), any(), anyString()))
                .thenReturn(URI.create(WS_URL + ":8080/api/v1/fleet/results/websocket"));

        resolver.resolveWs(mock(IntegratedTool.class),
                request("/ws/tools/fleetmdm-server/api/v1/fleet/results/websocket"), "/tools");

        verify(proxyUrlResolver).resolve(eq(FleetUpstreamResolver.TOOL_ID), eq(WS_URL), eq(PORT), any(), eq("/tools"));
        verifyNoInteractions(defaultResolver);
    }

    @Test
    void flagOffDelegatesToPerTenantDocRouting() {
        // enabled=false (default) — even with a URL configured, per-tenant routing stays.
        properties.getUpstream().getApi().setUrl(API_URL);
        IntegratedTool tool = mock(IntegratedTool.class);
        ServerHttpRequest req = request("/tools/fleetmdm-server/api/latest/fleet/hosts");
        URI perTenant = URI.create("http://fleet-service.tenant-0.svc.cluster.local:8080/api/latest/fleet/hosts");
        when(defaultResolver.resolveRest(tool, req, "/tools")).thenReturn(perTenant);

        URI uri = resolver.resolveRest(tool, req, "/tools");

        assertThat(uri).isEqualTo(perTenant);
        verifyNoInteractions(proxyUrlResolver);
    }

    @Test
    void apiConfiguredButWebsocketMissingDelegatesWsToPerTenant() {
        // Regression: api set, websocket URL blank — WS must delegate per-tenant, not pass a blank
        // URL to the proxy resolver (which would fail URI parsing).
        properties.setEnabled(true);
        properties.getUpstream().getApi().setUrl(API_URL);
        properties.getUpstream().getApi().setPort(PORT);
        // websocket left unset

        IntegratedTool tool = mock(IntegratedTool.class);
        ServerHttpRequest wsReq = request("/ws/tools/fleetmdm-server/api/v1/fleet/results/websocket");
        URI perTenantWs = URI.create("ws://fleet-service.tenant-0.svc.cluster.local:8080/api/v1/fleet/results/websocket");
        when(defaultResolver.resolveWs(tool, wsReq, "/tools")).thenReturn(perTenantWs);

        // WS delegates per-tenant...
        assertThat(resolver.resolveWs(tool, wsReq, "/tools")).isEqualTo(perTenantWs);

        // ...while REST still routes to the shared api endpoint.
        ServerHttpRequest restReq = request("/tools/fleetmdm-server/api/latest/fleet/hosts");
        when(proxyUrlResolver.resolve(anyString(), anyString(), anyString(), any(), anyString()))
                .thenReturn(URI.create(API_URL + ":8080/api/latest/fleet/hosts"));
        resolver.resolveRest(tool, restReq, "/tools");
        verify(proxyUrlResolver).resolve(eq(FleetUpstreamResolver.TOOL_ID), eq(API_URL), eq(PORT), any(), eq("/tools"));
    }

    @Test
    void enabledWithoutApiUrlDelegatesToPerTenantDocRouting() {
        // The allowlist-only rollout phase: flag on, no shared upstream configured yet.
        properties.setEnabled(true);
        IntegratedTool tool = mock(IntegratedTool.class);
        ServerHttpRequest req = request("/ws/tools/fleetmdm-server/x");
        URI perTenant = URI.create("ws://fleet-service.tenant-0.svc.cluster.local:8080/x");
        when(defaultResolver.resolveWs(tool, req, "/tools")).thenReturn(perTenant);

        URI uri = resolver.resolveWs(tool, req, "/tools");

        assertThat(uri).isEqualTo(perTenant);
        verifyNoInteractions(proxyUrlResolver);
    }
}
