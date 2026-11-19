package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateManagedElsewhereReason;
import com.openframe.data.document.rmm.osupdate.OsUpdateManagementState;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Criteria;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineOsUpdatesServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String TENANT_ID = "tenant-1";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-19T10:15:02.417Z");
    private static final Instant LAST_SCAN_AT = Instant.parse("2026-11-19T10:14:51Z");
    private static final Instant EARLIER = Instant.parse("2026-11-12T08:00:00Z");
    private static final Instant STORED_INSTALL = Instant.parse("2026-10-16T02:41:10Z");
    private static final Instant REPORTED_INSTALL = Instant.parse("2026-11-20T02:41:10Z");
    private static final Set<OsUpdateInstallResult> SUCCEEDED_RESULTS =
            Set.of(OsUpdateInstallResult.SUCCEEDED, OsUpdateInstallResult.SUCCEEDED_WITH_ERRORS);

    @Mock private MachineRepository machineRepository;
    @Mock private MachineWriter machineWriter;
    @Mock private DeviceOsUpdateRepository deviceOsUpdateRepository;
    @Mock private DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    @Mock private OsUpdateReportMapper osUpdateReportMapper;

    @Captor private ArgumentCaptor<Criteria> guardCaptor;
    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;
    @Captor private ArgumentCaptor<Collection<DeviceOsUpdate>> savedCaptor;

    @InjectMocks private MachineOsUpdatesService service;

    private Machine machine;
    private MachineOsUpdatesMessage report;
    private MachineOsUpdatesMessage.OsState reportedState;
    private List<MachineOsUpdatesMessage.PendingUpdate> reportedPending;
    private List<DeviceOsUpdateHistoryEntry> history;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setTenantId(TENANT_ID);
        machine.setStatus(DeviceStatus.ONLINE);

        reportedState = new MachineOsUpdatesMessage.OsState();
        reportedState.setOsVersion("Windows 11 Pro");
        reportedState.setOsBuild("26100.4061");
        reportedState.setRestartPending(false);
        reportedState.setLastScanAt(LAST_SCAN_AT);
        report = new MachineOsUpdatesMessage();
        report.setOsState(reportedState);

        reportedPending = List.of(new MachineOsUpdatesMessage.PendingUpdate());
        history = new ArrayList<>();
    }

    @Test
    void apply_unknownMachine_nothingStored() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verifyNoInteractions(machineWriter, deviceOsUpdateRepository, deviceOsUpdateHistoryRepository,
                osUpdateReportMapper);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void apply_frozenMachine_nothingStored(DeviceStatus frozen) {
        // setup
        machine.setStatus(frozen);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verifyNoInteractions(machineWriter, deviceOsUpdateRepository, deviceOsUpdateHistoryRepository,
                osUpdateReportMapper);
    }

    @Test
    void apply_report_versionBuildAndStateWrittenAsReported() {
        // setup
        stubStateWritten();
        reportedState.setLastScanError("0x80072EE2");
        reportedState.setManagementState(OsUpdateManagementState.MANAGED_ELSEWHERE);
        reportedState.setManagedElsewhereReason(OsUpdateManagedElsewhereReason.WSUS);
        reportedState.setOsUpdateAuthorization(OsUpdateAuthorization.NOT_REQUIRED);
        DeviceOsState expected = DeviceOsState.builder()
                .restartPending(false)
                .lastScanAt(LAST_SCAN_AT)
                .lastScanError("0x80072EE2")
                .managementState(OsUpdateManagementState.MANAGED_ELSEWHERE)
                .managedElsewhereReason(OsUpdateManagedElsewhereReason.WSUS)
                .authorization(OsUpdateAuthorization.NOT_REQUIRED)
                .receivedAt(RECEIVED_AT)
                .build();

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        assertThat(updateCaptor.getValue().paths()).containsExactly("osVersion", "osBuild", "osState");
        assertThat(written.getOsVersion()).isEqualTo("Windows 11 Pro");
        assertThat(written.getOsBuild()).isEqualTo("26100.4061");
        assertThat(written.getOsState()).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void apply_reportWithoutVersionAndBuild_storedVersionAndBuildNotTouched(String absent) {
        // setup
        stubStateWritten();
        reportedState.setOsVersion(absent);
        reportedState.setOsBuild(absent);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        assertThat(updateCaptor.getValue().paths()).containsExactly("osState");
    }

    @Test
    void apply_reportWithVersionButNoBuild_onlyTheVersionWritten() {
        // setup
        stubStateWritten();
        reportedState.setOsBuild(null);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        assertThat(updateCaptor.getValue().paths()).containsExactly("osVersion", "osState");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " "})
    void apply_blankScanError_storedAsNoError(String blank) {
        // setup
        stubStateWritten();
        reportedState.setLastScanError(blank);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        assertThat(written.getOsState().getLastScanError()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " "})
    void apply_pendingListWithABlankScanError_storedListReplaced(String blank) {
        // setup
        stubStateWritten();
        reportedState.setLastScanError(blank);
        report.setPendingUpdates(List.of());
        List<DeviceOsUpdate> stored = List.of(pending("id-1", "k-1", "One", EARLIER));
        when(osUpdateReportMapper.toPendingUpdates(TENANT_ID, MACHINE_ID, List.of(), LAST_SCAN_AT))
                .thenReturn(List.of());
        when(deviceOsUpdateRepository.findByTenantIdAndMachineIdOrderByDiscoveredAtDescTitleAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(stored);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verify(deviceOsUpdateRepository).deleteByTenantIdAndIdIn(TENANT_ID, List.of("id-1"));
    }

    @Test
    void apply_report_writtenOnlyWhileTheStoredReportIsNotNewer() {
        // setup
        stubStateWritten();
        Document neverReceived = new Document("osState.receivedAt", null);
        Document receivedEarlier = new Document("osState.receivedAt", new Document("$lte", RECEIVED_AT));
        Document expectedGuard = new Document("$or", List.of(neverReceived, receivedEarlier));

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        assertThat(guardCaptor.getValue().getCriteriaObject()).isEqualTo(expectedGuard);
    }

    @Test
    void apply_newerReportAlreadyApplied_noRowsTouched() {
        // setup
        stubStateLookups();
        when(machineWriter.update(eq(MACHINE_ID), guardCaptor.capture(), updateCaptor.capture()))
                .thenReturn(Optional.empty());
        report.setPendingUpdates(reportedPending);
        history.add(historyEntry("k-1", REPORTED_INSTALL, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED));

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verifyNoInteractions(deviceOsUpdateRepository);
        verifyNoMoreInteractions(deviceOsUpdateHistoryRepository, osUpdateReportMapper);
    }

    @Test
    void apply_pendingListOfASuccessfulScan_newInsertedChangedUpdatedWithdrawnDeleted() {
        // setup
        stubStateWritten();
        report.setPendingUpdates(reportedPending);
        DeviceOsUpdate storedKept = pending("id-kept", "k-kept", "Kept", EARLIER);
        DeviceOsUpdate storedChanged = pending("id-changed", "k-changed", "Old title", EARLIER);
        DeviceOsUpdate storedWithdrawn = pending("id-withdrawn", "k-withdrawn", "Withdrawn", EARLIER);
        DeviceOsUpdate reportedKept = pending(null, "k-kept", "Kept", LAST_SCAN_AT);
        DeviceOsUpdate reportedChanged = pending(null, "k-changed", "New title", LAST_SCAN_AT);
        DeviceOsUpdate reportedNew = pending(null, "k-new", "New", LAST_SCAN_AT);
        List<DeviceOsUpdate> stored = List.of(storedKept, storedChanged, storedWithdrawn);
        List<DeviceOsUpdate> reported = List.of(reportedKept, reportedChanged, reportedNew);
        when(osUpdateReportMapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reportedPending, LAST_SCAN_AT))
                .thenReturn(reported);
        when(deviceOsUpdateRepository.findByTenantIdAndMachineIdOrderByDiscoveredAtDescTitleAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(stored);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verify(deviceOsUpdateRepository).saveAll(savedCaptor.capture());
        assertThat(savedCaptor.getValue())
                .extracting(DeviceOsUpdate::getId, DeviceOsUpdate::getUpdateKey, DeviceOsUpdate::getTitle,
                        DeviceOsUpdate::getDiscoveredAt)
                .containsExactly(
                        tuple("id-changed", "k-changed", "New title", EARLIER),
                        tuple(null, "k-new", "New", LAST_SCAN_AT));
        verify(deviceOsUpdateRepository).deleteByTenantIdAndIdIn(TENANT_ID, List.of("id-withdrawn"));
    }

    @Test
    void apply_emptyPendingListOfASuccessfulScan_everyStoredRowDeleted() {
        // setup
        stubStateWritten();
        report.setPendingUpdates(List.of());
        List<DeviceOsUpdate> stored = List.of(pending("id-1", "k-1", "One", EARLIER));
        when(osUpdateReportMapper.toPendingUpdates(TENANT_ID, MACHINE_ID, List.of(), LAST_SCAN_AT))
                .thenReturn(List.of());
        when(deviceOsUpdateRepository.findByTenantIdAndMachineIdOrderByDiscoveredAtDescTitleAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(stored);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verify(deviceOsUpdateRepository).deleteByTenantIdAndIdIn(TENANT_ID, List.of("id-1"));
        verifyNoMoreInteractions(deviceOsUpdateRepository);
    }

    @Test
    void apply_pendingListSameAsStored_nothingSavedOrDeleted() {
        // setup
        stubStateWritten();
        report.setPendingUpdates(reportedPending);
        List<DeviceOsUpdate> stored = List.of(pending("id-1", "k-1", "One", EARLIER));
        List<DeviceOsUpdate> reported = List.of(pending(null, "k-1", "One", LAST_SCAN_AT));
        when(osUpdateReportMapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reportedPending, LAST_SCAN_AT))
                .thenReturn(reported);
        when(deviceOsUpdateRepository.findByTenantIdAndMachineIdOrderByDiscoveredAtDescTitleAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(stored);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verifyNoMoreInteractions(deviceOsUpdateRepository);
    }

    @Test
    void apply_pendingListAbsent_storedListKept() {
        // setup
        stubStateWritten();

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verifyNoInteractions(deviceOsUpdateRepository);
    }

    @Test
    void apply_pendingListWithAScanError_storedListKept() {
        // setup
        stubStateWritten();
        reportedState.setLastScanError("0x80072EE2");
        report.setPendingUpdates(List.of());

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verifyNoInteractions(deviceOsUpdateRepository);
    }

    @Test
    void apply_deviceNeverScanned_updatesDiscoveredWhenTheReportWasReceived() {
        // setup
        stubStateWritten();
        reportedState.setLastScanAt(null);
        report.setPendingUpdates(reportedPending);
        when(osUpdateReportMapper.toPendingUpdates(TENANT_ID, MACHINE_ID, reportedPending, RECEIVED_AT))
                .thenReturn(List.of());
        when(deviceOsUpdateRepository.findByTenantIdAndMachineIdOrderByDiscoveredAtDescTitleAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(List.of());

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verify(osUpdateReportMapper).toPendingUpdates(TENANT_ID, MACHINE_ID, reportedPending, RECEIVED_AT);
    }

    @Test
    void apply_historyPartlyStored_onlyTheUnseenEntriesInserted() {
        // setup
        stubStateWritten();
        DeviceOsUpdateHistoryEntry seen =
                historyEntry("k-seen", STORED_INSTALL, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED);
        DeviceOsUpdateHistoryEntry unseen =
                historyEntry("k-unseen", REPORTED_INSTALL, OsUpdateOperation.INSTALL, OsUpdateInstallResult.FAILED);
        history.add(seen);
        history.add(unseen);
        when(deviceOsUpdateHistoryRepository.findEntryKeys(TENANT_ID, MACHINE_ID, List.of("k-seen", "k-unseen")))
                .thenReturn(List.of("k-seen"));

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verify(deviceOsUpdateHistoryRepository).insert(List.of(unseen));
    }

    @Test
    void apply_historyAlreadyStored_nothingInserted() {
        // setup
        stubStateWritten();
        DeviceOsUpdateHistoryEntry seen =
                historyEntry("k-seen", STORED_INSTALL, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED);
        history.add(seen);
        when(deviceOsUpdateHistoryRepository.findEntryKeys(TENANT_ID, MACHINE_ID, List.of("k-seen")))
                .thenReturn(List.of("k-seen"));

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verifyNoMoreInteractions(deviceOsUpdateHistoryRepository);
    }

    @Test
    void apply_noHistoryInTheReport_storedHistoryNotRead() {
        // setup
        stubStateWritten();

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        verifyNoMoreInteractions(deviceOsUpdateHistoryRepository);
    }

    @ParameterizedTest
    @MethodSource("lastInstalledAtCases")
    void apply_storedAndReportedHistory_lastInstalledAtIsTheNewestSucceededInstall(
            Optional<DeviceOsUpdateHistoryEntry> stored, List<DeviceOsUpdateHistoryEntry> reported, Instant expected) {
        // setup
        history.addAll(reported);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(osUpdateReportMapper.toHistoryEntries(TENANT_ID, MACHINE_ID, null)).thenReturn(history);
        when(deviceOsUpdateHistoryRepository
                .findFirstByTenantIdAndMachineIdAndOperationAndResultInOrderByInstalledAtDesc(
                        TENANT_ID, MACHINE_ID, OsUpdateOperation.INSTALL, SUCCEEDED_RESULTS)).thenReturn(stored);
        when(machineWriter.update(eq(MACHINE_ID), guardCaptor.capture(), updateCaptor.capture()))
                .thenReturn(Optional.of(new MachineWriteResult(machine, machine)));

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        assertThat(written.getOsState().getLastInstalledAt()).isEqualTo(expected);
    }

    @Test
    void apply_nothingInstalledYet_lastInstalledAtNull() {
        // setup
        stubStateWritten();

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        assertThat(written.getOsState().getLastInstalledAt()).isNull();
    }

    @Test
    void apply_restartPendingFirstReported_sinceIsWhenTheReportWasReceived() {
        // setup
        stubStateWritten();
        machine.setOsState(DeviceOsState.builder().restartPending(false).build());
        reportedState.setRestartPending(true);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        assertThat(written.getOsState().getRestartPending()).isTrue();
        assertThat(written.getOsState().getRestartPendingSince()).isEqualTo(RECEIVED_AT);
    }

    @Test
    void apply_restartPendingOnADeviceThatNeverReported_sinceIsWhenTheReportWasReceived() {
        // setup
        stubStateWritten();
        reportedState.setRestartPending(true);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        assertThat(written.getOsState().getRestartPendingSince()).isEqualTo(RECEIVED_AT);
    }

    @Test
    void apply_restartStillPending_sinceKept() {
        // setup
        stubStateWritten();
        machine.setOsState(DeviceOsState.builder().restartPending(true).restartPendingSince(EARLIER).build());
        reportedState.setRestartPending(true);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        assertThat(written.getOsState().getRestartPendingSince()).isEqualTo(EARLIER);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(booleans = false)
    void apply_restartNoLongerPendingOrUnknown_sinceCleared(Boolean restartPending) {
        // setup
        stubStateWritten();
        machine.setOsState(DeviceOsState.builder().restartPending(true).restartPendingSince(EARLIER).build());
        reportedState.setRestartPending(restartPending);

        // execution
        service.apply(MACHINE_ID, report, RECEIVED_AT);

        // verifications
        Machine written = new Machine();
        updateCaptor.getValue().applyTo(written);
        assertThat(written.getOsState().getRestartPending()).isEqualTo(restartPending);
        assertThat(written.getOsState().getRestartPendingSince()).isNull();
    }

    private void stubStateLookups() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(osUpdateReportMapper.toHistoryEntries(TENANT_ID, MACHINE_ID, null)).thenReturn(history);
        when(deviceOsUpdateHistoryRepository
                .findFirstByTenantIdAndMachineIdAndOperationAndResultInOrderByInstalledAtDesc(
                        TENANT_ID, MACHINE_ID, OsUpdateOperation.INSTALL, SUCCEEDED_RESULTS)).thenReturn(Optional.empty());
    }

    private void stubStateWritten() {
        stubStateLookups();
        when(machineWriter.update(eq(MACHINE_ID), guardCaptor.capture(), updateCaptor.capture()))
                .thenReturn(Optional.of(new MachineWriteResult(machine, machine)));
    }

    private static DeviceOsUpdate pending(String id, String updateKey, String title, Instant discoveredAt) {
        return DeviceOsUpdate.builder()
                .id(id)
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .updateKey(updateKey)
                .title(title)
                .discoveredAt(discoveredAt)
                .build();
    }

    private static DeviceOsUpdateHistoryEntry historyEntry(String entryKey, Instant installedAt,
                                                           OsUpdateOperation operation, OsUpdateInstallResult result) {
        return DeviceOsUpdateHistoryEntry.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .entryKey(entryKey)
                .installedAt(installedAt)
                .operation(operation)
                .result(result)
                .build();
    }

    private static Stream<Arguments> lastInstalledAtCases() {
        DeviceOsUpdateHistoryEntry succeeded =
                historyEntry("k-ok", REPORTED_INSTALL, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED);
        DeviceOsUpdateHistoryEntry withErrors = historyEntry("k-errors", REPORTED_INSTALL, OsUpdateOperation.INSTALL,
                OsUpdateInstallResult.SUCCEEDED_WITH_ERRORS);
        DeviceOsUpdateHistoryEntry failed =
                historyEntry("k-failed", REPORTED_INSTALL, OsUpdateOperation.INSTALL, OsUpdateInstallResult.FAILED);
        DeviceOsUpdateHistoryEntry aborted =
                historyEntry("k-aborted", REPORTED_INSTALL, OsUpdateOperation.INSTALL, OsUpdateInstallResult.ABORTED);
        DeviceOsUpdateHistoryEntry uninstalled = historyEntry("k-uninstalled", REPORTED_INSTALL,
                OsUpdateOperation.UNINSTALL, OsUpdateInstallResult.SUCCEEDED);
        DeviceOsUpdateHistoryEntry unknownOperation =
                historyEntry("k-unknown", REPORTED_INSTALL, null, OsUpdateInstallResult.SUCCEEDED);
        DeviceOsUpdateHistoryEntry unknownResult =
                historyEntry("k-no-result", REPORTED_INSTALL, OsUpdateOperation.INSTALL, null);
        DeviceOsUpdateHistoryEntry olderThanStored =
                historyEntry("k-older", EARLIER, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED);
        Instant newerStoredInstall = REPORTED_INSTALL.plusSeconds(60);
        Optional<DeviceOsUpdateHistoryEntry> nothingStored = Optional.empty();
        Optional<DeviceOsUpdateHistoryEntry> stored = Optional.of(
                historyEntry("k-stored", STORED_INSTALL, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED));
        Optional<DeviceOsUpdateHistoryEntry> newerStored = Optional.of(historyEntry("k-newer-stored",
                newerStoredInstall, OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED));
        return Stream.of(
                Arguments.of(stored, List.of(succeeded), REPORTED_INSTALL),
                Arguments.of(stored, List.of(withErrors), REPORTED_INSTALL),
                Arguments.of(nothingStored, List.of(succeeded), REPORTED_INSTALL),
                Arguments.of(newerStored, List.of(succeeded, olderThanStored), newerStoredInstall),
                Arguments.of(stored, List.of(failed, aborted, uninstalled), STORED_INSTALL),
                Arguments.of(stored, List.of(unknownOperation, unknownResult), STORED_INSTALL),
                Arguments.of(nothingStored, List.of(failed), null));
    }
}
