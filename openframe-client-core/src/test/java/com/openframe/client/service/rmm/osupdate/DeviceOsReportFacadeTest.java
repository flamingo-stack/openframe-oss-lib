package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.client.exception.MalformedDeviceOsReportException;
import com.openframe.client.service.rmm.osupdate.parser.DeviceOsReportParser;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOsReportFacadeTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final byte[] PAYLOAD = "{\"platform\":\"WINDOWS\"}".getBytes(StandardCharsets.UTF_8);

    @Mock private MachineRepository machineRepository;
    @Mock private DeviceOsReportParser deviceOsReportParser;
    @Mock private DeviceOsStateService deviceOsStateService;
    @Mock private OsUpdateService osUpdateService;
    @Mock private DeviceOsPendingUpdateService deviceOsPendingUpdateService;
    @Mock private DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;
    @Mock private DeviceOsUpdateHistoryLogService deviceOsUpdateHistoryLogService;
    @Mock private DeviceOsReportMetrics deviceOsReportMetrics;

    @InjectMocks private DeviceOsReportFacade facade;

    private Machine machine;
    private DeviceOsState deviceOsState;
    private List<OsUpdate> osUpdates;
    private List<DeviceOsPendingUpdate> pendingUpdates;
    private List<DeviceOsUpdateHistoryEntry> historyEntries;
    private List<DeviceOsUpdateHistoryEntry> newHistoryEntries;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setTenantId(TENANT_ID);
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.MANAGED);
        deviceOsState = DeviceOsState.builder().tenantId(TENANT_ID).machineId(MACHINE_ID).receivedAt(RECEIVED_AT).build();
        osUpdates = List.of(OsUpdate.builder().identifier("kb-1").build());
        pendingUpdates = List.of(DeviceOsPendingUpdate.builder().identifier("kb-1").build());
        historyEntries = List.of(
                DeviceOsUpdateHistoryEntry.builder().identifier("kb-0").build(),
                DeviceOsUpdateHistoryEntry.builder().identifier("kb-new").build());
        newHistoryEntries = List.of(DeviceOsUpdateHistoryEntry.builder().id("stored-now").identifier("kb-new").build());
    }

    @Test
    void applyReport_readableReportNotOlderThanTheStoredOne_stateThenUpdatesThenPendingUpdatesThenHistoryThenItsLog() {
        // setup
        stubParsedReport(true);
        when(deviceOsStateService.saveIfNotOlder(deviceOsState)).thenReturn(true);
        when(deviceOsUpdateHistoryService.saveMissing(machine, historyEntries)).thenReturn(newHistoryEntries);
        InOrder inOrder = inOrder(deviceOsStateService, osUpdateService, deviceOsPendingUpdateService,
                deviceOsUpdateHistoryService, deviceOsUpdateHistoryLogService);

        // execution
        facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        inOrder.verify(deviceOsStateService).saveIfNotOlder(deviceOsState);
        inOrder.verify(osUpdateService).saveReported(osUpdates);
        inOrder.verify(deviceOsPendingUpdateService).replacePendingUpdates(machine, pendingUpdates);
        inOrder.verify(deviceOsUpdateHistoryService).saveMissing(machine, historyEntries);
        inOrder.verify(deviceOsUpdateHistoryLogService).logNewEntries(newHistoryEntries);
    }

    @Test
    void applyReport_everyHistoryEntryAlreadyStored_nothingButAnEmptyListHandedToTheLog() {
        // setup
        List<DeviceOsUpdateHistoryEntry> nothingNew = List.of();
        stubParsedReport(true);
        when(deviceOsStateService.saveIfNotOlder(deviceOsState)).thenReturn(true);
        when(deviceOsUpdateHistoryService.saveMissing(machine, historyEntries)).thenReturn(nothingNew);

        // execution
        facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        verify(deviceOsUpdateHistoryLogService).logNewEntries(nothingNew);
    }

    @Test
    void applyReport_reportOlderThanTheStoredOne_nothingButTheStateAttempt_noPendingUpdatesHistoryOrLogTouched() {
        // setup
        stubParsedReport(true);
        when(deviceOsStateService.saveIfNotOlder(deviceOsState)).thenReturn(false);

        // execution
        facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        verify(deviceOsStateService).saveIfNotOlder(deviceOsState);
        verifyNoInteractions(osUpdateService, deviceOsPendingUpdateService, deviceOsUpdateHistoryService,
                deviceOsUpdateHistoryLogService);
    }

    @Test
    void applyReport_deviceCouldNotReadItsUpdates_stateAndHistorySavedAndLoggedAndThePendingUpdatesLeftAlone() {
        // setup
        stubParsedReport(false);
        when(deviceOsStateService.saveIfNotOlder(deviceOsState)).thenReturn(true);
        when(deviceOsUpdateHistoryService.saveMissing(machine, historyEntries)).thenReturn(newHistoryEntries);

        // execution
        facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        verify(deviceOsStateService).saveIfNotOlder(deviceOsState);
        verify(deviceOsUpdateHistoryService).saveMissing(machine, historyEntries);
        verify(deviceOsUpdateHistoryLogService).logNewEntries(newHistoryEntries);
        verifyNoInteractions(osUpdateService, deviceOsPendingUpdateService);
    }

    @Test
    void applyReport_unknownMachine_ignoredWithoutParsingOrSaving() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        verifyNoInteractions(deviceOsReportParser, deviceOsStateService, osUpdateService,
                deviceOsPendingUpdateService, deviceOsUpdateHistoryService, deviceOsUpdateHistoryLogService);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void applyReport_machineInAFrozenStatus_ignoredWithoutParsingOrSaving(DeviceStatus frozen) {
        // setup
        machine.setStatus(frozen);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        verifyNoInteractions(deviceOsReportParser, deviceOsStateService, osUpdateService,
                deviceOsPendingUpdateService, deviceOsUpdateHistoryService, deviceOsUpdateHistoryLogService);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, mode = EnumSource.Mode.EXCLUDE,
            names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void applyReport_machineInAnyOtherStatus_reportApplied(DeviceStatus status) {
        // setup
        machine.setStatus(status);
        stubParsedReport(true);
        when(deviceOsStateService.saveIfNotOlder(deviceOsState)).thenReturn(true);

        // execution
        facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        verify(deviceOsStateService).saveIfNotOlder(deviceOsState);
    }

    @Test
    void applyReport_malformedReport_exceptionPassedOnAndNothingSaved() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(deviceOsReportParser.parse(machine, PAYLOAD, RECEIVED_AT))
                .thenThrow(new MalformedDeviceOsReportException("OS report is empty"));

        // execution
        MalformedDeviceOsReportException ex = assertThrows(MalformedDeviceOsReportException.class,
                () -> facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("OS report is empty");
        verifyNoInteractions(deviceOsStateService, osUpdateService,
                deviceOsPendingUpdateService, deviceOsUpdateHistoryService, deviceOsUpdateHistoryLogService);
    }

    @Test
    void applyReport_pendingUpdatesFailToSave_failurePassedOnBeforeTheHistory() {
        // setup
        stubParsedReport(true);
        when(deviceOsStateService.saveIfNotOlder(deviceOsState)).thenReturn(true);
        IllegalStateException mongoDown = new IllegalStateException("mongo is down");
        doThrow(mongoDown)
                .when(deviceOsPendingUpdateService).replacePendingUpdates(machine, pendingUpdates);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("mongo is down");
        verifyNoInteractions(deviceOsUpdateHistoryService, deviceOsUpdateHistoryLogService);
    }

    @Test
    void applyReport_historyFailsToSave_failurePassedOnAndNothingLogged() {
        // setup
        stubParsedReport(true);
        when(deviceOsStateService.saveIfNotOlder(deviceOsState)).thenReturn(true);
        when(deviceOsUpdateHistoryService.saveMissing(machine, historyEntries))
                .thenThrow(new IllegalStateException("mongo is down"));

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("mongo is down");
        verifyNoInteractions(deviceOsUpdateHistoryLogService);
    }

    @Test
    void applyReport_logOfTheNewEntriesFails_failurePassedOnSoTheReportIsNotAcknowledged() {
        // setup
        stubParsedReport(true);
        when(deviceOsStateService.saveIfNotOlder(deviceOsState)).thenReturn(true);
        when(deviceOsUpdateHistoryService.saveMissing(machine, historyEntries)).thenReturn(newHistoryEntries);
        doThrow(new IllegalStateException("kafka is down"))
                .when(deviceOsUpdateHistoryLogService).logNewEntries(newHistoryEntries);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("kafka is down");
    }

    @Test
    void applyReport_readableReportNotOlderThanTheStoredOne_outcomeAppliedAndTheReportRecordedAsApplied() {
        // setup
        DeviceOsReport deviceOsReport = stubParsedReport(true);
        when(deviceOsStateService.saveIfNotOlder(deviceOsState)).thenReturn(true);
        when(deviceOsUpdateHistoryService.saveMissing(machine, historyEntries)).thenReturn(newHistoryEntries);

        // execution
        DeviceOsReportOutcome outcome = facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        assertThat(outcome).isEqualTo(DeviceOsReportOutcome.APPLIED);
        verify(deviceOsReportMetrics).recordApplied(deviceOsReport);
    }

    @Test
    void applyReport_reportOlderThanTheStoredOne_outcomeIgnoredOlderAndNotRecordedAsApplied() {
        // setup
        stubParsedReport(true);
        when(deviceOsStateService.saveIfNotOlder(deviceOsState)).thenReturn(false);

        // execution
        DeviceOsReportOutcome outcome = facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        assertThat(outcome).isEqualTo(DeviceOsReportOutcome.IGNORED_OLDER);
        verifyNoInteractions(deviceOsReportMetrics);
    }

    @Test
    void applyReport_unknownMachine_outcomeUnknownMachineAndNotRecordedAsApplied() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        DeviceOsReportOutcome outcome = facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        assertThat(outcome).isEqualTo(DeviceOsReportOutcome.UNKNOWN_MACHINE);
        verifyNoInteractions(deviceOsReportMetrics);
    }

    @Test
    void applyReport_machineInAFrozenStatus_outcomeFrozenMachineAndNotRecordedAsApplied() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        DeviceOsReportOutcome outcome = facade.applyReport(MACHINE_ID, PAYLOAD, RECEIVED_AT);

        // verifications
        assertThat(outcome).isEqualTo(DeviceOsReportOutcome.FROZEN_MACHINE);
        verifyNoInteractions(deviceOsReportMetrics);
    }

    private DeviceOsReport stubParsedReport(boolean pendingUpdatesReadable) {
        DeviceOsReport deviceOsReport = DeviceOsReport.builder()
                .deviceOsState(deviceOsState)
                .pendingUpdatesReadable(pendingUpdatesReadable)
                .osUpdates(osUpdates)
                .pendingUpdates(pendingUpdates)
                .historyEntries(historyEntries)
                .build();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(deviceOsReportParser.parse(machine, PAYLOAD, RECEIVED_AT)).thenReturn(deviceOsReport);
        return deviceOsReport;
    }
}
