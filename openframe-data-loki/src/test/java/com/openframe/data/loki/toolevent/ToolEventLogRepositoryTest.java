package com.openframe.data.loki.toolevent;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.client.LokiQueryRejectedException;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.OngoingStubbing;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolEventLogRepositoryTest {

    private static final long EVENT_MILLIS = 1_790_848_800_123L;
    private static final long EVENT_NANOS = 1_790_848_800_123_000_000L;
    private static final long NEXT_MILLI_NANOS = 1_790_848_800_124_000_000L;
    private static final Instant LAST_NANO_OF_THE_EVENT_MILLI = Instant.parse("2026-10-01T10:00:00.123999999Z");
    private static final Map<String, String> LABELS =
            Map.of("job", "tool-events", "tenant_id", "tenant-a", "tool_type", "FLEET");
    private static final Map<String, String> METADATA = Map.of("tool_event_id", "evt-1", "event_type", "LOGIN");
    private static final String QUERY =
            "{job=\"tool-events\", tenant_id=\"tenant-a\", tool_type=\"FLEET\"} | tool_event_id=\"evt-1\" | event_type=\"LOGIN\"";
    private static final String FULL_LINE = """
            {"tenantId":"tenant-a","toolType":"FLEET","eventType":"LOGIN","toolEventId":"evt-1",\
            "ingestDay":"2026-10-01","eventTimestamp":1790848800123,"severity":"INFO","message":"User logged in",\
            "details":"{\\"ip\\":\\"10.0.0.1\\"}","userId":"user-7","deviceId":"device-7","hostname":"host-7",\
            "nickname":"Reception iMac","executionSource":"MANUAL","scriptCreationSource":"AI_ASSISTANT",\
            "organizationId":"org-7","organizationName":"Acme"}""";

    @Mock
    private LokiClient lokiClient;

    @InjectMocks
    private ToolEventLogRepository repository;

    @Test
    void save_event_pushesItUnderItsTenantAndToolAtTheEventTime() {
        repository.save(fullEvent());

        verify(lokiClient).push(LABELS, EVENT_NANOS, FULL_LINE, METADATA);
    }

    @Test
    void toLine_everyFieldSet_writesThemAllInAFixedOrder() {
        assertThat(repository.toLine(fullEvent())).isEqualTo(FULL_LINE);
    }

    @Test
    void toLine_optionalFieldsNull_leavesThemOut() {
        ToolEventLog event = ToolEventLog.builder()
                .tenantId("tenant-a")
                .toolType("FLEET")
                .eventType("LOGIN")
                .toolEventId("evt-1")
                .eventTimestamp(EVENT_MILLIS)
                .build();

        assertThat(repository.toLine(event)).isEqualTo("{\"tenantId\":\"tenant-a\",\"toolType\":\"FLEET\","
                + "\"eventType\":\"LOGIN\",\"toolEventId\":\"evt-1\",\"eventTimestamp\":1790848800123}");
    }

    @Test
    void toLine_eventFieldCannotBeRead_throwsIllegalStateWithTheWritingCause() {
        ToolEventLog unreadable = new ToolEventLog() {
            @Override
            public String getDetails() {
                throw new UnsupportedOperationException("details unavailable");
            }
        };

        assertThatThrownBy(() -> repository.toLine(unreadable))
                .isExactlyInstanceOf(IllegalStateException.class)
                .hasMessage("Tool event log cannot be written as a Loki line")
                .hasCauseInstanceOf(JsonProcessingException.class);
    }

    @Test
    void find_storedEvent_asksForExactlyThatTenantToolTypeIdAndMillisecond() {
        whenLookedUp().thenReturn(List.of(new LokiLogEntry(EVENT_NANOS, FULL_LINE, Map.of())));

        Optional<ToolEventLog> found = find();

        assertThat(found).contains(fullEvent());
    }

    @Test
    void find_valuesWithQuotesBracesAndBackslashes_keepsEachInsideItsOwnLiteral() {
        repository.find("a\"b", "FLEET\"} or {tenant_id=~\".+", "LOGIN\" | drop", LAST_NANO_OF_THE_EVENT_MILLI,
                "evt\\\" or tool_event_id=~\".+");

        verify(lokiClient).queryRange(
                "{job=\"tool-events\", tenant_id=\"a\\\"b\", tool_type=\"FLEET\\\"} or {tenant_id=~\\\".+\"}"
                        + " | tool_event_id=\"evt\\\\\\\" or tool_event_id=~\\\".+\""
                        + " | event_type=\"LOGIN\\\" | drop\"",
                EVENT_NANOS, NEXT_MILLI_NANOS, 1, LokiDirection.BACKWARD, "a\"b");
    }

    @Test
    void find_nothingStored_returnsEmpty() {
        whenLookedUp().thenReturn(List.of());

        Optional<ToolEventLog> found = find();

        assertThat(found).isEmpty();
    }

    @Test
    void find_lineWithUnknownFieldsAndNoOptionalOnes_readsWhatItKnows() {
        whenLookedUp().thenReturn(List.of(new LokiLogEntry(EVENT_NANOS,
                "{\"toolEventId\":\"evt-1\",\"eventTimestamp\":1790848800123,\"origin\":\"cassandra\"}", Map.of())));

        Optional<ToolEventLog> found = find();

        assertThat(found).contains(ToolEventLog.builder().toolEventId("evt-1").eventTimestamp(EVENT_MILLIS).build());
    }

    @Test
    void find_lineIsNotJson_throwsQueryFailureWithTheParsingCause() {
        whenLookedUp().thenReturn(List.of(new LokiLogEntry(EVENT_NANOS, "not json", Map.of())));

        assertThatThrownBy(this::find)
                .isExactlyInstanceOf(LokiQueryException.class)
                .hasMessage("Tool event log line in Loki is not readable")
                .hasCauseInstanceOf(JsonProcessingException.class);
    }

    @Test
    void find_lokiRejectsTheLookup_throwsPlainQueryFailureWithLokisReason() {
        LokiQueryRejectedException rejection = new LokiQueryRejectedException(
                "Loki query failed with HTTP 429: too many outstanding requests", null);
        whenLookedUp().thenThrow(rejection);

        assertThatThrownBy(this::find)
                .isExactlyInstanceOf(LokiQueryException.class)
                .hasMessage("Loki query failed with HTTP 429: too many outstanding requests")
                .hasCause(rejection);
    }

    @Test
    void find_lokiFails_letsTheQueryFailureThrough() {
        LokiQueryException failure = new LokiQueryException("Loki query failed: connection refused");
        whenLookedUp().thenThrow(failure);

        assertThatThrownBy(this::find).isSameAs(failure);
    }

    private OngoingStubbing<List<LokiLogEntry>> whenLookedUp() {
        return when(lokiClient.queryRange(QUERY, EVENT_NANOS, NEXT_MILLI_NANOS, 1, LokiDirection.BACKWARD, "tenant-a"));
    }

    private Optional<ToolEventLog> find() {
        return repository.find("tenant-a", "FLEET", "LOGIN", LAST_NANO_OF_THE_EVENT_MILLI, "evt-1");
    }

    private static ToolEventLog fullEvent() {
        return ToolEventLog.builder()
                .tenantId("tenant-a")
                .toolType("FLEET")
                .eventType("LOGIN")
                .toolEventId("evt-1")
                .ingestDay("2026-10-01")
                .eventTimestamp(EVENT_MILLIS)
                .severity("INFO")
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
    }
}
