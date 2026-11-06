package com.openframe.stream.handler.software;

import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.stream.service.FleetBaseUrlResolver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetHostSoftwareCacheTest {

    @Mock private IntegratedToolRepository integratedToolRepository;
    @Mock private FleetBaseUrlResolver fleetBaseUrlResolver;

    // the Fleet base URL must come from the per-tenant resolver on the shared plane, never from the tool's own
    // apiUrl (the tenant cluster's fleet-service address, which does not resolve there) — regression guard for the
    // shared-plane UnresolvedAddressException incident.
    @Test
    @DisplayName("shared plane: the per-tenant resolver supplies the Fleet base URL")
    void sharedPlane_usesResolver() {
        FleetHostSoftwareCache cache = new FleetHostSoftwareCache(integratedToolRepository, fleetBaseUrlResolver);
        ReflectionTestUtils.setField(cache, "baseUrl", "http://static-fallback:8080");
        when(fleetBaseUrlResolver.resolveBaseUrl("t-1")).thenReturn("https://fleet.tenant-1.example:443");

        assertThat(cache.baseUrlFor("t-1")).isEqualTo("https://fleet.tenant-1.example:443");
    }

    @Test
    @DisplayName("shared plane with no per-tenant URL: falls back to the static base url")
    void sharedPlane_blankResolution_fallsBackToStatic() {
        FleetHostSoftwareCache cache = new FleetHostSoftwareCache(integratedToolRepository, fleetBaseUrlResolver);
        ReflectionTestUtils.setField(cache, "baseUrl", "http://static-fallback:8080");
        when(fleetBaseUrlResolver.resolveBaseUrl("t-1")).thenReturn("");

        assertThat(cache.baseUrlFor("t-1")).isEqualTo("http://static-fallback:8080");
    }

    @Test
    @DisplayName("tenant cluster: no resolver bean, so the static fleet.mdm.base-url is used")
    void tenantCluster_noResolver_usesStatic() {
        FleetHostSoftwareCache cache = new FleetHostSoftwareCache(integratedToolRepository, null);
        ReflectionTestUtils.setField(cache, "baseUrl", "http://fleet-service.platform.svc.cluster.local:8080");

        assertThat(cache.baseUrlFor("t-1")).isEqualTo("http://fleet-service.platform.svc.cluster.local:8080");
    }
}
