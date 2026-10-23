package com.openframe.api.mapper;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.data.cassandra.model.CassandraLogEvent;
import com.openframe.data.loki.toolevent.LokiLogEvent;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class LogDetailsMapperTest {

    private final LogDetailsMapper mapper = Mappers.getMapper(LogDetailsMapper.class);

    @Test
    void toLogDetails_lokiEvent_mapsEveryFieldOfTheStoredEvent() {
        LokiLogEvent stored = LokiLogEvent.builder()
                .tenantId("tenant-a")
                .toolType("RMM")
                .eventType("SCRIPT_EXECUTED")
                .toolEventId("evt-stored")
                .ingestDay("2026-10-01")
                .eventTimestamp(1_790_848_800_456L)
                .severity("WARNING")
                .message("User logged in")
                .details("{\"ip\":\"10.0.0.1\"}")
                .userId("user-7")
                .deviceId("device-7")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-7")
                .organizationName("Acme")
                .build();

        LogDetails details = mapper.toLogDetails(stored);

        assertThat(details).isEqualTo(LogDetails.builder()
                .id("1790848800456_evt-stored")
                .toolEventId("evt-stored")
                .eventType("SCRIPT_EXECUTED")
                .ingestDay("2026-10-01")
                .toolType("RMM")
                .severity("WARNING")
                .userId("user-7")
                .deviceId("device-7")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-7")
                .organizationName("Acme")
                .summary("User logged in")
                .timestamp(Instant.parse("2026-10-01T10:00:00.456Z"))
                .message("User logged in")
                .details("{\"ip\":\"10.0.0.1\"}")
                .build());
    }

    @Test
    void toLogDetails_cassandraRow_mapsEveryFieldOfTheStoredRow() {
        CassandraLogEvent.CassandraLogEventKey key = new CassandraLogEvent.CassandraLogEventKey();
        key.setIngestDay("2026-10-01");
        key.setToolType("FLEET");
        key.setTenantId("tenant-a");
        key.setEventType("LOGIN");
        key.setEventTimestamp(Instant.parse("2026-10-01T10:00:00.123Z"));
        key.setToolEventId("evt-1");
        CassandraLogEvent stored = new CassandraLogEvent();
        stored.setKey(key);
        stored.setSeverity("WARNING");
        stored.setMessage("User logged in");
        stored.setDetails("{\"ip\":\"10.0.0.1\"}");
        stored.setDebeziumMessage("{\"op\":\"c\"}");
        stored.setUserId("user-7");
        stored.setDeviceId("device-7");
        stored.setHostname("host-7");
        stored.setNickname("Reception iMac");
        stored.setExecutionSource("MANUAL");
        stored.setScriptCreationSource("AI_ASSISTANT");
        stored.setOrganizationId("org-7");
        stored.setOrganizationName("Acme");

        LogDetails details = mapper.toLogDetails(stored);

        assertThat(details).isEqualTo(LogDetails.builder()
                .id("1790848800123_evt-1")
                .toolEventId("evt-1")
                .eventType("LOGIN")
                .ingestDay("2026-10-01")
                .toolType("FLEET")
                .severity("WARNING")
                .userId("user-7")
                .deviceId("device-7")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-7")
                .organizationName("Acme")
                .summary("User logged in")
                .timestamp(Instant.parse("2026-10-01T10:00:00.123Z"))
                .message("User logged in")
                .details("{\"ip\":\"10.0.0.1\"}")
                .build());
    }
}
