package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

@ExtendWith(MockitoExtension.class)
class DeviceOsUpdateHistoryParserTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String ORGANIZATION_ID = "org-1";
    private static final String UPDATE_ID = "ffeeddcc-1111-2222-3333-445566778899";
    private static final String TITLE = "2026-10 Cumulative Update for Windows 11 Version 24H2 (KB5049981)";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant INSTALLED_AT = Instant.parse("2026-10-15T03:12:44Z");

    @Spy private ReportedEnumParser reportedEnumParser = new ReportedEnumParser(mock(DeviceOsReportMetrics.class));

    @InjectMocks private DeviceOsUpdateHistoryParser parser;

    private MachineOsUpdatesMessage.WindowsDetails windows;
    private MachineOsUpdatesMessage.WindowsHistoryEntry reportedEntry;
    private ReportingDevice reportingDevice;

    @BeforeEach
    void setUp() {
        reportedEntry = new MachineOsUpdatesMessage.WindowsHistoryEntry();
        reportedEntry.setUpdateId(UPDATE_ID);
        reportedEntry.setRevision(198);
        reportedEntry.setTitle(TITLE);
        reportedEntry.setInstalledAt(INSTALLED_AT);
        reportedEntry.setOperation("INSTALL");
        reportedEntry.setResultCode("SUCCEEDED");
        reportedEntry.setHresult(0L);
        windows = new MachineOsUpdatesMessage.WindowsDetails();
        windows.setHistory(List.of(reportedEntry));
        reportingDevice = ReportingDevice.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .organizationId(ORGANIZATION_ID)
                .platform(OsPlatform.WINDOWS)
                .receivedAt(RECEIVED_AT)
                .build();
    }

    @Test
    void parse_succeededInstall_entryIdentifiedByUpdateIdAndRevisionWithoutAnErrorCode() {
        // setup
        DeviceOsUpdateHistoryEntry expected = DeviceOsUpdateHistoryEntry.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .organizationId(ORGANIZATION_ID)
                .entryKey(UPDATE_ID + ":198|" + INSTALLED_AT.toEpochMilli() + "|INSTALL")
                .identifier(UPDATE_ID + ":198")
                .title(TITLE)
                .installedAt(INSTALLED_AT)
                .operation(OsUpdateOperation.INSTALL)
                .result(OsUpdateInstallResult.SUCCEEDED)
                .build();

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries).containsExactly(expected);
    }

    @ParameterizedTest
    @CsvSource({
            "2149842967,  0x80240017",
            "-2145124329, 0x80240017",
            "5,           0x00000005",
            "4294967295,  0xFFFFFFFF"
    })
    void parse_failedInstall_errorCodeIsTheHresultInHex(long hresult, String expectedErrorCode) {
        // setup
        reportedEntry.setResultCode("FAILED");
        reportedEntry.setHresult(hresult);

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries)
                .extracting(DeviceOsUpdateHistoryEntry::getResult, DeviceOsUpdateHistoryEntry::getErrorCode)
                .containsExactly(tuple(OsUpdateInstallResult.FAILED, expectedErrorCode));
    }

    @Test
    void parse_entryWithoutAnHresult_noErrorCode() {
        // setup
        reportedEntry.setHresult(null);

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries).extracting(DeviceOsUpdateHistoryEntry::getErrorCode).containsOnlyNulls().hasSize(1);
    }

    @Test
    void parse_entryWithoutARevision_identifiedByTheUpdateIdAlone() {
        // setup
        reportedEntry.setRevision(null);

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries)
                .extracting(DeviceOsUpdateHistoryEntry::getIdentifier, DeviceOsUpdateHistoryEntry::getEntryKey)
                .containsExactly(tuple(UPDATE_ID, UPDATE_ID + "|" + INSTALLED_AT.toEpochMilli() + "|INSTALL"));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void parse_entryWithoutAnUpdateId_skipped(String updateId) {
        // setup
        reportedEntry.setUpdateId(updateId);

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries).isEmpty();
    }

    @Test
    void parse_entryWithoutItsInstallTime_skipped() {
        // setup
        reportedEntry.setInstalledAt(null);

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries).isEmpty();
    }

    @Test
    void parse_nullAmongTheEntries_skippedAndTheOthersKept() {
        // setup
        windows.setHistory(Arrays.asList(null, reportedEntry));

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries).extracting(DeviceOsUpdateHistoryEntry::getIdentifier)
                .containsExactly(UPDATE_ID + ":198");
    }

    @Test
    void parse_operationAndResultTheBackendDoesNotKnow_storedAsNullAndTheEntryKept() {
        // setup
        reportedEntry.setOperation("REPAIR");
        reportedEntry.setResultCode("IN_PROGRESS");

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries)
                .extracting(DeviceOsUpdateHistoryEntry::getOperation, DeviceOsUpdateHistoryEntry::getResult,
                        DeviceOsUpdateHistoryEntry::getEntryKey)
                .containsExactly(tuple(null, null, UPDATE_ID + ":198|" + INSTALLED_AT.toEpochMilli() + "|REPAIR"));
    }

    @Test
    void parse_sameUpdateInstalledAndUninstalledAtTheSameInstant_twoEntriesWithTheirOwnKeys() {
        // setup
        MachineOsUpdatesMessage.WindowsHistoryEntry uninstall = new MachineOsUpdatesMessage.WindowsHistoryEntry();
        uninstall.setUpdateId(UPDATE_ID);
        uninstall.setRevision(198);
        uninstall.setInstalledAt(INSTALLED_AT);
        uninstall.setOperation("UNINSTALL");
        windows.setHistory(List.of(reportedEntry, uninstall));

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries).extracting(DeviceOsUpdateHistoryEntry::getOperation)
                .containsExactly(OsUpdateOperation.INSTALL, OsUpdateOperation.UNINSTALL);
        assertThat(historyEntries).extracting(DeviceOsUpdateHistoryEntry::getEntryKey).doesNotHaveDuplicates();
    }

    @Test
    void parse_sameInstallNamedTwice_oneEntryPerEntryKeyTheFirstOne() {
        // setup
        MachineOsUpdatesMessage.WindowsHistoryEntry again = new MachineOsUpdatesMessage.WindowsHistoryEntry();
        again.setUpdateId(UPDATE_ID);
        again.setRevision(198);
        again.setTitle("Named again");
        again.setInstalledAt(INSTALLED_AT);
        again.setOperation("INSTALL");
        again.setResultCode("FAILED");
        again.setHresult(2149842967L);
        windows.setHistory(List.of(reportedEntry, again));

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries)
                .extracting(DeviceOsUpdateHistoryEntry::getTitle, DeviceOsUpdateHistoryEntry::getResult,
                        DeviceOsUpdateHistoryEntry::getErrorCode)
                .containsExactly(tuple(TITLE, OsUpdateInstallResult.SUCCEEDED, null));
    }

    @Test
    void parse_macReportWithoutAWindowsBlock_noHistory() {
        // setup

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, null);

        // verifications
        assertThat(historyEntries).isEmpty();
    }

    @Test
    void parse_windowsBlockWithoutAHistory_noHistory() {
        // setup
        windows.setHistory(null);

        // execution
        List<DeviceOsUpdateHistoryEntry> historyEntries = parser.parse(reportingDevice, windows);

        // verifications
        assertThat(historyEntries).isEmpty();
    }
}
