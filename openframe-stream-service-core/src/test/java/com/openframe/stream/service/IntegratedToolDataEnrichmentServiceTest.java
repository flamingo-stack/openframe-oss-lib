package com.openframe.stream.service;

import com.openframe.data.model.enums.DataEnrichmentServiceType;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.redis.CachedMachineInfo;
import com.openframe.data.model.redis.CachedOrganizationInfo;
import com.openframe.data.repository.redis.MachineIdCacheService;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.kafka.model.debezium.DebeziumMessage;
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
import static org.mockito.Mockito.when;

/**
 * Enrichment for the external-tool path (Fleet MDM and MeshCentral) — by volume the main
 * producer of log events. Nickname must travel alongside hostname, never replace it.
 */
@ExtendWith(MockitoExtension.class)
class IntegratedToolDataEnrichmentServiceTest {

    private static final String AGENT_ID = "fleet-host-4417";
    private static final String MACHINE_ID = "6d925893-702a-4223-b62f-2f80b927cbaa";
    private static final String ORG_ID = "e0521785-8fef-4ec3-b520-f99087ed988e";
    private static final String TENANT_ID = "tenant-1";
    private static final String HOSTNAME = "MBP-Oleksandr.lan";
    private static final String NICKNAME = "Reception iMac";

    @Mock
    private MachineIdCacheService machineIdCacheService;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private IntegratedToolDataEnrichmentService service;

    @BeforeEach
    void setUp() {
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        // Tenant cluster mode — no ClusterTenantIdResolver bean.
        service = new IntegratedToolDataEnrichmentService(machineIdCacheService, null, tenantIdProvider);
    }

    private static DeserializedDebeziumMessage message(String agentId) {
        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation("c");
        return DeserializedDebeziumMessage.builder()
                .payload(payload)
                .agentId(agentId)
                .integratedToolType(IntegratedToolType.FLEET)
                .build();
    }

    @Test
    @DisplayName("getType: returns INTEGRATED_TOOLS_EVENTS — the routing key for Fleet and MeshCentral")
    void getType_returnsIntegratedToolsEvents() {
        assertThat(service.getType()).isEqualTo(DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS);
    }

    @Test
    @DisplayName("getExtraParams: nickname is carried alongside hostname, not instead of it")
    void getExtraParams_carriesNicknameAlongsideHostname() {
        when(machineIdCacheService.getMachine(AGENT_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, HOSTNAME, NICKNAME, ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID))
                .thenReturn(new CachedOrganizationInfo(ORG_ID, "Default"));

        IntegratedToolEnrichedData enriched = service.getExtraParams(message(AGENT_ID));

        assertThat(enriched.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(enriched.getHostname()).isEqualTo(HOSTNAME);
        assertThat(enriched.getNickname()).isEqualTo(NICKNAME);
        assertThat(enriched.getOrganizationId()).isEqualTo(ORG_ID);
        assertThat(enriched.getTenantId()).isEqualTo(TENANT_ID);
    }

    @Test
    @DisplayName("getExtraParams: machine without a nickname leaves nickname null and keeps the hostname")
    void getExtraParams_noNickname_leavesNicknameNull() {
        when(machineIdCacheService.getMachine(AGENT_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, HOSTNAME, null, ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID))
                .thenReturn(new CachedOrganizationInfo(ORG_ID, "Default"));

        IntegratedToolEnrichedData enriched = service.getExtraParams(message(AGENT_ID));

        assertThat(enriched.getHostname()).isEqualTo(HOSTNAME);
        assertThat(enriched.getNickname()).isNull();
    }

    @Test
    @DisplayName("getExtraParams: unknown machine leaves both name fields null but still resolves the tenant")
    void getExtraParams_unknownMachine_leavesNameFieldsNull() {
        when(machineIdCacheService.getMachine(AGENT_ID)).thenReturn(null);

        IntegratedToolEnrichedData enriched = service.getExtraParams(message(AGENT_ID));

        assertThat(enriched.getHostname()).isNull();
        assertThat(enriched.getNickname()).isNull();
        assertThat(enriched.getTenantId()).isEqualTo(TENANT_ID);
    }
}
