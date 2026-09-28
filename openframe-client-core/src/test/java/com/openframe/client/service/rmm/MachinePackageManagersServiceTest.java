package com.openframe.client.service.rmm;

import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static com.openframe.data.document.packagesearch.PackageManagerState.MISSING;
import static com.openframe.data.document.packagesearch.PackageManagerState.PRESENT;
import static com.openframe.data.document.packagesearch.PackageManagerState.UNSUPPORTED;
import static com.openframe.data.document.packagesearch.PackageManagerType.BREW;
import static com.openframe.data.document.packagesearch.PackageManagerType.CHOCO;
import static com.openframe.data.document.packagesearch.PackageManagerType.WINGET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachinePackageManagersServiceTest {

    private static final String MACHINE_ID = "machine-1";

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
        service.apply(MACHINE_ID, Map.of("BREW", MISSING));

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
        service.apply(MACHINE_ID, Map.of("BREW", MISSING));

        // verifications
        verifyNoInteractions(machineWriter, bootstrapService);
    }

    @Test
    void apply_changedSnapshot_writtenAsOneField() {
        // setup
        stubMachine();

        // execution
        service.apply(MACHINE_ID, Map.of("BREW", UNSUPPORTED, "WINGET", UNSUPPORTED, "CHOCO", MISSING));

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
        service.apply(MACHINE_ID, Map.of("BREW", PRESENT, "WINGET", UNSUPPORTED, "CHOCO", UNSUPPORTED));

        // verifications
        verify(machineWriter, never()).update(eq(MACHINE_ID), any(MachineUpdate.class));
    }

    @Test
    void apply_missingEnabledManager_bootstrapped() {
        // setup
        stubMachine();

        // execution
        service.apply(MACHINE_ID, Map.of("BREW", MISSING, "WINGET", UNSUPPORTED, "CHOCO", UNSUPPORTED));

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
        service.apply(MACHINE_ID, Map.of("CHOCO", MISSING));

        // verifications
        verify(bootstrapService, never()).dispatchInstall(MACHINE_ID, CHOCO);
    }

    @Test
    void apply_missingEnabledChoco_bootstrapped() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        stubMachine();

        // execution
        service.apply(MACHINE_ID, Map.of("CHOCO", MISSING));

        // verifications
        verify(bootstrapService).dispatchInstall(MACHINE_ID, CHOCO);
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"PRESENT", "UNSUPPORTED", "UNKNOWN"})
    void apply_nonMissingState_notBootstrapped(PackageManagerState state) {
        // setup
        stubMachine();

        // execution
        service.apply(MACHINE_ID, Map.of("BREW", state));

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
        service.apply(MACHINE_ID, reported);

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
        service.apply(MACHINE_ID, reported);

        // verifications
        verify(machineWriter).update(eq(MACHINE_ID), updateCaptor.capture());
        Machine applied = new Machine();
        updateCaptor.getValue().applyTo(applied);
        assertThat(applied.getPackageManagers()).containsOnly(entry(WINGET, UNSUPPORTED));
    }

    private void stubMachine() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }
}
