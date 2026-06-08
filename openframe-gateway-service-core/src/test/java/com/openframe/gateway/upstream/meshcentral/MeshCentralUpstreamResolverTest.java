package com.openframe.gateway.upstream.meshcentral;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.gateway.tenant.GatewayTenantNamespace;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MeshCentralUpstreamResolverTest {

    private ProxyUrlResolver proxyUrlResolver;
    private MeshCentralRoutingProperties props;
    private MeshCentralUpstreamResolver resolver;

    @BeforeEach
    void setUp() {
        proxyUrlResolver = mock(ProxyUrlResolver.class);
        props = new MeshCentralRoutingProperties();
        MeshCentralRoutingProperties.Upstream ws = new MeshCentralRoutingProperties.Upstream();
        ws.setUrl("ws://meshcentral.tenant-ns.svc.cluster.local");
        ws.setPort("8383");
        ws.setPathPrefix("/" + GatewayTenantNamespace.TENANT_UUID_PLACEHOLDER);
        props.setWebsocket(ws);
        resolver = new MeshCentralUpstreamResolver(props, proxyUrlResolver);
    }

    @Test
    void rewritesNamespaceAndPathPrefixForCallingTenant() {
        when(proxyUrlResolver.resolve(anyString(), anyString(), anyString(), any(), anyString()))
                .thenReturn(URI.create("ws://meshcentral.tenant-ns.svc.cluster.local:8383/meshrelay.ashx"));

        ServerHttpRequest request = MockServerHttpRequest.get("/ws/tools/meshcentral-server/meshrelay.ashx")
                .header(GatewayTenantNamespace.TENANT_NS_HEADER, "acme")
                .header(GatewayTenantNamespace.TENANT_ID_HEADER, "abc-123")
                .build();

        URI uri = resolver.resolveWs(null, request, "/tools");

        assertThat(uri.getHost()).isEqualTo("meshcentral.acme.svc.cluster.local");
        assertThat(uri.getRawPath()).isEqualTo("/abc-123/meshrelay.ashx");
    }

    @Test
    void leavesHostAndPrefixUntouchedForSingleTenantPod() {
        // No X-Tenant-* headers: behaves exactly as before (configured namespace, literal prefix).
        when(proxyUrlResolver.resolve(anyString(), anyString(), anyString(), any(), anyString()))
                .thenReturn(URI.create("ws://meshcentral.integrated-tools.svc.cluster.local:8383/meshrelay.ashx"));

        ServerHttpRequest request = MockServerHttpRequest.get("/ws/tools/meshcentral-server/meshrelay.ashx").build();

        URI uri = resolver.resolveWs(null, request, "/tools");

        assertThat(uri.getHost()).isEqualTo("meshcentral.integrated-tools.svc.cluster.local");
        assertThat(uri.getRawPath()).isEqualTo("/tenant-uuid/meshrelay.ashx");
    }
}
