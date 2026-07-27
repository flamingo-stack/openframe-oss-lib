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
        FleetMdmCacheService cache = new FleetMdmCacheService(toolService, resolver);

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
        FleetMdmCacheService cache = new FleetMdmCacheService(toolService, null);

        // The deployment-client path consults the tool doc for credentials (absent here -> null
        // result), proving the fallback is taken rather than the shared-cluster skip.
        assertThat(cache.getQueryById(9L, null)).isNull();
        org.mockito.Mockito.verify(toolService).getToolByKey(org.mockito.ArgumentMatchers.anyString());
    }
}
