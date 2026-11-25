package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.client.publisher.EventLogsPublisher;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class DeviceOsUpdateHistoryLogServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String IDENTIFIER = "ffeeddcc-1111-2222-3333-445566778899:198";
    private static final String TITLE = "2026-10 Cumulative Update for Windows 11 Version 24H2 (KB5049981)";
    private static final Instant INSTALLED_AT = Instant.parse("2026-11-15T03:12:44.250Z");
    private static final String ENTRY_KEY = IDENTIFIER + "|" + INSTALLED_AT.toEpochMilli() + "|INSTALL";
    private static final JsonMapper JSON = new JsonMapper();

    @Mock private EventLogsPublisher eventLogsPublisher;
    @Mock private DeviceOsReportMetrics deviceOsReportMetrics;

    @Captor private ArgumentCaptor<CommonDebeziumMessage> logEventCaptor;
    @Captor private ArgumentCaptor<Map<String, Object>> headersCaptor;

    private DeviceOsUpdateHistoryLogService service;

    private DeviceOsUpdateHistoryEntry failedInstall;

    @BeforeEach
    void setUp() {
        service = new DeviceOsUpdateHistoryLogService(eventLogsPublisher, JSON, deviceOsReportMetrics);
        failedInstall = DeviceOsUpdateHistoryEntry.builder()
                .id("6aff19c07ce86a3f0386ff82")
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .entryKey(ENTRY_KEY)
                .identifier(IDENTIFIER)
                .title(TITLE)
                .installedAt(INSTALLED_AT)
                .operation(OsUpdateOperation.INSTALL)
                .result(OsUpdateInstallResult.FAILED)
                .errorCode("0x80240017")
                .build();
    }

    @Test
    void logNewEntries_noEntries_nothingPublished() {
        // setup
        List<DeviceOsUpdateHistoryEntry> noEntries = List.of();

        // execution
        service.logNewEntries(noEntries);

        // verifications
        verifyNoInteractions(eventLogsPublisher);
    }

    @Test
    void logNewEntries_entry_publishedOnceUnderItsMachineIdWithTheOsUpdateHistoryMessageType() {
        // setup
        List<DeviceOsUpdateHistoryEntry> newEntries = List.of(failedInstall);

        // execution
        service.logNewEntries(newEntries);

        // verifications
        verify(eventLogsPublisher).publish(eq(MACHINE_ID), logEventCaptor.capture(), headersCaptor.capture());
        assertThat(headersCaptor.getValue()).containsOnly(Map.entry("message-type", "OS_UPDATE_HISTORY_EVENT"));
    }

    @Test
    void logNewEntries_entry_payloadIsACreateOfTheEntryWithItsInstallTimeInMillis() {
        // setup
        ObjectNode expectedAfter = JSON.createObjectNode()
                .put("tenantId", TENANT_ID)
                .put("machineId", MACHINE_ID)
                .put("entryKey", ENTRY_KEY)
                .put("identifier", IDENTIFIER)
                .put("title", TITLE)
                .put("operation", "INSTALL")
                .put("result", "FAILED")
                .put("errorCode", "0x80240017")
                .put("installedAt", INSTALLED_AT.toEpochMilli());
        long before = Instant.now().toEpochMilli();

        // execution
        service.logNewEntries(List.of(failedInstall));

        // verifications
        verify(eventLogsPublisher).publish(eq(MACHINE_ID), logEventCaptor.capture(), headersCaptor.capture());
        assertThat(logEventCaptor.getValue().getPayload().getAfter()).isEqualTo(expectedAfter);
        assertThat(logEventCaptor.getValue().getPayload().getOperation()).isEqualTo("c");
        assertThat(logEventCaptor.getValue().getPayload().getTimestamp())
                .isBetween(before, Instant.now().toEpochMilli());
    }

    @Test
    void logNewEntries_succeededInstallWithoutTitleAndErrorCode_thoseFieldsAbsentFromThePayload() {
        // setup
        failedInstall.setResult(OsUpdateInstallResult.SUCCEEDED);
        failedInstall.setTitle(null);
        failedInstall.setErrorCode(null);
        ObjectNode expectedAfter = JSON.createObjectNode()
                .put("tenantId", TENANT_ID)
                .put("machineId", MACHINE_ID)
                .put("entryKey", ENTRY_KEY)
                .put("identifier", IDENTIFIER)
                .put("operation", "INSTALL")
                .put("result", "SUCCEEDED")
                .put("installedAt", INSTALLED_AT.toEpochMilli());

        // execution
        service.logNewEntries(List.of(failedInstall));

        // verifications
        verify(eventLogsPublisher).publish(eq(MACHINE_ID), logEventCaptor.capture(), headersCaptor.capture());
        assertThat(logEventCaptor.getValue().getPayload().getAfter()).isEqualTo(expectedAfter);
    }

    @Test
    void logNewEntries_severalEntries_onePublishPerEntryInTheirOrder() {
        // setup
        DeviceOsUpdateHistoryEntry uninstall = DeviceOsUpdateHistoryEntry.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .entryKey("kb-2|1|UNINSTALL")
                .identifier("kb-2")
                .installedAt(INSTALLED_AT.plusSeconds(60))
                .operation(OsUpdateOperation.UNINSTALL)
                .result(OsUpdateInstallResult.SUCCEEDED_WITH_ERRORS)
                .build();

        // execution
        service.logNewEntries(List.of(failedInstall, uninstall));

        // verifications
        verify(eventLogsPublisher, times(2))
                .publish(eq(MACHINE_ID), logEventCaptor.capture(), headersCaptor.capture());
        assertThat(logEventCaptor.getAllValues())
                .extracting(logEvent -> text(logEvent, "entryKey"), logEvent -> text(logEvent, "operation"),
                        logEvent -> text(logEvent, "result"))
                .containsExactly(
                        tuple(ENTRY_KEY, "INSTALL", "FAILED"),
                        tuple("kb-2|1|UNINSTALL", "UNINSTALL", "SUCCEEDED_WITH_ERRORS"));
    }

    @ParameterizedTest
    @CsvSource({
            "       , SUCCEEDED",
            "INSTALL,          ",
            "       ,          "
    })
    void logNewEntries_entryWhoseOperationOrResultTheBackendDoesNotKnow_notPublished(OsUpdateOperation operation,
                                                                                    OsUpdateInstallResult result) {
        // setup
        failedInstall.setOperation(operation);
        failedInstall.setResult(result);

        // execution
        service.logNewEntries(List.of(failedInstall));

        // verifications
        verifyNoInteractions(eventLogsPublisher);
    }

    @Test
    void logNewEntries_entryWithAnUnknownOutcomeBesideAKnownOne_onlyTheKnownOnePublished() {
        // setup
        DeviceOsUpdateHistoryEntry unknownOutcome = DeviceOsUpdateHistoryEntry.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .entryKey("kb-3|1|null")
                .identifier("kb-3")
                .installedAt(INSTALLED_AT)
                .build();

        // execution
        service.logNewEntries(List.of(unknownOutcome, failedInstall));

        // verifications
        verify(eventLogsPublisher).publish(eq(MACHINE_ID), logEventCaptor.capture(), headersCaptor.capture());
        assertThat(logEventCaptor.getAllValues()).extracting(logEvent -> text(logEvent, "entryKey"))
                .containsExactly(ENTRY_KEY);
    }

    @Test
    void logNewEntries_entryWithAnUnknownOutcomeBesideAKnownOne_onePublishedLogEventCounted() {
        // setup
        DeviceOsUpdateHistoryEntry unknownOutcome = DeviceOsUpdateHistoryEntry.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .entryKey("kb-3|1|null")
                .identifier("kb-3")
                .installedAt(INSTALLED_AT)
                .build();

        // execution
        service.logNewEntries(List.of(unknownOutcome, failedInstall));

        // verifications
        verify(deviceOsReportMetrics).recordHistoryLogPublished();
    }

    @Test
    void logNewEntries_noEntries_noPublishedLogEventCounted() {
        // setup
        List<DeviceOsUpdateHistoryEntry> noEntries = List.of();

        // execution
        service.logNewEntries(noEntries);

        // verifications
        verifyNoInteractions(deviceOsReportMetrics);
    }

    private static String text(CommonDebeziumMessage logEvent, String field) {
        JsonNode value = logEvent.getPayload().getAfter().get(field);
        return value == null ? null : value.asString();
    }
}
