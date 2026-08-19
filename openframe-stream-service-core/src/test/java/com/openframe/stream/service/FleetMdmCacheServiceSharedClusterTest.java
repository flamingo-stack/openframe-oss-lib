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
        // fleet.mdm.base-url is optional now; the deployment-client path needs it configured.
        org.springframework.test.util.ReflectionTestUtils.setField(cache, "baseUrl", "http://fleet-service:8080");

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

    @Test
    @DisplayName("fail closed: resolver has no answer and no static base url -> baseUrlFor null, lookup skipped")
    void failsClosedWithoutAnyBaseUrl() {
        IntegratedToolService toolService = mock(IntegratedToolService.class);
        FleetBaseUrlResolver urlResolver = org.mockito.Mockito.mock(FleetBaseUrlResolver.class);
        org.mockito.Mockito.when(urlResolver.resolveBaseUrl("tenant-x")).thenReturn(null);

        // Blank fleet.mdm.base-url (the property is optional): no fallback exists.
        FleetMdmCacheService cache = new FleetMdmCacheService(toolService, null, urlResolver);
        org.springframework.test.util.ReflectionTestUtils.setField(cache, "baseUrl", "");

        assertThat(cache.baseUrlFor("tenant-x")).isNull();
        // The per-tenant lookup is skipped outright: no client is built, credentials never read.
        assertThat(cache.getQueryById(3L, "tenant-x")).isNull();
        verifyNoInteractions(toolService);
    }

    @Test
    @DisplayName("no resolver + blank fleet.mdm.base-url -> refuses to start (URL unobtainable)")
    void requiresBaseUrlWithoutUrlResolver() {
        // Per-tenant cluster: the static property is the only way to reach Fleet.
        FleetMdmCacheService tenantPlane = new FleetMdmCacheService(mock(IntegratedToolService.class), null, null);
        org.springframework.test.util.ReflectionTestUtils.setField(tenantPlane, "baseUrl", "");
        org.assertj.core.api.Assertions.assertThatThrownBy(tenantPlane::validateTenantConfig)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("fleet.mdm.base-url");

        // Shared cluster with its URL resolver switched off (flag disabled): same verdict — the
        // check is plane-agnostic so this cannot degrade silently.
        FleetMdmCacheService sharedNoUrlResolver = new FleetMdmCacheService(
                mock(IntegratedToolService.class), mock(ClusterTenantIdResolver.class), null);
        org.springframework.test.util.ReflectionTestUtils.setField(sharedNoUrlResolver, "baseUrl", "");
        org.assertj.core.api.Assertions.assertThatThrownBy(sharedNoUrlResolver::validateTenantConfig)
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("FleetBaseUrlResolver present -> blank fleet.mdm.base-url is fine (URL comes per tenant)")
    void urlResolverMakesBaseUrlOptional() {
        FleetMdmCacheService cache = new FleetMdmCacheService(
                mock(IntegratedToolService.class),
                mock(ClusterTenantIdResolver.class),
                org.mockito.Mockito.mock(FleetBaseUrlResolver.class));
        org.springframework.test.util.ReflectionTestUtils.setField(cache, "baseUrl", "");

        cache.validateTenantConfig();
    }
}
