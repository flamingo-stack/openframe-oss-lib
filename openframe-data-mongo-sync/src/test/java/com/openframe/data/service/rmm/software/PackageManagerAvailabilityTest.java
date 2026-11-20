package com.openframe.data.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.openframe.data.document.packagesearch.PackageManagerState.MISSING;
import static com.openframe.data.document.packagesearch.PackageManagerState.PRESENT;
import static com.openframe.data.document.packagesearch.PackageManagerState.UNSUPPORTED;
import static com.openframe.data.document.packagesearch.PackageManagerType.BREW;
import static com.openframe.data.document.packagesearch.PackageManagerType.CHOCO;
import static com.openframe.data.document.packagesearch.PackageManagerType.WINGET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageManagerAvailabilityTest {

    private static final String TENANT_ID = "tenant-1";

    @Mock private MachineRepository machineRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    private PackageManagerProperties packageManagerProperties;
    private PackageManagerAvailability availability;

    @BeforeEach
    void setUp() {
        packageManagerProperties = new PackageManagerProperties();
        availability = new PackageManagerAvailability(packageManagerProperties, machineRepository, tenantIdProvider);
    }

    @Test
    void enabledManagers_chocoDisabled_brewAndWingetOnly() {
        // setup
        packageManagerProperties.setChocoEnabled(false);

        // execution
        List<PackageManagerType> result = availability.enabledManagers();

        // verifications
        assertThat(result).containsExactly(BREW, WINGET);
    }

    @Test
    void enabledManagers_chocoEnabled_allThree() {
        // setup
        packageManagerProperties.setChocoEnabled(true);

        // execution
        List<PackageManagerType> result = availability.enabledManagers();

        // verifications
        assertThat(result).containsExactly(BREW, CHOCO, WINGET);
    }

    @Test
    void isSoftwareManageable_noReportYet_true() {
        // setup
        Machine machine = machine("m-silent", null);

        // execution
        boolean result = availability.isSoftwareManageable(machine);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void requireSoftwareManageable_emptyReport_passes() {
        // setup
        Machine silent = machine("m-silent", Map.of());
        stubMachines(Set.of("m-silent"), silent);
        List<String> machineIds = List.of("m-silent");
        List<PackageManagerType> managers = List.of(BREW);

        // execution
        Throwable execution = catchThrowable(
                () -> availability.requireSoftwareManageable(machineIds, managers));

        // verifications
        assertThat(execution).isNull();
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"PRESENT", "MISSING", "UNKNOWN"})
    void isSoftwareManageable_oneEnabledManagerManageable_true(PackageManagerState state) {
        // setup
        Machine machine = machine("m-arm", Map.of(BREW, state, WINGET, UNSUPPORTED, CHOCO, UNSUPPORTED));

        // execution
        boolean result = availability.isSoftwareManageable(machine);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isSoftwareManageable_everyManagerUnsupported_false() {
        // setup
        Machine machine = machine("m-intel", Map.of(BREW, UNSUPPORTED, WINGET, UNSUPPORTED, CHOCO, UNSUPPORTED));

        // execution
        boolean result = availability.isSoftwareManageable(machine);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isSoftwareManageable_onlyDisabledChocoMissing_false() {
        // setup
        packageManagerProperties.setChocoEnabled(false);
        Machine machine = machine("m-old-win", Map.of(BREW, UNSUPPORTED, WINGET, UNSUPPORTED, CHOCO, MISSING));

        // execution
        boolean result = availability.isSoftwareManageable(machine);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isSoftwareManageable_enabledChocoMissing_true() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine machine = machine("m-old-win", Map.of(BREW, UNSUPPORTED, WINGET, UNSUPPORTED, CHOCO, MISSING));

        // execution
        boolean result = availability.isSoftwareManageable(machine);

        // verifications
        assertThat(result).isTrue();
    }

    @ParameterizedTest
    @NullAndEmptySource
    void requireSoftwareManageable_noIds_passesWithoutQuery(List<String> machineIds) {
        // setup
        List<PackageManagerType> managers = List.of(BREW);

        // execution + verifications
        assertThatCode(() -> availability.requireSoftwareManageable(machineIds, managers)).doesNotThrowAnyException();
        verifyNoInteractions(machineRepository, tenantIdProvider);
    }

    @Test
    void requireSoftwareManageable_presentOrUnreported_passes() {
        // setup
        Machine arm = machine("m-arm", Map.of(BREW, PRESENT, WINGET, UNSUPPORTED, CHOCO, UNSUPPORTED));
        Machine silent = machine("m-silent", null);
        stubMachines(Set.of("m-arm", "m-silent"), arm, silent);
        List<String> machineIds = List.of("m-arm", "m-silent");
        List<PackageManagerType> managers = List.of(BREW);

        // execution + verifications
        assertThatCode(() -> availability.requireSoftwareManageable(machineIds, managers)).doesNotThrowAnyException();
    }

    @Test
    void requireSoftwareManageable_unmanageableDevice_badRequestNamesOnlyIt() {
        // setup
        Machine intel = machine("m-intel", Map.of(BREW, UNSUPPORTED, WINGET, UNSUPPORTED, CHOCO, UNSUPPORTED));
        Machine arm = machine("m-arm", Map.of(BREW, PRESENT, WINGET, UNSUPPORTED, CHOCO, UNSUPPORTED));
        stubMachines(Set.of("m-intel", "m-arm"), intel, arm);
        List<String> machineIds = List.of("m-intel", "m-arm");
        List<PackageManagerType> managers = List.of(BREW);

        // execution + verifications
        assertThatThrownBy(() -> availability.requireSoftwareManageable(machineIds, managers))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("m-intel")
                .hasMessageNotContaining("m-arm");
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"MISSING", "UNKNOWN"})
    void requireSoftwareManageable_packageManagerNotYetUsable_passes(PackageManagerState state) {
        // setup
        Machine arm = machine("m-arm", Map.of(BREW, state, WINGET, UNSUPPORTED, CHOCO, UNSUPPORTED));
        stubMachines(Set.of("m-arm"), arm);
        List<String> machineIds = List.of("m-arm");
        List<PackageManagerType> managers = List.of(BREW);

        // execution + verifications
        assertThatCode(() -> availability.requireSoftwareManageable(machineIds, managers)).doesNotThrowAnyException();
    }

    @Test
    void requireSoftwareManageable_managerOfAnotherOsUnsupported_passes() {
        // setup
        Machine arm = machine("m-arm", Map.of(BREW, PRESENT, WINGET, UNSUPPORTED, CHOCO, UNSUPPORTED));
        stubMachines(Set.of("m-arm"), arm);
        List<String> machineIds = List.of("m-arm");
        List<PackageManagerType> managers = List.of(BREW, WINGET);

        // execution + verifications
        assertThatCode(() -> availability.requireSoftwareManageable(machineIds, managers)).doesNotThrowAnyException();
    }

    @Test
    void requireSoftwareManageable_deviceSupportsNoneOfTheRequestedManagers_badRequestNamesOnlyIt() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine server = machine("m-server", Map.of(WINGET, UNSUPPORTED, CHOCO, PRESENT));
        Machine desktop = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, MISSING));
        stubMachines(Set.of("m-server", "m-win"), server, desktop);
        List<String> machineIds = List.of("m-server", "m-win");
        List<PackageManagerType> managers = List.of(WINGET);

        // execution
        Throwable thrown = catchThrowable(() -> availability.requireSoftwareManageable(machineIds, managers));

        // verifications
        assertThat(thrown).isInstanceOf(BadRequestException.class)
                .hasMessageContaining("m-server").hasMessageNotContaining("m-win");
    }

    @Test
    void supporting_devicesThatCannotRunTheManager_leftOutInTheOrderAsked() {
        // setup
        Machine server = machine("m-server", Map.of(WINGET, UNSUPPORTED, CHOCO, PRESENT));
        Machine desktop = machine("m-win", Map.of(WINGET, PRESENT));
        Machine notYet = machine("m-new", Map.of(WINGET, MISSING));
        Machine oldAgent = machine("m-old-agent", null);
        stubMachines(Set.of("m-old-agent", "m-server", "m-new", "m-win"), desktop, server, oldAgent, notYet);
        List<String> machineIds = List.of("m-old-agent", "m-server", "m-new", "m-win");

        // execution
        List<String> result = availability.supporting(machineIds, WINGET);

        // verifications
        assertThat(result).containsExactly("m-old-agent", "m-new", "m-win");
    }

    @Test
    void supporting_noMachines_emptyWithoutAQuery() {
        // execution
        List<String> result = availability.supporting(List.of(), WINGET);

        // verifications
        assertThat(result).isEmpty();
        verifyNoInteractions(machineRepository);
    }

    private void stubMachines(Set<String> machineIds, Machine... machines) {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findByTenantIdAndMachineIdIn(TENANT_ID, machineIds)).thenReturn(List.of(machines));
    }

    @Test
    void isPresentOn_deviceThatNeverReportedItsManagers_true() {
        // setup
        Machine machine = machine("m-old-agent", null);

        // execution
        boolean result = PackageManagerAvailability.isPresentOn(machine, WINGET);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isPresentOn_managerPresent_true() {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, MISSING));

        // execution
        boolean result = PackageManagerAvailability.isPresentOn(machine, WINGET);

        // verifications
        assertThat(result).isTrue();
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"MISSING", "UNSUPPORTED", "UNKNOWN"})
    void isPresentOn_managerNotPresent_false(PackageManagerState state) {
        // setup
        Machine machine = machine("m-server", Map.of(WINGET, state, CHOCO, PRESENT));

        // execution
        boolean result = PackageManagerAvailability.isPresentOn(machine, WINGET);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isPresentOn_managerTheDeviceDidNotReport_false() {
        // setup
        Machine machine = machine("m-server", Map.of(CHOCO, PRESENT));

        // execution
        boolean result = PackageManagerAvailability.isPresentOn(machine, WINGET);

        // verifications
        assertThat(result).isFalse();
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"PRESENT", "MISSING", "UNKNOWN"})
    void isAdoptableOn_enabledManagerTheDeviceHasOrCanGet_true(PackageManagerState state) {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine machine = machine("m-server", Map.of(WINGET, UNSUPPORTED, CHOCO, state));

        // execution
        boolean result = availability.isAdoptableOn(machine, CHOCO);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isAdoptableOn_managerUnsupportedOnTheDevice_false() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine machine = machine("m-arm", Map.of(WINGET, PRESENT, CHOCO, UNSUPPORTED));

        // execution
        boolean result = availability.isAdoptableOn(machine, CHOCO);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isAdoptableOn_disabledManager_false() {
        // setup
        packageManagerProperties.setChocoEnabled(false);
        Machine machine = machine("m-server", Map.of(WINGET, UNSUPPORTED, CHOCO, PRESENT));

        // execution
        boolean result = availability.isAdoptableOn(machine, CHOCO);

        // verifications
        assertThat(result).isFalse();
    }

    private static Machine machine(String machineId, Map<PackageManagerType, PackageManagerState> packageManagers) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setPackageManagers(packageManagers);
        return machine;
    }
}
