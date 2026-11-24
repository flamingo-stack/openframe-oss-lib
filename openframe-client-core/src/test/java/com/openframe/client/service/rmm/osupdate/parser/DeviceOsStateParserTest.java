package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.LastOsInstall;
import com.openframe.data.document.rmm.osupdate.OsPatchState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsRebootPending;
import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateListConfidence;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.document.rmm.osupdate.OsUpdateScanState;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class DeviceOsStateParserTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant REPORTED_AT = Instant.parse("2026-11-20T09:14:02.481293Z");
    private static final Instant LAST_SCAN_AT = Instant.parse("2026-11-20T08:44:00Z");
    private static final Instant INSTALLED_AT = Instant.parse("2026-10-15T03:12:44Z");

    @Spy private ReportedEnumParser reportedEnumParser = new ReportedEnumParser(mock(DeviceOsReportMetrics.class));

    @InjectMocks private DeviceOsStateParser parser;

    private MachineOsUpdatesMessage message;
    private ReportingDevice windowsDevice;
    private ReportingDevice macDevice;

    @BeforeEach
    void setUp() {
        message = new MachineOsUpdatesMessage();
        windowsDevice = reportingDevice(OsPlatform.WINDOWS);
        macDevice = reportingDevice(OsPlatform.MACOS);
    }

    @Test
    void parse_everyValueReported_everyValueOfTheStateFilled() {
        // setup
        MachineOsUpdatesMessage.Manageability manageability = new MachineOsUpdatesMessage.Manageability();
        manageability.setState("NOT_MANAGEABLE");
        manageability.setReasons(List.of("WSUS", "GROUP_POLICY"));
        MachineOsUpdatesMessage.UpdateSet updates = new MachineOsUpdatesMessage.UpdateSet();
        updates.setConfidence("CONFIRMED");
        MachineOsUpdatesMessage.LastOsInstall lastOsInstall = new MachineOsUpdatesMessage.LastOsInstall();
        lastOsInstall.setIdentifier("ffeeddcc-1111-2222-3333-445566778899:198");
        lastOsInstall.setDisplayName("2026-10 Cumulative Update");
        lastOsInstall.setDisplayVersion("24H2");
        lastOsInstall.setInstalledAt(INSTALLED_AT);
        message.setReportedAt(REPORTED_AT);
        message.setOsVersion("11 24H2");
        message.setOsBuild("26100.4061");
        message.setOsProductName("Windows 11 Pro");
        message.setScanState("FRESH");
        message.setLastScanAt(LAST_SCAN_AT);
        message.setPatchState("UPDATES_AVAILABLE");
        message.setRebootPending("YES");
        message.setOsUpdateAuthorization("NOT_REQUIRED");
        message.setManageability(manageability);
        message.setUpdates(updates);
        message.setLastOsInstall(lastOsInstall);
        DeviceOsState expected = DeviceOsState.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.WINDOWS)
                .osVersion("11 24H2")
                .osBuild("26100.4061")
                .osProductName("Windows 11 Pro")
                .scanState(OsUpdateScanState.FRESH)
                .lastScanAt(LAST_SCAN_AT)
                .pendingUpdatesConfidence(OsUpdateListConfidence.CONFIRMED)
                .patchState(OsPatchState.UPDATES_AVAILABLE)
                .rebootPending(OsRebootPending.YES)
                .manageability(OsUpdateManageability.builder()
                        .state(OsUpdateManageabilityState.NOT_MANAGEABLE)
                        .reasons(List.of("WSUS", "GROUP_POLICY"))
                        .build())
                .osUpdateAuthorization(OsUpdateAuthorization.NOT_REQUIRED)
                .lastOsInstall(LastOsInstall.builder()
                        .identifier("ffeeddcc-1111-2222-3333-445566778899:198")
                        .displayName("2026-10 Cumulative Update")
                        .displayVersion("24H2")
                        .installedAt(INSTALLED_AT)
                        .build())
                .reportedAt(REPORTED_AT)
                .receivedAt(RECEIVED_AT)
                .build();

        // execution
        DeviceOsState state = parser.parse(windowsDevice, message);

        // verifications
        assertThat(state).isEqualTo(expected);
    }

    @Test
    void parse_reportWithOnlyThePlatform_stateOfTheDeviceWithNothingElse() {
        // setup
        DeviceOsState expected = DeviceOsState.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.MACOS)
                .receivedAt(RECEIVED_AT)
                .build();

        // execution
        DeviceOsState state = parser.parse(macDevice, message);

        // verifications
        assertThat(state).isEqualTo(expected);
    }

    @Test
    void parse_valuesTheBackendDoesNotKnow_storedAsNullAndTheReportStillParsed() {
        // setup
        MachineOsUpdatesMessage.Manageability manageability = new MachineOsUpdatesMessage.Manageability();
        manageability.setState("PARTLY_MANAGEABLE");
        manageability.setReasons(List.of("WSUS", "REASON_FROM_A_NEWER_AGENT"));
        MachineOsUpdatesMessage.UpdateSet updates = new MachineOsUpdatesMessage.UpdateSet();
        updates.setConfidence("GUESSED");
        message.setScanState("ANCIENT");
        message.setPatchState("HALF_PATCHED");
        message.setRebootPending("MAYBE");
        message.setOsUpdateAuthorization("PENDING_APPROVAL");
        message.setManageability(manageability);
        message.setUpdates(updates);
        message.setOsVersion("26.1");

        // execution
        DeviceOsState state = parser.parse(macDevice, message);

        // verifications
        assertThat(state)
                .extracting(DeviceOsState::getScanState, DeviceOsState::getPatchState, DeviceOsState::getRebootPending,
                        DeviceOsState::getOsUpdateAuthorization, DeviceOsState::getPendingUpdatesConfidence,
                        DeviceOsState::getOsVersion)
                .containsExactly(null, null, null, null, null, "26.1");
        assertThat(state.getManageability())
                .extracting(OsUpdateManageability::getState, OsUpdateManageability::getReasons)
                .containsExactly(null, List.of("WSUS", "REASON_FROM_A_NEWER_AGENT"));
    }

    @ParameterizedTest
    @CsvSource({
            "CONFIRMED,   CONFIRMED",
            "UNCONFIRMED, UNCONFIRMED",
            "RETAINED,    RETAINED",
            "UNREADABLE,  UNREADABLE",
            "TOO_LARGE,   TOO_LARGE"
    })
    void parse_confidenceOfThePendingUpdates_storedAsTheDeviceSaidIt(String reported, OsUpdateListConfidence expected) {
        // setup
        MachineOsUpdatesMessage.UpdateSet updates = new MachineOsUpdatesMessage.UpdateSet();
        updates.setConfidence(reported);
        message.setUpdates(updates);

        // execution
        DeviceOsState state = parser.parse(macDevice, message);

        // verifications
        assertThat(state.getPendingUpdatesConfidence()).isEqualTo(expected);
    }

    @Test
    void parse_manageabilityWithoutReasons_emptyReasons() {
        // setup
        MachineOsUpdatesMessage.Manageability manageability = new MachineOsUpdatesMessage.Manageability();
        manageability.setState("MANAGEABLE");
        message.setManageability(manageability);

        // execution
        DeviceOsState state = parser.parse(macDevice, message);

        // verifications
        assertThat(state.getManageability())
                .extracting(OsUpdateManageability::getState, OsUpdateManageability::getReasons)
                .containsExactly(OsUpdateManageabilityState.MANAGEABLE, List.of());
    }

    @Test
    void parse_lastOsInstallWithoutItsTime_noLastOsInstall() {
        // setup
        MachineOsUpdatesMessage.LastOsInstall lastOsInstall = new MachineOsUpdatesMessage.LastOsInstall();
        lastOsInstall.setDisplayName("macOS 26.1");
        message.setLastOsInstall(lastOsInstall);

        // execution
        DeviceOsState state = parser.parse(macDevice, message);

        // verifications
        assertThat(state.getLastOsInstall()).isNull();
    }

    @Test
    void parse_rebootPendingReported_sinceLeftForTheServiceToResolve() {
        // setup
        message.setRebootPending("YES");

        // execution
        DeviceOsState state = parser.parse(windowsDevice, message);

        // verifications
        assertThat(state)
                .extracting(DeviceOsState::getRebootPending, DeviceOsState::getRebootPendingSince)
                .containsExactly(OsRebootPending.YES, null);
    }

    private static ReportingDevice reportingDevice(OsPlatform platform) {
        return ReportingDevice.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(platform)
                .receivedAt(RECEIVED_AT)
                .build();
    }
}
