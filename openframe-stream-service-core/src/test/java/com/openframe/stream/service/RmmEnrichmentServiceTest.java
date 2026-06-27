package com.openframe.stream.service;

import com.openframe.data.model.enums.DataEnrichmentServiceType;
import com.openframe.data.model.redis.CachedMachineInfo;
import com.openframe.data.model.redis.CachedOrganizationInfo;
import com.openframe.data.repository.redis.MachineIdCacheService;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RmmEnrichmentServiceTest {

    private static final String MACHINE_ID = "6d925893-702a-4223-b62f-2f80b927cbaa";
    private static final String ORG_ID = "e0521785-8fef-4ec3-b520-f99087ed988e";
    private static final String TENANT_ID = "tenant-1";

    @Mock
    private MachineIdCacheService machineIdCacheService;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private RmmEnrichmentService service;

    @BeforeEach
    void setUp() {
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        // Tenant cluster mode — no ClusterTenantIdResolver bean.
        service = new RmmEnrichmentService(machineIdCacheService, null, tenantIdProvider);
    }

    @Test
    @DisplayName("getType: returns RMM_RESULTS — the routing key that connects MessageType.SCRIPT_EXECUTED to this service")
    void getType_returnsRmmResults() {
        assertThat(service.getType()).isEqualTo(DataEnrichmentServiceType.RMM_RESULTS);
    }

    @Test
    @DisplayName("getExtraParams: happy path — resolves Machine by openframe machineId directly (no ToolConnection), looks up Organization, fills machineId/hostname/organizationId/organizationName/tenantId")
    void getExtraParams_resolvesMachineDirectlyAndPopulatesAllFields() {
        when(machineIdCacheService.getMachineByMachineId(MACHINE_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, "MBP-Oleksandr.lan", ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID))
                .thenReturn(new CachedOrganizationInfo(ORG_ID, "Default"));

        IntegratedToolEnrichedData enriched = service.getExtraParams(message(MACHINE_ID));

        assertThat(enriched.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(enriched.getHostname()).isEqualTo("MBP-Oleksandr.lan");
        assertThat(enriched.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(enriched.getOrganizationName()).isEqualTo("Default");
        assertThat(enriched.getTenantId()).isEqualTo(TENANT_ID);
    }

    @Test
    @DisplayName("getExtraParams: machine NOT in cache → machine/org fields stay null but tenantId is still filled (downstream still has the tenant scope)")
    void getExtraParams_unknownMachine_leavesMachineFieldsNullButFillsTenant() {
        when(machineIdCacheService.getMachineByMachineId(MACHINE_ID)).thenReturn(null);

        IntegratedToolEnrichedData enriched = service.getExtraParams(message(MACHINE_ID));

        assertThat(enriched.getMachineId()).isNull();
        assertThat(enriched.getHostname()).isNull();
        assertThat(enriched.getOrganizationId()).isNull();
        assertThat(enriched.getOrganizationName()).isNull();
        assertThat(enriched.getTenantId()).isEqualTo(TENANT_ID);
    }

    @Test
    @DisplayName("getExtraParams: organization NOT in cache → machineId + hostname still filled, org fields stay null — a stale orphan-org reference doesn't drop the rest of the metadata")
    void getExtraParams_unknownOrganization_keepsMachineFields() {
        when(machineIdCacheService.getMachineByMachineId(MACHINE_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, "MBP-Oleksandr.lan", ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID)).thenReturn(null);

        IntegratedToolEnrichedData enriched = service.getExtraParams(message(MACHINE_ID));

        assertThat(enriched.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(enriched.getHostname()).isEqualTo("MBP-Oleksandr.lan");
        assertThat(enriched.getOrganizationId()).isNull();
        assertThat(enriched.getOrganizationName()).isNull();
        assertThat(enriched.getTenantId()).isEqualTo(TENANT_ID);
    }

    @Test
    @DisplayName("getExtraParams: null agentId on the message short-circuits the Machine lookup — cache is not even consulted, tenant fallback still runs")
    void getExtraParams_nullAgentId_skipsMachineLookup() {
        IntegratedToolEnrichedData enriched = service.getExtraParams(message(null));

        assertThat(enriched.getMachineId()).isNull();
        assertThat(enriched.getHostname()).isNull();
        // Skipped — never touched the cache for machine lookup.
        verifyNoInteractions(machineIdCacheService);
        assertThat(enriched.getTenantId()).isEqualTo(TENANT_ID);
    }

    @Test
    @DisplayName("getExtraParams: null message → returns an empty enrichment object without touching collaborators")
    void getExtraParams_nullMessage_returnsEmpty() {
        IntegratedToolEnrichedData enriched = service.getExtraParams(null);

        assertThat(enriched.getMachineId()).isNull();
        assertThat(enriched.getTenantId()).isNull();
        verifyNoInteractions(machineIdCacheService, tenantIdProvider);
    }

    private static DeserializedDebeziumMessage message(String agentId) {
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setAgentId(agentId);
        return m;
    }
}
