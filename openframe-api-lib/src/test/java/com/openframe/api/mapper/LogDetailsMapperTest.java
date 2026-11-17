package com.openframe.api.mapper;

import com.openframe.api.dto.audit.LogDetails;
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
}
