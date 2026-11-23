package com.openframe.client.service.rmm;

import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.chocolatey.ChocolateyAdminOption;
import com.openframe.data.document.device.chocolatey.ChocolateyDecision;
import com.openframe.data.document.device.chocolatey.ChocolateyStatus;
import com.openframe.data.document.device.chocolatey.MachineChocolatey;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;
import com.openframe.data.nats.rmm.model.MachinePackageManagersMessage;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.stream.Stream;

import static com.openframe.data.document.packagesearch.PackageManagerState.MISSING;
import static com.openframe.data.document.packagesearch.PackageManagerState.PRESENT;
import static com.openframe.data.document.packagesearch.PackageManagerState.UNSUPPORTED;
import static com.openframe.data.document.packagesearch.PackageManagerType.BREW;
import static com.openframe.data.document.packagesearch.PackageManagerType.CHOCO;
import static com.openframe.data.document.packagesearch.PackageManagerType.WINGET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachinePackageManagersServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String CHOCO_VERSION = "2.7.5";
    private static final String CHOCO_EDITION = "OPEN_SOURCE";
    private static final String VERSION_1 = "VERSION_1";
    private static final String LICENSED_EDITION = "LICENSED_EDITION";
    private static final String UPGRADE_BLOCKED = "UPGRADE_BLOCKED";
    private static final String CHOCOLATEY_PATH = "chocolatey";
    private static final String CHOCOLATEY_DECISION_PATH = "chocolateyDecision";
    private static final String DECIDED_BY = "user-1";
    private static final Instant DECIDED_AT = Instant.parse("2026-11-20T10:15:30Z");

    @Mock private MachineRepository machineRepository;
    @Mock private MachineWriter machineWriter;
    @Mock private PackageManagerBootstrapService bootstrapService;

    @Captor private ArgumentCaptor<MachineUpdate> updateCaptor;

    private PackageManagerProperties packageManagerProperties;
    private MachinePackageManagersService service;

    private Machine machine;

    @BeforeEach
    void setUp() {
        packageManagerProperties = new PackageManagerProperties();
        service = new MachinePackageManagersService(machineRepository, machineWriter, packageManagerProperties, bootstrapService);
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(DeviceStatus.ONLINE);
    }

    @Test
    void apply_unknownMachine_ignored() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        service.apply(MACHINE_ID, report(Map.of("BREW", MISSING)));

        // verifications
        verifyNoInteractions(machineWriter, bootstrapService);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED"})
    void apply_goneMachine_ignored(DeviceStatus status) {
        // setup
        machine.setStatus(status);
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("BREW", MISSING)));

        // verifications
        verifyNoInteractions(machineWriter, bootstrapService);
    }

    @Test
    void apply_changedSnapshot_writtenAsOneField() {
        // setup
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("BREW", UNSUPPORTED, "WINGET", UNSUPPORTED, "CHOCO", MISSING)));

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getPackageManagers())
                .containsOnly(entry(BREW, UNSUPPORTED), entry(WINGET, UNSUPPORTED), entry(CHOCO, MISSING));
        assertThat(updateCaptor.getValue().paths()).containsExactly("packageManagers");
    }

    @Test
    void apply_unchangedSnapshot_notWritten() {
        // setup
        machine.setPackageManagers(Map.of(BREW, PRESENT, WINGET, UNSUPPORTED, CHOCO, UNSUPPORTED));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("BREW", PRESENT, "WINGET", UNSUPPORTED, "CHOCO", UNSUPPORTED)));

        // verifications
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_missingEnabledManager_bootstrapped() {
        // setup
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("BREW", MISSING, "WINGET", UNSUPPORTED, "CHOCO", UNSUPPORTED)));

        // verifications
        verify(bootstrapService).dispatchInstall(MACHINE_ID, BREW);
        verify(bootstrapService, never()).dispatchInstall(MACHINE_ID, WINGET);
        verify(bootstrapService, never()).dispatchInstall(MACHINE_ID, CHOCO);
    }

    @Test
    void apply_missingDisabledChoco_notBootstrapped() {
        // setup
        packageManagerProperties.setChocoEnabled(false);
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("CHOCO", MISSING)));

        // verifications
        verify(bootstrapService, never()).dispatchInstall(MACHINE_ID, CHOCO);
    }

    @Test
    void apply_missingEnabledChoco_bootstrapped() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("CHOCO", MISSING)));

        // verifications
        verify(bootstrapService).dispatchInstall(MACHINE_ID, CHOCO);
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"PRESENT", "UNSUPPORTED", "UNKNOWN"})
    void apply_nonMissingState_notBootstrapped(PackageManagerState state) {
        // setup
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("BREW", state)));

        // verifications
        verify(bootstrapService, never()).dispatchInstall(MACHINE_ID, BREW);
    }

    @Test
    void apply_unknownManagerKey_skippedRestApplied() {
        // setup
        stubMachine();
        Map<String, PackageManagerState> reported = new HashMap<>();
        reported.put("APT", MISSING);
        reported.put("BREW", PRESENT);

        // execution
        service.apply(MACHINE_ID, report(reported));

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getPackageManagers()).containsOnly(entry(BREW, PRESENT));
        verify(bootstrapService, never()).dispatchInstall(eq(MACHINE_ID), any(PackageManagerType.class));
    }

    @Test
    void apply_nullState_skippedRestApplied() {
        // setup
        stubMachine();
        Map<String, PackageManagerState> reported = new HashMap<>();
        reported.put("BREW", null);
        reported.put("WINGET", UNSUPPORTED);

        // execution
        service.apply(MACHINE_ID, report(reported));

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getPackageManagers()).containsOnly(entry(WINGET, UNSUPPORTED));
    }

    @Test
    void apply_missingDependency_bootstrappedWithItsOwnScript() {
        // setup
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("WINGET", PRESENT), dependency("WINGET_CLIENT_MODULE", MISSING)));

        // verifications
        verify(bootstrapService).dispatchInstall(MACHINE_ID, WINGET, SystemScriptCode.INSTALL_WINGET_CLIENT_MODULE);
        verify(bootstrapService, never()).dispatchInstall(MACHINE_ID, WINGET);
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"PRESENT", "UNSUPPORTED", "UNKNOWN"})
    void apply_nonMissingDependency_notBootstrapped(PackageManagerState state) {
        // setup
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("WINGET", PRESENT), dependency("WINGET_CLIENT_MODULE", state)));

        // verifications
        verify(bootstrapService, never()).dispatchInstall(eq(MACHINE_ID), any(), any());
    }

    @Test
    void apply_unknownDependency_skipped() {
        // setup
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("WINGET", PRESENT), dependency("WINGET_SOURCE_CACHE", MISSING)));

        // verifications
        verify(bootstrapService, never()).dispatchInstall(eq(MACHINE_ID), any(), any());
    }

    @Test
    void apply_chocolateyReportedNothingStored_writtenAsOneField() {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", VERSION_1)));

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getChocolatey())
                .usingRecursiveComparison()
                .ignoringCollectionOrder()
                .isEqualTo(MachineChocolatey.builder()
                        .version(CHOCO_VERSION)
                        .edition(CHOCO_EDITION)
                        .ours(true)
                        .status(ChocolateyStatus.ACTION_REQUIRED)
                        .reason(VERSION_1)
                        .packages(List.of("7zip", "GoogleChrome"))
                        .existingPackages(List.of("git", "vlc"))
                        .build());
        assertThat(updateCaptor.getValue().paths()).containsExactly(CHOCOLATEY_PATH);
    }

    @ParameterizedTest
    @CsvSource({
            "MANAGED, MANAGED",
            "UPGRADE_REQUIRED, UPGRADE_REQUIRED",
            "ACTION_REQUIRED, ACTION_REQUIRED",
            "QUARANTINED, UNKNOWN",
            "managed, UNKNOWN",
            ", UNKNOWN"
    })
    void apply_chocolateyStatus_storedThroughFromWire(String wireStatus, ChocolateyStatus expected) {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey(wireStatus, null)));

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getChocolatey()).extracting(MachineChocolatey::getStatus).isEqualTo(expected);
    }

    @ParameterizedTest
    @MethodSource("storedChocolateyDifferingInOneField")
    void apply_storedChocolateyDiffersInOneField_written(MachineChocolatey stored) {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored);
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", VERSION_1)));

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getChocolatey())
                .usingRecursiveComparison()
                .ignoringCollectionOrder()
                .isEqualTo(stored(ChocolateyStatus.ACTION_REQUIRED, VERSION_1));
        assertThat(updateCaptor.getValue().paths()).containsExactly(CHOCOLATEY_PATH);
    }

    @Test
    void apply_chocolateySameContentListsInOtherOrder_notWritten() {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.MANAGED, null));
        stubMachine();
        MachinePackageManagersMessage.Chocolatey reported = chocolatey("MANAGED", null);
        reported.setPackages(List.of("GoogleChrome", "7zip"));
        reported.setExistingPackages(List.of("vlc", "git"));

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), reported));

        // verifications
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_storedListsNullReportedListsEmpty_notWritten() {
        // setup
        MachineChocolatey stored = stored(ChocolateyStatus.MANAGED, null);
        stored.setPackages(null);
        stored.setExistingPackages(null);
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored);
        stubMachine();
        MachinePackageManagersMessage.Chocolatey reported = chocolatey("MANAGED", null);
        reported.setPackages(List.of());
        reported.setExistingPackages(List.of());

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), reported));

        // verifications
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_reportedListsNullStoredListsEmpty_notWritten() {
        // setup
        MachineChocolatey stored = stored(ChocolateyStatus.MANAGED, null);
        stored.setPackages(List.of());
        stored.setExistingPackages(List.of());
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored);
        stubMachine();
        MachinePackageManagersMessage.Chocolatey reported = chocolatey("MANAGED", null);
        reported.setPackages(null);
        reported.setExistingPackages(null);

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), reported));

        // verifications
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_chocoPresentWithoutObject_storedChocolateyCleared() {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.MANAGED, null));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("CHOCO", PRESENT)));

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly(CHOCOLATEY_PATH);
        assertThat(afterWrites().getChocolatey()).isNull();
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"MISSING", "UNSUPPORTED"})
    void apply_chocoNotPresent_storedChocolateyCleared(PackageManagerState state) {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, state));
        machine.setChocolatey(stored(ChocolateyStatus.MANAGED, null));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", state), chocolatey("MANAGED", null)));

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly(CHOCOLATEY_PATH);
        assertThat(afterWrites().getChocolatey()).isNull();
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"MISSING", "UNSUPPORTED"})
    void apply_chocoNotPresentNothingStored_reportedObjectNotWritten(PackageManagerState state) {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, state));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", state), chocolatey("MANAGED", null)));

        // verifications
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_nothingStoredAndNoObject_chocolateyNotWritten() {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("CHOCO", PRESENT)));

        // verifications
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_upgradeRequiredChocoEnabled_upgradeDispatched() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("UPGRADE_REQUIRED", null)));

        // verifications
        verify(bootstrapService).dispatchChocolateyUpgrade(MACHINE_ID);
        verify(bootstrapService, never()).resendChocolateyUpgrade(MACHINE_ID);
    }

    @Test
    void apply_upgradeRequiredAlreadyStored_upgradeDispatchedAgain() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.UPGRADE_REQUIRED, null));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("UPGRADE_REQUIRED", null)));

        // verifications
        verify(bootstrapService).dispatchChocolateyUpgrade(MACHINE_ID);
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_upgradeRequiredChocoDisabled_upgradeNotDispatched() {
        // setup
        packageManagerProperties.setChocoEnabled(false);
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("UPGRADE_REQUIRED", null)));

        // verifications
        verify(bootstrapService, never()).dispatchChocolateyUpgrade(MACHINE_ID);
    }

    @ParameterizedTest
    @CsvSource({
            "ACTION_REQUIRED, VERSION_1",
            "MANAGED,",
            "QUARANTINED,"
    })
    void apply_statusNotUpgradeRequired_upgradeNotDispatched(String wireStatus, String reason) {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey(wireStatus, reason)));

        // verifications
        verify(bootstrapService, never()).dispatchChocolateyUpgrade(MACHINE_ID);
    }

    @Test
    void apply_upgradeRequiredChocoNotPresent_upgradeNotDispatched() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", UNSUPPORTED), chocolatey("UPGRADE_REQUIRED", null)));

        // verifications
        verify(bootstrapService, never()).dispatchChocolateyUpgrade(MACHINE_ID);
    }

    @Test
    void apply_reasonDiffersFromDecisionReason_decisionReset() {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, VERSION_1));
        machine.setChocolateyDecision(decision(VERSION_1, false));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", LICENSED_EDITION)));

        // verifications
        verify(machineWriter, atLeastOnce()).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getAllValues()).flatExtracting(MachineUpdate::paths).contains(CHOCOLATEY_DECISION_PATH);
        assertThat(afterWrites().getChocolateyDecision()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGED", "UPGRADE_REQUIRED", "QUARANTINED"})
    void apply_statusNoLongerActionRequired_decisionReset(String wireStatus) {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, VERSION_1));
        machine.setChocolateyDecision(decision(VERSION_1, false));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey(wireStatus, VERSION_1)));

        // verifications
        verify(machineWriter, atLeastOnce()).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getAllValues()).flatExtracting(MachineUpdate::paths).contains(CHOCOLATEY_DECISION_PATH);
        assertThat(afterWrites().getChocolateyDecision()).isNull();
    }

    @Test
    void apply_chocolateyObjectDisappeared_decisionReset() {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, VERSION_1));
        machine.setChocolateyDecision(decision(VERSION_1, false));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, report(Map.of("CHOCO", PRESENT)));

        // verifications
        verify(machineWriter, atLeastOnce()).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getAllValues()).flatExtracting(MachineUpdate::paths).contains(CHOCOLATEY_DECISION_PATH);
        assertThat(afterWrites().getChocolateyDecision()).isNull();
    }

    @Test
    void apply_chocoNoLongerPresent_decisionReset() {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, UNSUPPORTED));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, VERSION_1));
        machine.setChocolateyDecision(decision(VERSION_1, false));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", UNSUPPORTED), chocolatey("ACTION_REQUIRED", VERSION_1)));

        // verifications
        verify(machineWriter, atLeastOnce()).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getAllValues()).flatExtracting(MachineUpdate::paths).contains(CHOCOLATEY_DECISION_PATH);
        assertThat(afterWrites().getChocolateyDecision()).isNull();
    }

    @Test
    void apply_actionRequiredSameReason_decisionKept() {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, VERSION_1));
        machine.setChocolateyDecision(decision(VERSION_1, false));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", VERSION_1)));

        // verifications
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_actionRequiredSameReasonOtherFieldChanged_decisionKept() {
        // setup
        MachineChocolatey stored = stored(ChocolateyStatus.ACTION_REQUIRED, VERSION_1);
        stored.setVersion("1.4.0");
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored);
        machine.setChocolateyDecision(decision(VERSION_1, false));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", VERSION_1)));

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly(CHOCOLATEY_PATH);
    }

    @Test
    void apply_upgradeBlockedRetryPendingChocoEnabled_upgradeResent() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, UPGRADE_BLOCKED));
        machine.setChocolateyDecision(decision(UPGRADE_BLOCKED, true));
        stubMachine();
        when(bootstrapService.resendChocolateyUpgrade(MACHINE_ID)).thenReturn(true);

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", UPGRADE_BLOCKED)));

        // verifications
        verify(bootstrapService).resendChocolateyUpgrade(MACHINE_ID);
        verify(bootstrapService, never()).dispatchChocolateyUpgrade(MACHINE_ID);
    }

    @Test
    void apply_upgradeBlockedRetryPendingChocoEnabled_decisionWrittenBackWithoutRetryPending() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, UPGRADE_BLOCKED));
        machine.setChocolateyDecision(decision(UPGRADE_BLOCKED, true));
        stubMachine();
        when(bootstrapService.resendChocolateyUpgrade(MACHINE_ID)).thenReturn(true);

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", UPGRADE_BLOCKED)));

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getChocolateyDecision()).isEqualTo(decision(UPGRADE_BLOCKED, false));
        assertThat(updateCaptor.getValue().paths()).containsExactly(CHOCOLATEY_DECISION_PATH);
    }

    @Test
    void apply_upgradeBlockedRetryPendingResendSuppressed_retryStaysPending() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, UPGRADE_BLOCKED));
        machine.setChocolateyDecision(decision(UPGRADE_BLOCKED, true));
        stubMachine();
        when(bootstrapService.resendChocolateyUpgrade(MACHINE_ID)).thenReturn(false);

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", UPGRADE_BLOCKED)));

        // verifications
        verify(bootstrapService).resendChocolateyUpgrade(MACHINE_ID);
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
        assertThat(machine.getChocolateyDecision().isUpgradeRetryPending()).isTrue();
    }

    @Test
    void apply_upgradeBlockedRetryNotPending_noResendNoDecisionWrite() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, UPGRADE_BLOCKED));
        machine.setChocolateyDecision(decision(UPGRADE_BLOCKED, false));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", UPGRADE_BLOCKED)));

        // verifications
        verify(bootstrapService, never()).resendChocolateyUpgrade(MACHINE_ID);
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_upgradeBlockedRetryPendingChocoDisabled_noResendRetryStaysPending() {
        // setup
        packageManagerProperties.setChocoEnabled(false);
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, UPGRADE_BLOCKED));
        machine.setChocolateyDecision(decision(UPGRADE_BLOCKED, true));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", UPGRADE_BLOCKED)));

        // verifications
        verify(bootstrapService, never()).resendChocolateyUpgrade(MACHINE_ID);
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_upgradeBlockedNoStoredDecision_noResend() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, UPGRADE_BLOCKED));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", UPGRADE_BLOCKED)));

        // verifications
        verify(bootstrapService, never()).resendChocolateyUpgrade(MACHINE_ID);
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_otherReasonRetryPending_noResend() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, VERSION_1));
        machine.setChocolateyDecision(decision(VERSION_1, true));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", VERSION_1)));

        // verifications
        verify(bootstrapService, never()).resendChocolateyUpgrade(MACHINE_ID);
    }

    @Test
    void apply_upgradeBlockedDecisionOfOtherReasonRetryPending_noResend() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        machine.setPackageManagers(Map.of(CHOCO, PRESENT));
        machine.setChocolatey(stored(ChocolateyStatus.ACTION_REQUIRED, VERSION_1));
        machine.setChocolateyDecision(decision(VERSION_1, true));
        stubMachine();

        // execution
        service.apply(MACHINE_ID, chocolateyReport(Map.of("CHOCO", PRESENT), chocolatey("ACTION_REQUIRED", UPGRADE_BLOCKED)));

        // verifications
        verify(bootstrapService, never()).resendChocolateyUpgrade(MACHINE_ID);
    }

    @Test
    void apply_bootstrapDispatchFails_chocolateyAlreadyStored() {
        // setup
        machine.setPackageManagers(Map.of(CHOCO, PRESENT, WINGET, MISSING));
        machine.setChocolatey(stored(ChocolateyStatus.MANAGED, null));
        stubMachine();
        doThrow(new IllegalStateException("publish failed")).when(bootstrapService).dispatchInstall(MACHINE_ID, WINGET);

        // execution
        assertThatThrownBy(() -> service.apply(MACHINE_ID, chocolateyReport(
                Map.of("CHOCO", PRESENT, "WINGET", MISSING), chocolatey("ACTION_REQUIRED", "PINNED"))))
                .isInstanceOf(IllegalStateException.class);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        assertThat(updateCaptor.getValue().paths()).containsExactly(CHOCOLATEY_PATH);
        assertThat(afterWrites().getChocolatey().getStatus()).isEqualTo(ChocolateyStatus.ACTION_REQUIRED);
    }

    private void stubMachine() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }

    private static MachinePackageManagersMessage report(Map<String, PackageManagerState> packageManagers) {
        MachinePackageManagersMessage report = new MachinePackageManagersMessage();
        report.setPackageManagers(packageManagers);
        return report;
    }

    private static MachinePackageManagersMessage report(Map<String, PackageManagerState> packageManagers,
                                                        MachinePackageManagersMessage.Dependency dependency) {
        MachinePackageManagersMessage report = report(packageManagers);
        report.setDependencies(List.of(dependency));
        return report;
    }

    private static MachinePackageManagersMessage.Dependency dependency(String name, PackageManagerState state) {
        MachinePackageManagersMessage.Dependency dependency = new MachinePackageManagersMessage.Dependency();
        dependency.setName(name);
        dependency.setState(state);
        return dependency;
    }

    private Machine afterWrites() {
        updateCaptor.getAllValues().forEach(update -> update.applyTo(machine));
        return machine;
    }

    private static MachinePackageManagersMessage chocolateyReport(Map<String, PackageManagerState> packageManagers,
                                                                  MachinePackageManagersMessage.Chocolatey chocolatey) {
        MachinePackageManagersMessage report = report(packageManagers);
        report.setChocolatey(chocolatey);
        return report;
    }

    private static MachinePackageManagersMessage.Chocolatey chocolatey(String status, String reason) {
        MachinePackageManagersMessage.Chocolatey chocolatey = new MachinePackageManagersMessage.Chocolatey();
        chocolatey.setVersion(CHOCO_VERSION);
        chocolatey.setEdition(CHOCO_EDITION);
        chocolatey.setOurs(true);
        chocolatey.setStatus(status);
        chocolatey.setReason(reason);
        chocolatey.setPackages(List.of("7zip", "GoogleChrome"));
        chocolatey.setExistingPackages(List.of("git", "vlc"));
        return chocolatey;
    }

    private static MachineChocolatey stored(ChocolateyStatus status, String reason) {
        return MachineChocolatey.builder()
                .version(CHOCO_VERSION)
                .edition(CHOCO_EDITION)
                .ours(true)
                .status(status)
                .reason(reason)
                .packages(List.of("7zip", "GoogleChrome"))
                .existingPackages(List.of("git", "vlc"))
                .build();
    }

    private static MachineChocolatey storedWith(Consumer<MachineChocolatey> difference) {
        MachineChocolatey stored = stored(ChocolateyStatus.ACTION_REQUIRED, VERSION_1);
        difference.accept(stored);
        return stored;
    }

    private static Stream<Arguments> storedChocolateyDifferingInOneField() {
        return Stream.of(
                Arguments.of(storedWith(stored -> stored.setVersion("1.4.0"))),
                Arguments.of(storedWith(stored -> stored.setVersion(null))),
                Arguments.of(storedWith(stored -> stored.setEdition("LICENSED"))),
                Arguments.of(storedWith(stored -> stored.setOurs(false))),
                Arguments.of(storedWith(stored -> stored.setStatus(ChocolateyStatus.MANAGED))),
                Arguments.of(storedWith(stored -> stored.setReason(LICENSED_EDITION))),
                Arguments.of(storedWith(stored -> stored.setReason(null))),
                Arguments.of(storedWith(stored -> stored.setPackages(List.of("7zip")))),
                Arguments.of(storedWith(stored -> stored.setPackages(null))),
                Arguments.of(storedWith(stored -> stored.setExistingPackages(List.of("git", "vlc", "putty")))),
                Arguments.of(storedWith(stored -> stored.setExistingPackages(List.of())))
        );
    }

    private static ChocolateyDecision decision(String reason, boolean upgradeRetryPending) {
        return ChocolateyDecision.builder()
                .option(ChocolateyAdminOption.ADMIN_FIXES)
                .reason(reason)
                .decidedAt(DECIDED_AT)
                .decidedBy(DECIDED_BY)
                .upgradeRetryPending(upgradeRetryPending)
                .build();
    }
}
