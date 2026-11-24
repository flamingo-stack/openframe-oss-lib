package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.client.exception.MalformedDeviceOsReportException;
import com.openframe.client.service.rmm.osupdate.DeviceOsReport;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.LastOsInstall;
import com.openframe.data.document.rmm.osupdate.MacosUpdatePresence;
import com.openframe.data.document.rmm.osupdate.OsPatchState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsRebootPending;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateListConfidence;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.document.rmm.osupdate.OsUpdateRebootBehavior;
import com.openframe.data.document.rmm.osupdate.OsUpdateScanState;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Objects;

import static org.mockito.Mockito.mock;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DeviceOsReportParserTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant REPORTED_AT = Instant.parse("2026-11-20T09:14:02.481293Z");
    private static final String WINDOWS_IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final String WINDOWS_INSTALLED_IDENTIFIER = "ffeeddcc-1111-2222-3333-445566778899:198";
    private static final String WINDOWS_INSTALLED_TITLE =
            "2026-10 Cumulative Update for Windows 11 Version 24H2 (KB5049981)";
    private static final Instant WINDOWS_INSTALLED_AT = Instant.parse("2026-10-15T03:12:44Z");

    private DeviceOsReportParser parser;
    private Machine machine;

    @BeforeEach
    void setUp() {
        ReportedEnumParser reportedEnumParser = new ReportedEnumParser(mock(DeviceOsReportMetrics.class));
        parser = new DeviceOsReportParser(
                new JsonMapper(),
                reportedEnumParser,
                new DeviceOsStateParser(reportedEnumParser),
                new ReportedPendingUpdatesParser(reportedEnumParser),
                new OsUpdateParser(reportedEnumParser),
                new DeviceOsPendingUpdateParser(reportedEnumParser),
                new DeviceOsUpdateHistoryParser(reportedEnumParser));
        machine = new Machine();
        machine.setTenantId(TENANT_ID);
        machine.setMachineId(MACHINE_ID);
    }

    @Test
    void parse_macWithUpdatesAvailable_stateOfTheMacParsed() {
        // setup
        byte[] payload = fixture("macos-updates-available");

        // execution
        DeviceOsReport report = parser.parse(machine, payload, RECEIVED_AT);

        // verifications
        DeviceOsState state = report.getDeviceOsState();
        assertThat(state)
                .extracting(DeviceOsState::getTenantId, DeviceOsState::getMachineId, DeviceOsState::getPlatform,
                        DeviceOsState::getOsVersion, DeviceOsState::getOsBuild, DeviceOsState::getOsProductName)
                .containsExactly(TENANT_ID, MACHINE_ID, OsPlatform.MACOS, "26.1", "25B78", "macOS");
        assertThat(state)
                .extracting(DeviceOsState::getScanState, DeviceOsState::getLastScanAt,
                        DeviceOsState::getPendingUpdatesConfidence, DeviceOsState::getPatchState,
                        DeviceOsState::getRebootPending, DeviceOsState::getRebootPendingSince,
                        DeviceOsState::getOsUpdateAuthorization, DeviceOsState::getReportedAt,
                        DeviceOsState::getReceivedAt)
                .containsExactly(OsUpdateScanState.FRESH, Instant.parse("2026-11-20T08:05:21Z"),
                        OsUpdateListConfidence.CONFIRMED, OsPatchState.UPDATES_AVAILABLE,
                        OsRebootPending.UNKNOWN, null,
                        OsUpdateAuthorization.AUTHORIZED, REPORTED_AT, RECEIVED_AT);
        assertThat(state.getManageability()).isEqualTo(OsUpdateManageability.builder()
                .state(OsUpdateManageabilityState.MANAGEABLE).reasons(List.of()).build());
        assertThat(state.getLastOsInstall()).isEqualTo(LastOsInstall.builder()
                .displayName("macOS 26.1").displayVersion("26.1")
                .installedAt(Instant.parse("2026-10-28T23:41:07Z")).build());
    }

    @Test
    void parse_macWithUpdatesAvailable_threeUpdatesDescribedByNameAndVersionOnly() {
        // setup
        byte[] payload = fixture("macos-updates-available");

        // execution
        DeviceOsReport report = parser.parse(machine, payload, RECEIVED_AT);

        // verifications
        assertThat(report.isPendingUpdatesReadable()).isTrue();
        assertThat(report.getOsUpdates())
                .extracting(OsUpdate::getIdentifier, OsUpdate::getDisplayName, OsUpdate::getDisplayVersion)
                .containsExactly(
                        tuple("MSU_UPDATE_25C56_patch_26.2", "macOS Sequoia 26.2", "26.2"),
                        tuple("Command Line Tools for Xcode-26.6", "Command Line Tools for Xcode", "26.6"),
                        tuple("Safari-18.2", "Safari", "18.2"));
        assertThat(report.getOsUpdates())
                .extracting(OsUpdate::getTenantId, OsUpdate::getPlatform, OsUpdate::getFirstSeenAt,
                        OsUpdate::getKbArticleIds, OsUpdate::getSeverity, OsUpdate::getCategories,
                        OsUpdate::getCveIds, OsUpdate::getPublishedAt, OsUpdate::getSizeBytes,
                        OsUpdate::getRebootBehavior, OsUpdate::getBrowseOnly)
                .containsOnly(tuple(TENANT_ID, OsPlatform.MACOS, RECEIVED_AT,
                        null, null, null, null, null, null, null, null));
    }

    @Test
    void parse_macWithUpdatesAvailable_threePendingUpdatesWithTheirPresenceAndNoHistory() {
        // setup
        byte[] payload = fixture("macos-updates-available");

        // execution
        DeviceOsReport report = parser.parse(machine, payload, RECEIVED_AT);

        // verifications
        assertThat(report.getPendingUpdates())
                .extracting(DeviceOsPendingUpdate::getIdentifier, DeviceOsPendingUpdate::getMacosPresence,
                        DeviceOsPendingUpdate::getDownloaded, DeviceOsPendingUpdate::getDiscoveredAt,
                        DeviceOsPendingUpdate::getPlatform, DeviceOsPendingUpdate::getMachineId,
                        DeviceOsPendingUpdate::getTenantId)
                .containsExactly(
                        tuple("MSU_UPDATE_25C56_patch_26.2", MacosUpdatePresence.FRESH, null, RECEIVED_AT,
                                OsPlatform.MACOS, MACHINE_ID, TENANT_ID),
                        tuple("Command Line Tools for Xcode-26.6", MacosUpdatePresence.FRESH, null, RECEIVED_AT,
                                OsPlatform.MACOS, MACHINE_ID, TENANT_ID),
                        tuple("Safari-18.2", MacosUpdatePresence.HELD_OVER, null, RECEIVED_AT,
                                OsPlatform.MACOS, MACHINE_ID, TENANT_ID));
        assertThat(report.getHistoryEntries()).isEmpty();
    }

    @Test
    void parse_macThatCouldNotReadItsUpdates_stateParsedAndThePendingUpdatesNotReadable() {
        // setup
        byte[] payload = fixture("macos-updates-unreadable");

        // execution
        DeviceOsReport report = parser.parse(machine, payload, RECEIVED_AT);

        // verifications
        assertThat(report.isPendingUpdatesReadable()).isFalse();
        assertThat(report.getOsUpdates()).isEmpty();
        assertThat(report.getPendingUpdates()).isEmpty();
        assertThat(report.getHistoryEntries()).isEmpty();
        assertThat(report.getDeviceOsState())
                .extracting(DeviceOsState::getPlatform, DeviceOsState::getOsVersion, DeviceOsState::getOsBuild,
                        DeviceOsState::getPendingUpdatesConfidence, DeviceOsState::getPatchState,
                        DeviceOsState::getScanState, DeviceOsState::getLastScanAt, DeviceOsState::getRebootPending,
                        DeviceOsState::getOsUpdateAuthorization, DeviceOsState::getLastOsInstall)
                .containsExactly(OsPlatform.MACOS, "13.7.8", "22H730",
                        OsUpdateListConfidence.UNREADABLE, OsPatchState.UNKNOWN,
                        OsUpdateScanState.STALE, Instant.parse("2026-11-06T04:11:00Z"), OsRebootPending.UNKNOWN,
                        OsUpdateAuthorization.NOT_REQUIRED, null);
        assertThat(report.getDeviceOsState().getManageability()).isEqualTo(OsUpdateManageability.builder()
                .state(OsUpdateManageabilityState.NOT_MANAGEABLE).reasons(List.of("NO_SERVICE_ACCOUNT")).build());
    }

    @Test
    void parse_windowsManagedByWsus_stateOfTheWindowsDeviceParsed() {
        // setup
        byte[] payload = fixture("windows-managed-by-wsus");

        // execution
        DeviceOsReport report = parser.parse(machine, payload, RECEIVED_AT);

        // verifications
        DeviceOsState state = report.getDeviceOsState();
        assertThat(state)
                .extracting(DeviceOsState::getPlatform, DeviceOsState::getOsVersion, DeviceOsState::getOsBuild,
                        DeviceOsState::getOsProductName, DeviceOsState::getScanState, DeviceOsState::getLastScanAt,
                        DeviceOsState::getPendingUpdatesConfidence, DeviceOsState::getPatchState,
                        DeviceOsState::getRebootPending, DeviceOsState::getOsUpdateAuthorization,
                        DeviceOsState::getReportedAt, DeviceOsState::getReceivedAt)
                .containsExactly(OsPlatform.WINDOWS, "11 24H2", "26100.4061",
                        "Windows 11 Pro", OsUpdateScanState.FRESH, Instant.parse("2026-11-20T08:44:00Z"),
                        OsUpdateListConfidence.CONFIRMED, OsPatchState.UPDATES_AVAILABLE,
                        OsRebootPending.NO, OsUpdateAuthorization.NOT_REQUIRED,
                        REPORTED_AT, RECEIVED_AT);
        assertThat(state.getManageability()).isEqualTo(OsUpdateManageability.builder()
                .state(OsUpdateManageabilityState.NOT_MANAGEABLE).reasons(List.of("WSUS", "GROUP_POLICY")).build());
        assertThat(state.getLastOsInstall()).isEqualTo(LastOsInstall.builder()
                .identifier(WINDOWS_INSTALLED_IDENTIFIER).displayName(WINDOWS_INSTALLED_TITLE)
                .installedAt(WINDOWS_INSTALLED_AT).build());
    }

    @Test
    void parse_windowsManagedByWsus_updateDescribedWithEverythingWindowsSaysAboutIt() {
        // setup
        byte[] payload = fixture("windows-managed-by-wsus");
        OsUpdate expectedOsUpdate = OsUpdate.builder()
                .tenantId(TENANT_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(WINDOWS_IDENTIFIER)
                .displayName("2026-11 Cumulative Update for Windows 11 Version 24H2 (KB5051987)")
                .kbArticleIds(List.of("5051987"))
                .severity(OsUpdateSeverity.CRITICAL)
                .categories(List.of("Security Updates"))
                .cveIds(List.of("CVE-2026-21309", "CVE-2026-21311"))
                .publishedAt(Instant.parse("2026-11-11T18:00:00Z"))
                .sizeBytes(764317696L)
                .rebootBehavior(OsUpdateRebootBehavior.ALWAYS)
                .browseOnly(false)
                .firstSeenAt(RECEIVED_AT)
                .build();
        DeviceOsPendingUpdate expectedPendingUpdate = DeviceOsPendingUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(WINDOWS_IDENTIFIER)
                .discoveredAt(RECEIVED_AT)
                .downloaded(true)
                .build();

        // execution
        DeviceOsReport report = parser.parse(machine, payload, RECEIVED_AT);

        // verifications
        assertThat(report.isPendingUpdatesReadable()).isTrue();
        assertThat(report.getOsUpdates()).containsExactly(expectedOsUpdate);
        assertThat(report.getPendingUpdates()).containsExactly(expectedPendingUpdate);
    }

    @Test
    void parse_windowsManagedByWsus_historyEntryParsed() {
        // setup
        byte[] payload = fixture("windows-managed-by-wsus");
        DeviceOsUpdateHistoryEntry expected = DeviceOsUpdateHistoryEntry.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .entryKey(WINDOWS_INSTALLED_IDENTIFIER + "|" + WINDOWS_INSTALLED_AT.toEpochMilli() + "|INSTALL")
                .identifier(WINDOWS_INSTALLED_IDENTIFIER)
                .title(WINDOWS_INSTALLED_TITLE)
                .installedAt(WINDOWS_INSTALLED_AT)
                .operation(OsUpdateOperation.INSTALL)
                .result(OsUpdateInstallResult.SUCCEEDED)
                .build();

        // execution
        DeviceOsReport report = parser.parse(machine, payload, RECEIVED_AT);

        // verifications
        assertThat(report.getHistoryEntries()).containsExactly(expected);
    }

    @Test
    void parse_valuesAndFieldsTheBackendDoesNotKnow_reportParsedWithThoseValuesAsNull() {
        // setup
        byte[] payload = """
                {
                  "platform": "WINDOWS",
                  "fieldOfANewerAgent": {"nested": [1, 2]},
                  "rebootPending": "PROBABLY",
                  "patchState": "HALF_PATCHED",
                  "scanState": "ANCIENT",
                  "osUpdateAuthorization": "ASK_LATER",
                  "manageability": {"state": "PARTLY", "reasons": ["REASON_OF_A_NEWER_AGENT"], "since": 1},
                  "updates": {
                    "confidence": "CONFIRMED",
                    "items": [{
                      "identifier": "kb-1",
                      "extra": true,
                      "windows": {"msrcSeverity": "Catastrophic", "rebootBehavior": "TWICE", "newFlag": 1,
                                  "categories": [{"name": "Security Updates", "weight": 3}]}
                    }]
                  },
                  "lastOsInstall": {"installedAt": "2026-10-15T03:12:44Z", "source": "WUA"},
                  "windows": {
                    "history": [{"updateId": "u-1", "installedAt": "2026-10-15T03:12:44Z",
                                 "operation": "REPAIR", "resultCode": "HALF_DONE", "hresult": 0, "extra": "x"}]
                  }
                }
                """.getBytes(StandardCharsets.UTF_8);

        // execution
        DeviceOsReport report = parser.parse(machine, payload, RECEIVED_AT);

        // verifications
        assertThat(report.getDeviceOsState())
                .extracting(DeviceOsState::getRebootPending, DeviceOsState::getPatchState,
                        DeviceOsState::getScanState, DeviceOsState::getOsUpdateAuthorization)
                .containsExactly(null, null, null, null);
        assertThat(report.getDeviceOsState().getManageability())
                .extracting(OsUpdateManageability::getState, OsUpdateManageability::getReasons)
                .containsExactly(null, List.of("REASON_OF_A_NEWER_AGENT"));
        assertThat(report.getOsUpdates())
                .extracting(OsUpdate::getIdentifier, OsUpdate::getSeverity, OsUpdate::getRebootBehavior,
                        OsUpdate::getCategories)
                .containsExactly(tuple("kb-1", null, null, List.of("Security Updates")));
        assertThat(report.getHistoryEntries())
                .extracting(DeviceOsUpdateHistoryEntry::getIdentifier, DeviceOsUpdateHistoryEntry::getOperation,
                        DeviceOsUpdateHistoryEntry::getResult)
                .containsExactly(tuple("u-1", null, null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "not json", "{\"platform\": \"WINDOWS\"", "[]", "\"text\"",
            "{\"platform\": \"WINDOWS\", \"lastScanAt\": \"yesterday\"}",
            "{\"platform\": \"WINDOWS\", \"updates\": \"none\"}"})
    void parse_payloadThatIsNotAReadableReport_throwsMalformed(String malformed) {
        // setup
        byte[] payload = malformed.getBytes(StandardCharsets.UTF_8);

        // execution
        MalformedDeviceOsReportException ex = assertThrows(MalformedDeviceOsReportException.class,
                () -> parser.parse(machine, payload, RECEIVED_AT));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("OS report is not readable JSON");
    }

    @Test
    void parse_jsonNull_throwsMalformed() {
        // setup
        byte[] payload = "null".getBytes(StandardCharsets.UTF_8);

        // execution
        MalformedDeviceOsReportException ex = assertThrows(MalformedDeviceOsReportException.class,
                () -> parser.parse(machine, payload, RECEIVED_AT));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("OS report is empty");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"platform\": null}", "{\"platform\": \"\"}", "{\"platform\": \"LINUX\"}",
            "{\"osVersion\": \"26.1\", \"updates\": {\"confidence\": \"CONFIRMED\", \"items\": []}}"})
    void parse_reportWithoutAKnownPlatform_throwsMalformed(String withoutPlatform) {
        // setup
        byte[] payload = withoutPlatform.getBytes(StandardCharsets.UTF_8);

        // execution
        MalformedDeviceOsReportException ex = assertThrows(MalformedDeviceOsReportException.class,
                () -> parser.parse(machine, payload, RECEIVED_AT));

        // verifications
        assertThat(ex.getMessage()).startsWith("OS report names no known platform");
    }

    private static byte[] fixture(String name) {
        String path = "/os-updates/" + name + ".json";
        try (InputStream in = DeviceOsReportParserTest.class.getResourceAsStream(path)) {
            return Objects.requireNonNull(in, "No fixture " + path).readAllBytes();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
