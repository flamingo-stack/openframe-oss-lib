package com.openframe.gateway.upstream.tactical;

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

class TacticalRmmUpstreamResolverTest {

    private ProxyUrlResolver proxyUrlResolver;
    private TacticalRmmUpstreamResolver resolver;

    @BeforeEach
    void setUp() {
        proxyUrlResolver = mock(ProxyUrlResolver.class);
        TacticalRmmRoutingProperties props = new TacticalRmmRoutingProperties();
        TacticalRmmRoutingProperties.Upstream backend = new TacticalRmmRoutingProperties.Upstream();
        backend.setUrl("http://tactical-backend.tenant-ns.svc.cluster.local");
        backend.setPort("8080");
        props.setBackend(backend);
        resolver = new TacticalRmmUpstreamResolver(props, proxyUrlResolver);
    }

    @Test
    void rewritesBackendNamespaceForCallingTenant() {
        when(proxyUrlResolver.resolve(anyString(), anyString(), anyString(), any(), anyString()))
                .thenReturn(URI.create("http://tactical-backend.tenant-ns.svc.cluster.local:8080/api/x"));

        ServerHttpRequest request = MockServerHttpRequest.get("/tools/tactical-rmm/api/x")
                .header(GatewayTenantNamespace.TENANT_NS_HEADER, "acme")
                .build();

        URI uri = resolver.resolveRest(null, request, "/tools");

        assertThat(uri.getHost()).isEqualTo("tactical-backend.acme.svc.cluster.local");
        assertThat(uri.getRawPath()).isEqualTo("/api/x");
    }

    @Test
    void leavesNamespaceUntouchedForSingleTenantPod() {
        when(proxyUrlResolver.resolve(anyString(), anyString(), anyString(), any(), anyString()))
                .thenReturn(URI.create("http://tactical-backend.integrated-tools.svc.cluster.local:8080/api/x"));

        ServerHttpRequest request = MockServerHttpRequest.get("/tools/tactical-rmm/api/x").build();

        URI uri = resolver.resolveRest(null, request, "/tools");

        assertThat(uri.getHost()).isEqualTo("tactical-backend.integrated-tools.svc.cluster.local");
    }
}
