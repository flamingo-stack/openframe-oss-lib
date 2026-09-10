package com.openframe.stream.service;

import com.openframe.data.service.IntegratedToolService;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * How the enrichment reacts to a failing Fleet call now that the SDK reports failures as unchecked
 * {@link FleetMdmException}: a transport failure degrades to "not enriched", while an API status
 * (401 and friends) keeps travelling up — a wrong or missing token must not be silently turned into
 * a stream of unenriched events.
 */
class FleetMdmCacheServiceFailureTest {

    private static final String TENANT = "tenant-a";

    @SuppressWarnings("unchecked")
    private FleetMdmCacheService cacheWith(FleetMdmClient client) {
        FleetMdmCacheService cache = new FleetMdmCacheService(mock(IntegratedToolService.class), null, null);
        ReflectionTestUtils.setField(cache, "baseUrl", "http://fleet-service:8080");
        Map<String, FleetMdmClient> byTenant =
                (Map<String, FleetMdmClient>) ReflectionTestUtils.getField(cache, "clientByTenant");
        byTenant.put(TENANT, client);
        return cache;
    }

    @Test
    @DisplayName("transport failure -> no enrichment value, event still flows")
    void wrappedFailureDegradesToNoValue() {
        FleetMdmClient client = mock(FleetMdmClient.class);
        FleetMdmException boom = new FleetMdmException("Failed to fetch Fleet query 9", new RuntimeException("boom"));
        when(client.getQueryById(9L)).thenThrow(boom);
        when(client.getPolicyById(5L)).thenThrow(boom);
        when(client.getHostById(7L)).thenThrow(boom);

        FleetMdmCacheService cache = cacheWith(client);

        assertThat(cache.getQueryById(9L, TENANT)).isNull();
        assertThat(cache.getPolicyById(5L, TENANT)).isEmpty();
        assertThat(cache.getAgentId(7, TENANT)).isNull();
    }

    @Test
    @DisplayName("interrupted call -> no enrichment value, and the flag the SDK re-armed is left alone")
    void interruptedCallDegradesToNoValueAndKeepsTheFlag() {
        FleetMdmClient client = mock(FleetMdmClient.class);
        when(client.getQueryById(9L)).thenAnswer(invocation -> {
            Thread.currentThread().interrupt();
            throw new FleetMdmException("Interrupted while trying to fetch Fleet query 9",
                    new InterruptedException("shutting down"));
        });

        try {
            assertThat(cacheWith(client).getQueryById(9L, TENANT)).isNull();
            assertThat(Thread.currentThread().isInterrupted())
                    .as("the enrichment must not clear the shutdown signal the SDK re-armed")
                    .isTrue();
        } finally {
            Thread.interrupted();
        }
    }

    @Test
    @DisplayName("API status (401) -> propagated, not swallowed into a null enrichment")
    void apiStatusIsNotSwallowed() {
        FleetMdmClient client = mock(FleetMdmClient.class);
        FleetMdmApiException unauthorized =
                new FleetMdmApiException("Authentication failed. Please check your API token.", 401, "{}");
        when(client.getQueryById(9L)).thenThrow(unauthorized);
        when(client.getPolicyById(5L)).thenThrow(unauthorized);
        when(client.getHostById(7L)).thenThrow(unauthorized);

        FleetMdmCacheService cache = cacheWith(client);

        assertThatThrownBy(() -> cache.getQueryById(9L, TENANT)).isSameAs(unauthorized);
        assertThatThrownBy(() -> cache.getPolicyById(5L, TENANT)).isSameAs(unauthorized);
        assertThatThrownBy(() -> cache.getAgentId(7, TENANT)).isSameAs(unauthorized);
    }
}
