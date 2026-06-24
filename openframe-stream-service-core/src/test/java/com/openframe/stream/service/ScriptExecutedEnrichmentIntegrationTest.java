package com.openframe.stream.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.model.redis.CachedMachineInfo;
import com.openframe.data.model.redis.CachedOrganizationInfo;
import com.openframe.data.repository.redis.MachineIdCacheService;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.deserializer.ScriptResultDeserializer;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Regression test for the broken-LogEvent bug shown on the dashboard:
 * SCRIPT_EXECUTED rows used to come back with {@code deviceId / hostname /
 * organizationId / organizationName = null}. Root cause was that the inbound
 * agentId on RMM result events IS the openframe-native machineId — but the
 * shared enrichment path resolved it through {@code ToolConnection}, which has
 * no entry for native RMM.
 *
 * <p>This test stitches together what the production pipeline does for one
 * SCRIPT_EXECUTED message: {@link ScriptResultDeserializer} parses the inbound
 * Kafka envelope (shape mirrors what {@code RmmResultService} writes), then
 * {@link RmmEnrichmentService} resolves the openframe Machine + Organization
 * directly and fills the four previously-null fields.
 *
 * <p>Sister regression test for {@code COMMAND_EXECUTED} can be added later by
 * swapping the deserializer + MessageType; the fix re-uses the same enrichment
 * service once that MessageType is also routed to {@code RMM_RESULTS}.
 */
@ExtendWith(MockitoExtension.class)
class ScriptExecutedEnrichmentIntegrationTest {

    // Use identifiers from the broken-dashboard screenshot so the test verbally
    // ties to the bug it guards against.
    private static final String MACHINE_ID = "6d925893-702a-4223-b62f-2f80b927cbaa";
    private static final String HOSTNAME = "MBP-Oleksandr.lan";
    private static final String ORG_ID = "e0521785-8fef-4ec3-b520-f99087ed988e";
    private static final String ORG_NAME = "Default";
    private static final String TENANT_ID = "tenant-1";

    @Mock
    private MachineIdCacheService machineIdCacheService;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("regression: a SCRIPT_EXECUTED Kafka message no longer produces null deviceId/hostname/organizationId/organizationName — the four fields the dashboard's LogEvent UI surfaces")
    void scriptExecutedKafkaMessage_yieldsFullyPopulatedEnrichment() {
        // 1. Arrange a Kafka payload shaped exactly like RmmResultService writes it:
        //    payload.after = RmmResultEvent { tenantId, machineId, executionId, ... }.
        CommonDebeziumMessage inbound = inboundScriptResult();

        // 2. Deserialize through the real ScriptResultDeserializer (no mocks here —
        //    we want to lock in that the agentId really IS extracted from machineId).
        // ExecutionRepository mock — this test focuses on agentId extraction + enrichment,
        // not on getMessage formatting; deserializer is invoked with the mock present.
        ScriptResultDeserializer deserializer = new ScriptResultDeserializer(mapper,
                org.mockito.Mockito.mock(com.openframe.data.repository.rmm.ExecutionRepository.class));
        DeserializedDebeziumMessage deserialized = deserializer.deserialize(inbound, MessageType.SCRIPT_EXECUTED);
        assertThat(deserialized.getAgentId())
                .as("ScriptResultDeserializer must use machineId as agentId — that's the key the new enrichment looks up")
                .isEqualTo(MACHINE_ID);

        // 3. Stub the Mongo/Redis-backed lookups; real cache layer is irrelevant here.
        when(machineIdCacheService.getMachineByMachineId(MACHINE_ID))
                .thenReturn(new CachedMachineInfo(MACHINE_ID, HOSTNAME, ORG_ID));
        when(machineIdCacheService.getOrganization(ORG_ID))
                .thenReturn(new CachedOrganizationInfo(ORG_ID, ORG_NAME));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);

        // 4. Enrich via the new direct-Machine-lookup service (Option C path).
        RmmEnrichmentService enrichmentService =
                new RmmEnrichmentService(machineIdCacheService, null, tenantIdProvider);
        IntegratedToolEnrichedData enriched = enrichmentService.getExtraParams(deserialized);

        // 5. The four dashboard-visible fields must ALL be non-null — that's the
        //    whole point of this fix. Asserted by-name so a future regression
        //    that drops any one of them fails with a specific signal.
        assertThat(enriched.getMachineId())
                .as("deviceId on the LogEvent (dashboard column)")
                .isEqualTo(MACHINE_ID);
        assertThat(enriched.getHostname())
                .as("hostname on the LogEvent")
                .isEqualTo(HOSTNAME);
        assertThat(enriched.getOrganizationId())
                .as("organizationId on the LogEvent")
                .isEqualTo(ORG_ID);
        assertThat(enriched.getOrganizationName())
                .as("organizationName on the LogEvent")
                .isEqualTo(ORG_NAME);
        assertThat(enriched.getTenantId()).isEqualTo(TENANT_ID);
    }

    /**
     * Builds the inbound Kafka envelope produced by {@code RmmResultService}:
     * {@code CommonDebeziumMessage { payload: { after: RmmResultEvent, op: "c", ts_ms } }}.
     */
    private CommonDebeziumMessage inboundScriptResult() {
        ObjectNode after = mapper.createObjectNode();
        after.put("tenantId", TENANT_ID);
        after.put("machineId", MACHINE_ID);
        after.put("executionId", "exec-script-1");
        after.put("stdout", "");
        after.put("stderr", "");
        after.put("exitCode", 1);
        after.put("executionTimeMs", 42L);
        after.put("timedOut", false);
        after.put("eventTimestamp", 1_750_000_000_000L);

        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);
        payload.setOperation("c");
        payload.setTimestamp(1_750_000_000_000L);

        CommonDebeziumMessage envelope = new CommonDebeziumMessage();
        envelope.setPayload(payload);
        return envelope;
    }
}
