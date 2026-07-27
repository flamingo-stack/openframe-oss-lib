package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.stream.service.ClusterTenantIdResolver;
import com.openframe.stream.service.FleetMdmCacheService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Fleet shared-DB multitenancy: the CDC rows' stamped {@code team_id} is the tenant
 * discriminator. Verifies (1) every Fleet deserializer surfaces it via {@code getTenantId} for
 * the shared cluster's resolver, and (2) the Fleet API enrichment lookups carry the EVENT's
 * resolved tenant (the shared Fleet's fences 404 lookups made under the wrong tenant).
 */
class FleetCdcTeamTenantTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private ObjectNode after() {
        return mapper.createObjectNode();
    }

    @Test
    @DisplayName("all Fleet deserializers expose the stamped team_id as the tenant discriminator; NULL/missing → empty")
    void teamIdSurfacesAsTenantDiscriminator() {
        FleetEventDeserializer activity = new FleetEventDeserializer(mapper);
        FleetQueryResultEventDeserializer queryResult =
                new FleetQueryResultEventDeserializer(mapper, mock(FleetMdmCacheService.class), null);
        FleetPolicyMembershipEventDeserializer membership =
                new FleetPolicyMembershipEventDeserializer(mapper, mock(FleetMdmCacheService.class), null);

        ObjectNode stamped = after().put("id", 10).put("host_id", 7).put("team_id", 42);
        assertThat(activity.getTenantId(stamped)).contains("42");
        assertThat(queryResult.getTenantId(stamped)).contains("42");
        assertThat(membership.getTenantId(stamped)).contains("42");

        // Flag-off / pre-stamping rows: no team_id, or an explicit NULL.
        assertThat(activity.getTenantId(after().put("id", 10))).isEmpty();
        assertThat(queryResult.getTenantId(after().putNull("team_id"))).isEmpty();
        assertThat(membership.getTenantId(null)).isEmpty();
    }

    @Test
    @DisplayName("policy lookup carries the event's resolved tenant when a cluster resolver is present")
    void policyLookupCarriesEventTenant() {
        FleetMdmCacheService cache = mock(FleetMdmCacheService.class);
        ClusterTenantIdResolver resolver = mock(ClusterTenantIdResolver.class);
        when(resolver.resolveTenantId(IntegratedToolType.FLEET, "42")).thenReturn("tenant-a");
        when(cache.getPolicyById(eq(5L), eq("tenant-a"))).thenReturn(Optional.empty());

        FleetPolicyMembershipEventDeserializer membership =
                new FleetPolicyMembershipEventDeserializer(mapper, cache, resolver);
        ObjectNode after = after().put("policy_id", 5).put("host_id", 7).put("team_id", 42).put("passes", true);

        assertThat(membership.getMessage(after)).contains("Policy membership check passed");
        verify(cache).getPolicyById(5L, "tenant-a");
    }

    @Test
    @DisplayName("query lookup carries the event's resolved tenant; without a resolver (tenant cluster) it passes null")
    void queryLookupCarriesEventTenant() {
        FleetMdmCacheService cache = mock(FleetMdmCacheService.class);
        ClusterTenantIdResolver resolver = mock(ClusterTenantIdResolver.class);
        when(resolver.resolveTenantId(IntegratedToolType.FLEET, "42")).thenReturn("tenant-a");
        when(cache.getQueryById(eq(9L), eq("tenant-a"))).thenReturn(null);

        FleetQueryResultEventDeserializer queryResult = new FleetQueryResultEventDeserializer(mapper, cache, resolver);
        ObjectNode after = after().put("id", 1).put("query_id", 9).put("host_id", 7).put("team_id", 42);
        queryResult.getMessage(after);
        verify(cache).getQueryById(9L, "tenant-a");

        // Tenant cluster: no resolver bean → the deployment client (null event tenant) is used.
        FleetMdmCacheService tenantCache = mock(FleetMdmCacheService.class);
        FleetQueryResultEventDeserializer tenantMode = new FleetQueryResultEventDeserializer(mapper, tenantCache, null);
        tenantMode.getMessage(after);
        verify(tenantCache).getQueryById(9L, null);
    }
}
