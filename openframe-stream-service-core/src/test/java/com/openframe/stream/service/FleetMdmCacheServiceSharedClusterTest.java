package com.openframe.stream.service;

import com.openframe.data.service.IntegratedToolService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Shared-cluster behavior of {@link FleetMdmCacheService}: there is no deployment TENANT_ID
 * (the field is blank), every lookup must carry the EVENT's resolved tenant, and an event whose
 * tenant could not be resolved must not trigger a doomed header-less call to the shared Fleet
 * (its middleware would 401 it) — the lookup is skipped and the event falls through to the
 * fail-closed drop.
 */
class FleetMdmCacheServiceSharedClusterTest {

    @Test
    @DisplayName("shared cluster + unresolved event tenant -> lookup skipped, no client ever built")
    void unresolvedTenantSkipsLookupInSharedCluster() {
        IntegratedToolService toolService = mock(IntegratedToolService.class);
        ClusterTenantIdResolver resolver = mock(ClusterTenantIdResolver.class);
        FleetMdmCacheService cache = new FleetMdmCacheService(toolService, resolver, null);

        assertThat(cache.getQueryById(9L, null)).isNull();
        assertThat(cache.getPolicyById(5L, "")).isEmpty();
        assertThat(cache.getAgentId(7, null)).isNull();

        // No client construction was attempted: the tool doc (credentials source) was never read.
        verifyNoInteractions(toolService);
    }

    @Test
    @DisplayName("tenant cluster (no resolver) + blank tenant -> falls back to the deployment client path")
    void tenantClusterFallsBackToDeploymentClient() {
        IntegratedToolService toolService = mock(IntegratedToolService.class);
        FleetMdmCacheService cache = new FleetMdmCacheService(toolService, null, null);

        // The deployment-client path consults the tool doc for credentials (absent here -> null
        // result), proving the fallback is taken rather than the shared-cluster skip.
        assertThat(cache.getQueryById(9L, null)).isNull();
        org.mockito.Mockito.verify(toolService).getToolByKey(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    @DisplayName("baseUrlFor: resolver present and answering -> per-tenant URL; null/blank answer or no resolver -> static")
    void baseUrlSelection() {
        IntegratedToolService toolService = mock(IntegratedToolService.class);

        FleetBaseUrlResolver urlResolver = org.mockito.Mockito.mock(FleetBaseUrlResolver.class);
        org.mockito.Mockito.when(urlResolver.resolveBaseUrl("tenant-a"))
                .thenReturn("http://tenant-y0-0.internal.openframe.build/fleet-enrichment");
        org.mockito.Mockito.when(urlResolver.resolveBaseUrl("tenant-unknown")).thenReturn(null);

        FleetMdmCacheService withResolver = new FleetMdmCacheService(toolService, null, urlResolver);
        org.springframework.test.util.ReflectionTestUtils.setField(withResolver, "baseUrl", "http://static:8080");
        assertThat(withResolver.baseUrlFor("tenant-a"))
                .isEqualTo("http://tenant-y0-0.internal.openframe.build/fleet-enrichment");
        assertThat(withResolver.baseUrlFor("tenant-unknown")).isEqualTo("http://static:8080");

        FleetMdmCacheService withoutResolver = new FleetMdmCacheService(toolService, null, null);
        org.springframework.test.util.ReflectionTestUtils.setField(withoutResolver, "baseUrl", "http://static:8080");
        assertThat(withoutResolver.baseUrlFor("tenant-a")).isEqualTo("http://static:8080");
    }
}
