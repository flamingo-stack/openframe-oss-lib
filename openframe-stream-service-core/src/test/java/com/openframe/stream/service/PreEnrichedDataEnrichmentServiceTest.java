package com.openframe.stream.service;

import com.openframe.data.model.enums.DataEnrichmentServiceType;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PreEnrichedDataEnrichmentServiceTest {

    private TenantIdProvider tenantIdProvider;
    private PreEnrichedDataEnrichmentService service;

    @BeforeEach
    void setUp() {
        tenantIdProvider = mock(TenantIdProvider.class);
        service = new PreEnrichedDataEnrichmentService(tenantIdProvider);
    }

    @Test
    void registersAsPreEnrichedType() {
        assertEquals(DataEnrichmentServiceType.PRE_ENRICHED, service.getType());
    }

    @Test
    void passesThroughPreEnrichedFieldsFromMessage() {
        DeserializedDebeziumMessage message = DeserializedDebeziumMessage.builder()
                .tenantId("tenant-1")
                .organizationId("org-uuid-1")
                .organizationName("Acme Org")
                .userId("admin@x.com")
                .build();

        IntegratedToolEnrichedData enriched = service.getExtraParams(message);

        assertEquals("tenant-1", enriched.getTenantId());
        assertEquals("org-uuid-1", enriched.getOrganizationId());
        assertEquals("Acme Org", enriched.getOrganizationName());
        assertEquals("admin@x.com", enriched.getUserId());
    }

    @Test
    void missingTenantFallsBackToTenantIdProvider() {
        when(tenantIdProvider.getTenantId()).thenReturn("provider-tenant");
        DeserializedDebeziumMessage message = DeserializedDebeziumMessage.builder()
                .organizationId("org-uuid-1")
                .build();

        IntegratedToolEnrichedData enriched = service.getExtraParams(message);

        assertEquals("provider-tenant", enriched.getTenantId());
        assertEquals("provider-tenant", message.getTenantId());
    }

    @Test
    void nullMessageYieldsEmptyEnrichment() {
        IntegratedToolEnrichedData enriched = service.getExtraParams(null);

        assertNull(enriched.getTenantId());
        assertNull(enriched.getOrganizationId());
    }
}
