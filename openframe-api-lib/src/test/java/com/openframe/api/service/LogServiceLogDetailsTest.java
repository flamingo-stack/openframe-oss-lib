package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.toolevent.ToolEventLog;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.pinot.repository.PinotLogRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.OngoingStubbing;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LogServiceLogDetailsTest {

    private static final Instant TIMESTAMP = Instant.parse("2026-10-01T10:00:00.123Z");

    @Mock
    private PinotLogRepository pinotLogRepository;

    @Mock
    private ToolEventLogRepository toolEventLogRepository;

    @Mock
    private TenantIdProvider tenantIdProvider;

    @InjectMocks
    private LogService service;

    @Test
    void findLogDetails_eventStoredForTheCallersTenant_mapsEveryFieldOfTheStoredEvent() {
        whenLookedUpForTheCallersTenant().thenReturn(Optional.of(ToolEventLog.builder()
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
                .build()));

        Optional<LogDetails> details = service.findLogDetails("FLEET", "LOGIN", TIMESTAMP, "evt-1");

        assertThat(details).contains(LogDetails.builder()
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
    void findLogDetails_nothingStored_returnsEmpty() {
        whenLookedUpForTheCallersTenant().thenReturn(Optional.empty());

        Optional<LogDetails> details = service.findLogDetails("FLEET", "LOGIN", TIMESTAMP, "evt-1");

        assertThat(details).isEmpty();
    }

    @Test
    void findLogDetails_lokiFails_letsTheQueryFailureThrough() {
        LokiQueryException failure = new LokiQueryException("Loki query failed: connection refused");
        whenLookedUpForTheCallersTenant().thenThrow(failure);

        assertThatThrownBy(() -> service.findLogDetails("FLEET", "LOGIN", TIMESTAMP, "evt-1"))
                .isSameAs(failure);
    }

    private OngoingStubbing<Optional<ToolEventLog>> whenLookedUpForTheCallersTenant() {
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-a");
        return when(toolEventLogRepository.find("tenant-a", "FLEET", "LOGIN", TIMESTAMP, "evt-1"));
    }
}
