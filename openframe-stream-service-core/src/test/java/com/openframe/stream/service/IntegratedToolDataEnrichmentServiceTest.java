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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
    private static final String USER_ID = "technician-1";

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

    @Test
    @DisplayName("getExtraParams: the actor the deserializer set travels to the enriched data")
    void getExtraParams_messageCarriesUserId_userIdEnriched() {
        // setup
        when(machineIdCacheService.getMachine(AGENT_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, HOSTNAME, NICKNAME, ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID))
                .thenReturn(new CachedOrganizationInfo(ORG_ID, "Default"));
        DeserializedDebeziumMessage message = messageWithUser(AGENT_ID, USER_ID);

        // execution
        IntegratedToolEnrichedData enriched = service.getExtraParams(message);

        // verifications
        assertThat(enriched.getUserId()).isEqualTo(USER_ID);
    }

    @Test
    @DisplayName("getExtraParams: a message with an actor still resolves the device from its agent id")
    void getExtraParams_messageCarriesUserId_machineStillResolved() {
        // setup
        when(machineIdCacheService.getMachine(AGENT_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, HOSTNAME, NICKNAME, ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID))
                .thenReturn(new CachedOrganizationInfo(ORG_ID, "Default"));
        DeserializedDebeziumMessage message = messageWithUser(AGENT_ID, USER_ID);

        // execution
        IntegratedToolEnrichedData enriched = service.getExtraParams(message);

        // verifications
        assertThat(enriched.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(enriched.getHostname()).isEqualTo(HOSTNAME);
        assertThat(enriched.getOrganizationId()).isEqualTo(ORG_ID);
    }

    @Test
    @DisplayName("getExtraParams: a tool event without an actor keeps userId null")
    void getExtraParams_messageWithoutUserId_userIdNull() {
        // setup
        when(machineIdCacheService.getMachine(AGENT_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, HOSTNAME, NICKNAME, ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID))
                .thenReturn(new CachedOrganizationInfo(ORG_ID, "Default"));
        DeserializedDebeziumMessage message = message(AGENT_ID);

        // execution
        IntegratedToolEnrichedData enriched = service.getExtraParams(message);

        // verifications
        assertThat(enriched.getUserId()).isNull();
    }

    @Test
    @DisplayName("getExtraParams: the agent lookup misses, the machine id on the message resolves the device")
    void getExtraParams_agentLookupMissesWithMachineId_deviceResolvedByMachineId() {
        // setup
        when(machineIdCacheService.getMachine(AGENT_ID)).thenReturn(null);
        when(machineIdCacheService.getMachineByMachineId(MACHINE_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, HOSTNAME, NICKNAME, ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID))
                .thenReturn(new CachedOrganizationInfo(ORG_ID, "Default"));
        DeserializedDebeziumMessage message = messageWithMachine(AGENT_ID, MACHINE_ID);

        // execution
        IntegratedToolEnrichedData enriched = service.getExtraParams(message);

        // verifications
        assertThat(enriched.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(enriched.getHostname()).isEqualTo(HOSTNAME);
        assertThat(enriched.getOrganizationId()).isEqualTo(ORG_ID);
    }

    @Test
    @DisplayName("getExtraParams: no agent id but a machine id still resolves the device")
    void getExtraParams_noAgentIdWithMachineId_deviceResolvedByMachineId() {
        // setup
        when(machineIdCacheService.getMachineByMachineId(MACHINE_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, HOSTNAME, NICKNAME, ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID))
                .thenReturn(new CachedOrganizationInfo(ORG_ID, "Default"));
        DeserializedDebeziumMessage message = messageWithMachine(null, MACHINE_ID);

        // execution
        IntegratedToolEnrichedData enriched = service.getExtraParams(message);

        // verifications
        assertThat(enriched.getMachineId()).isEqualTo(MACHINE_ID);
    }

    @Test
    @DisplayName("getExtraParams: a machine found by its agent id never triggers the machine id lookup")
    void getExtraParams_agentLookupHits_machineIdLookupSkipped() {
        // setup
        when(machineIdCacheService.getMachine(AGENT_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, HOSTNAME, NICKNAME, ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID))
                .thenReturn(new CachedOrganizationInfo(ORG_ID, "Default"));
        DeserializedDebeziumMessage message = messageWithMachine(AGENT_ID, "another-machine");

        // execution
        IntegratedToolEnrichedData enriched = service.getExtraParams(message);

        // verifications
        assertThat(enriched.getMachineId()).isEqualTo(MACHINE_ID);
        verify(machineIdCacheService, never()).getMachineByMachineId("another-machine");
    }

    @Test
    @DisplayName("getExtraParams: an agent lookup miss without a machine id leaves the device empty")
    void getExtraParams_agentLookupMissesWithoutMachineId_noFallbackLookup() {
        // setup
        when(machineIdCacheService.getMachine(AGENT_ID)).thenReturn(null);
        DeserializedDebeziumMessage message = message(AGENT_ID);

        // execution
        IntegratedToolEnrichedData enriched = service.getExtraParams(message);

        // verifications
        assertThat(enriched.getMachineId()).isNull();
        verify(machineIdCacheService, never()).getMachineByMachineId(anyString());
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

    private static DeserializedDebeziumMessage messageWithUser(String agentId, String userId) {
        DeserializedDebeziumMessage message = message(agentId);
        message.setUserId(userId);
        return message;
    }

    private static DeserializedDebeziumMessage messageWithMachine(String agentId, String machineId) {
        DeserializedDebeziumMessage message = message(agentId);
        message.setMachineId(machineId);
        return message;
    }
}
