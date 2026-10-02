package com.openframe.external.controller;

import com.openframe.api.service.LogService;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.pinot.repository.PinotLogRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.external.mapper.LogMapper;
import com.openframe.external.support.ExternalApiMockMvc;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class LogControllerUnreadableDetailsTest {

    @Mock
    private PinotLogRepository pinotLogRepository;

    @Mock
    private LokiClient lokiClient;

    @Mock
    private TenantIdProvider tenantIdProvider;

    @Test
    void getLogDetails_savedLineUnreadable_answers503LokiQueryErrorAndLogsTheCause(CapturedOutput output)
            throws Exception {
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-a");
        when(lokiClient.queryRange(
                "{job=\"tool-events\", tenant_id=\"tenant-a\", tool_type=\"MESHCENTRAL\"}"
                        + " | tool_event_id=\"evt-1\" | event_type=\"LOGIN\"",
                1_705_312_800_123_000_000L, 1_705_312_800_124_000_000L, 1, LokiDirection.BACKWARD, "tenant-a"))
                .thenReturn(List.of(new LokiLogEntry(1_705_312_800_123_000_000L, "not json", Map.of())));
        MockMvc mockMvc = ExternalApiMockMvc.standalone(new LogController(
                new LogService(pinotLogRepository, new ToolEventLogRepository(lokiClient), tenantIdProvider),
                new LogMapper()));

        mockMvc.perform(get("/api/v1/logs/details")
                        .param("ingestDay", "2024-01-15")
                        .param("toolType", "MESHCENTRAL")
                        .param("eventType", "LOGIN")
                        .param("timestamp", "2024-01-15T10:00:00.123Z")
                        .param("toolEventId", "evt-1"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("LOKI_QUERY_ERROR"))
                .andExpect(jsonPath("$.message").value("Logs are temporarily unavailable. Please try again later."));

        assertThat(output.getOut())
                .contains("Loki query error: ")
                .contains("LokiQueryException: Tool event log line in Loki is not readable")
                .contains("Caused by: com.fasterxml.jackson.core.JsonParseException");
    }
}
