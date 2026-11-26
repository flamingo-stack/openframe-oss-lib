package com.openframe.external.controller;

import com.jayway.jsonpath.JsonPath;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.service.LogDetailsService;
import com.openframe.api.service.LogService;
import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.model.LogSortPosition;
import com.openframe.data.pinot.repository.PinotLogRepository;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.external.mapper.LogMapper;
import com.openframe.external.support.ExternalApiMockMvc;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class LogControllerKeysetCursorTest {

    private static final String BASE = "/api/v1/logs";
    private static final String TENANT_ID = "t1";
    private static final String EVENT_TIMESTAMP = "eventTimestamp";
    private static final String SEVERITY = "severity";

    @Mock
    private PinotLogRepository pinotLogRepository;
    @Mock
    private TenantIdProvider tenantIdProvider;
    @Mock
    private LogDetailsService logDetailsService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LogService logService = new LogService(pinotLogRepository, tenantIdProvider);
        mockMvc = ExternalApiMockMvc.standalone(new LogController(logService, logDetailsService, new LogMapper()));
    }

    @Test
    void getLogs_endCursorOfAPageSentBack_pinotIsAskedForTheRowsAfterTheLastShownRow() throws Exception {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(pinotLogRepository.isSortableField(SEVERITY)).thenReturn(true);
        when(pinotLogRepository.sortPositionOf(any(LogProjection.class), any()))
                .thenAnswer(call -> severityPosition(call.getArgument(0)));
        when(pinotLogRepository.findLogs(TENANT_ID, null, null, null, null, null, null, null, null, null, null, 3,
                SEVERITY, "ASC", false)).thenReturn(List.of(row("e-1", "ERROR"), row("e-2", "ERROR"), row("e-3", "INFO")));
        String issuedByTheService = KeysetCursor.ofString(SEVERITY, Sort.Direction.ASC, "ERROR", "e-2").encode();

        // execution
        String pageOne = mockMvc.perform(get(BASE)
                        .param("limit", "2")
                        .param("sortField", SEVERITY)
                        .param("sortDirection", "ASC"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String endCursor = JsonPath.read(pageOne, "$.pageInfo.endCursor");
        mockMvc.perform(get(BASE)
                        .param("limit", "2")
                        .param("sortField", SEVERITY)
                        .param("sortDirection", "ASC")
                        .param("cursor", endCursor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pageInfo.hasPreviousPage").value(true));

        // verifications
        assertThat(endCursor).isEqualTo(issuedByTheService);
        verify(pinotLogRepository).findLogs(TENANT_ID, null, null, null, null, null, null, null, null, null,
                LogSortPosition.ofText("ERROR", "e-2"), 3, SEVERITY, "ASC", false);
    }

    @Test
    void getLogs_cursorIssuedBeforeTheKeysetFormat_pinotIsAskedForTheRowsAfterThatTimestampPosition() throws Exception {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(pinotLogRepository.getDefaultSortField()).thenReturn(EVENT_TIMESTAMP);
        String olderCursor = CursorCodec.encode("1705312800000_evt-1");

        // execution
        mockMvc.perform(get(BASE).param("cursor", olderCursor))
                .andExpect(status().isOk());

        // verifications
        verify(pinotLogRepository).findLogs(TENANT_ID, null, null, null, null, null, null, null, null, null,
                LogSortPosition.ofTimestamp(1_705_312_800_000L, "evt-1"), 21, EVENT_TIMESTAMP, "DESC", false);
    }

    @Test
    void getLogs_keysetCursorOfAnotherSort_400InvalidCursorAndPinotIsNotAsked() throws Exception {
        // setup
        when(pinotLogRepository.getDefaultSortField()).thenReturn(EVENT_TIMESTAMP);
        String severityCursor = KeysetCursor.ofString(SEVERITY, Sort.Direction.ASC, "ERROR", "e-2").encode();

        // execution
        mockMvc.perform(get(BASE).param("cursor", severityCursor))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURSOR"))
                .andExpect(jsonPath("$.message").value("Invalid cursor"));

        // verifications
        verifyPinotNotAsked();
    }

    @ParameterizedTest
    @ValueSource(strings = {"garbage", "65f1a2b3c4d5e6f708192a3b", "abc_evt-1", "1705312800000_", "k1|eventTimestamp|DESC",
            "k1|eventTimestamp|DESC|1 OR 1=1|evt-1"})
    void getLogs_cursorThatIsNotALogPosition_400InvalidCursorAndPinotIsNotAsked(String decodedCursor) throws Exception {
        // setup
        when(pinotLogRepository.getDefaultSortField()).thenReturn(EVENT_TIMESTAMP);
        String cursor = CursorCodec.encode(decodedCursor);

        // execution
        mockMvc.perform(get(BASE).param("cursor", cursor))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURSOR"))
                .andExpect(jsonPath("$.message").value("Invalid cursor"));

        // verifications
        verifyPinotNotAsked();
    }

    private static LogProjection row(String toolEventId, String severity) {
        return LogProjection.builder()
                .toolEventId(toolEventId)
                .severity(severity)
                .eventTimestamp(Instant.ofEpochMilli(1_705_312_800_000L))
                .build();
    }

    private static LogSortPosition severityPosition(LogProjection row) {
        return LogSortPosition.ofText(row.severity, row.toolEventId);
    }

    private void verifyPinotNotAsked() {
        verify(pinotLogRepository, never()).findLogs(any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), anyInt(), any(), any(), anyBoolean());
        verify(pinotLogRepository, never()).searchLogs(any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), anyInt(), any(), any(), anyBoolean());
    }
}
