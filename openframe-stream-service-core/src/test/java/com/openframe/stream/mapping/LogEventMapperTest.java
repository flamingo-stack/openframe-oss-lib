package com.openframe.stream.mapping;

import com.openframe.data.model.enums.UnifiedEventType;
import com.openframe.data.loki.toolevent.LokiLogEvent;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.IntegratedToolEvent;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mapstruct.factory.Mappers;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class LogEventMapperTest {

    private final LogEventMapper mapper = Mappers.getMapper(LogEventMapper.class);

    @Test
    void toLokiLogEvent_eventWithEnrichment_mapsEveryField() {
        LokiLogEvent entry = mapper.toLokiLogEvent(event("Login from 10.0.0.1"), enriched());

        assertThat(entry).isEqualTo(LokiLogEvent.builder()
                .tenantId("tenant-event")
                .toolType("FLEET")
                .eventType("LOGIN_FAILED")
                .toolEventId("evt-1")
                .ingestDay("2026-10-01")
                .eventTimestamp(1_790_848_800_123L)
                .severity("WARNING")
                .message("Login from 10.0.0.1")
                .details("{\"ip\":\"10.0.0.1\"}")
                .userId("user-enriched")
                .deviceId("machine-enriched")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-enriched")
                .organizationName("Acme")
                .build());
    }

    @Test
    void toIntegratedToolEvent_eventWithEnrichment_mapsEveryField() {
        IntegratedToolEvent listEvent = mapper.toIntegratedToolEvent(event("Login from 10.0.0.1"), enriched());

        IntegratedToolEvent expected = new IntegratedToolEvent();
        expected.setTenantId("tenant-enriched");
        expected.setToolEventId("evt-1");
        expected.setUserId("user-enriched");
        expected.setDeviceId("machine-enriched");
        expected.setHostname("host-7");
        expected.setNickname("Reception iMac");
        expected.setExecutionSource("MANUAL");
        expected.setScriptCreationSource("AI_ASSISTANT");
        expected.setOrganizationId("org-enriched");
        expected.setOrganizationName("Acme");
        expected.setIngestDay("2026-10-01");
        expected.setToolType("FLEET");
        expected.setEventType("LOGIN_FAILED");
        expected.setSeverity("WARNING");
        expected.setSummary("Login from 10.0.0.1");
        expected.setEventTimestamp(1_790_848_800_123L);
        assertThat(listEvent).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = "  ")
    void toLokiLogEvent_noMessage_usesTheEventTypeSummary(String message) {
        LokiLogEvent entry = mapper.toLokiLogEvent(event(message), enriched());

        assertThat(entry.getMessage()).isEqualTo("Failed login attempt");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = "  ")
    void toIntegratedToolEvent_noMessage_usesTheEventTypeSummary(String message) {
        IntegratedToolEvent listEvent = mapper.toIntegratedToolEvent(event(message), enriched());

        assertThat(listEvent.getSummary()).isEqualTo("Failed login attempt");
    }

    private static DeserializedDebeziumMessage event(String message) {
        return DeserializedDebeziumMessage.builder()
                .unifiedEventType(UnifiedEventType.LOGIN_FAILED)
                .integratedToolType(IntegratedToolType.FLEET)
                .ingestDay("2026-10-01")
                .toolEventId("evt-1")
                .eventTimestamp(1_790_848_800_123L)
                .message(message)
                .debeziumMessage("{\"op\":\"c\"}")
                .details("{\"ip\":\"10.0.0.1\"}")
                .tenantId("tenant-event")
                .userId("user-event")
                .machineId("machine-event")
                .organizationId("org-event")
                .organizationName("Org from the event")
                .build();
    }

    private static IntegratedToolEnrichedData enriched() {
        return IntegratedToolEnrichedData.builder()
                .tenantId("tenant-enriched")
                .userId("user-enriched")
                .machineId("machine-enriched")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-enriched")
                .organizationName("Acme")
                .build();
    }
}
