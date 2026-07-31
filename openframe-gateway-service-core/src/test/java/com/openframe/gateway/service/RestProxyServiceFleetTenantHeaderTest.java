package com.openframe.gateway.service;

import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.gateway.config.prop.FleetMultiTenancyProperties;
import com.openframe.gateway.upstream.ToolUpstreamResolverRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class RestProxyServiceFleetTenantHeaderTest {

    private static final String FLEET = "fleetmdm-server";
    private static final String OTHER_TOOL = "tactical-rmm";
    private static final String TENANT_ID_HEADER = "X-Tenant-Id";
    private static final String TENANT_ID = "3f2c9a1e-tenant";

    private RestProxyService service(boolean multiTenancyEnabled) {
        FleetMultiTenancyProperties props = new FleetMultiTenancyProperties();
        props.setEnabled(multiTenancyEnabled);
        props.setAllowedEndpoints(List.of("GET /api/{v}/fleet/hosts"));
        return new RestProxyService(
                mock(ReactiveIntegratedToolRepository.class),
                mock(ToolUpstreamResolverRegistry.class),
                mock(ToolApiKeyHeadersResolver.class),
                new FleetEndpointAllowlist(props));
    }

    private ServerHttpRequest request(String tenantId) {
        MockServerHttpRequest.BaseBuilder<?> builder =
                MockServerHttpRequest.get("/tools/" + FLEET + "/api/latest/fleet/hosts");
        if (tenantId != null) {
            builder.header(TENANT_ID_HEADER, tenantId);
        }
        return builder.build();
    }

    @Test
    void addsTenantHeaderForFleet() {
        Map<String, String> headers = new HashMap<>();

        service(true).addFleetTenantHeader(headers, FLEET, request(TENANT_ID));

        assertThat(headers).containsEntry(TENANT_ID_HEADER, TENANT_ID);
    }

    /** Deliberately not gated by the multi-tenancy flag — a flag-off Fleet ignores the header. */
    @Test
    void addsTenantHeaderForFleetEvenWhenMultiTenancyDisabled() {
        Map<String, String> headers = new HashMap<>();

        service(false).addFleetTenantHeader(headers, FLEET, request(TENANT_ID));

        assertThat(headers).containsEntry(TENANT_ID_HEADER, TENANT_ID);
    }

    @Test
    void neverAddsTenantHeaderForOtherTools() {
        Map<String, String> headers = new HashMap<>();

        service(true).addFleetTenantHeader(headers, OTHER_TOOL, request(TENANT_ID));

        assertThat(headers).doesNotContainKey(TENANT_ID_HEADER);
    }

    @Test
    void doesNotAddBlankHeaderWhenRequestCarriesNoTenantId() {
        Map<String, String> headers = new HashMap<>();

        service(true).addFleetTenantHeader(headers, FLEET, request(null));

        assertThat(headers).doesNotContainKey(TENANT_ID_HEADER);
    }
}
