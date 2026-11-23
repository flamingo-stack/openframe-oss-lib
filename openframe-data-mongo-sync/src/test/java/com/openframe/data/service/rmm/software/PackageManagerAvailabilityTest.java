package com.openframe.data.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.chocolatey.ChocolateyStatus;
import com.openframe.data.document.device.chocolatey.MachineChocolatey;
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
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
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

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"MISSING", "UNKNOWN"})
    void isSoftwareManageable_enabledChocoMissingOrUnknown_true(PackageManagerState state) {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine machine = machine("m-old-win", Map.of(BREW, UNSUPPORTED, WINGET, UNSUPPORTED, CHOCO, state));

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
        Machine server = machine("m-server", Map.of(WINGET, UNSUPPORTED, CHOCO, PRESENT), ChocolateyStatus.MANAGED);
        Machine desktop = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, MISSING));
        stubMachines(Set.of("m-server", "m-win"), server, desktop);
        List<String> machineIds = List.of("m-server", "m-win");
        List<PackageManagerType> managers = List.of(WINGET);

        // execution
        Throwable thrown = catchThrowable(() -> availability.requireSoftwareManageable(machineIds, managers));

        // verifications
        assertThat(thrown).isInstanceOf(BadRequestException.class)
                .hasMessageContaining("support none of the requested package managers")
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

    @Test
    void adoptableOn_devicesWithoutTheManagerPresent_leftOut() {
        // setup
        Machine intel = machine("m-intel", Map.of(BREW, UNSUPPORTED));
        Machine arm = machine("m-arm", Map.of(BREW, PRESENT));
        Machine notYet = machine("m-new", Map.of(BREW, MISSING));
        Machine oldAgent = machine("m-old-agent", null);
        stubMachines(Set.of("m-old-agent", "m-intel", "m-new", "m-arm", "m-gone"), arm, intel, oldAgent, notYet);
        List<String> machineIds = List.of("m-old-agent", "m-intel", "m-new", "m-arm", "m-gone");

        // execution
        List<String> result = availability.adoptableOn(machineIds, BREW);

        // verifications
        assertThat(result).containsExactly("m-arm");
    }

    @Test
    void adoptableOn_noMachines_emptyWithoutAQuery() {
        // execution
        List<String> result = availability.adoptableOn(List.of(), CHOCO);

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

    @Test
    void isAdoptableOn_enabledManagerPresent_true() {
        // setup
        Machine machine = machine("m-arm", Map.of(BREW, PRESENT, WINGET, UNSUPPORTED));

        // execution
        boolean result = availability.isAdoptableOn(machine, BREW);

        // verifications
        assertThat(result).isTrue();
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"MISSING", "UNKNOWN", "UNSUPPORTED"})
    void isAdoptableOn_managerNotKnownPresent_false(PackageManagerState state) {
        // setup
        Machine machine = machine("m-intel", Map.of(WINGET, PRESENT, BREW, state));

        // execution
        boolean result = availability.isAdoptableOn(machine, BREW);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isAdoptableOn_managerTheDeviceDidNotReport_false() {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT));

        // execution
        boolean result = availability.isAdoptableOn(machine, BREW);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isAdoptableOn_deviceThatNeverReportedItsManagers_false() {
        // setup
        Machine machine = machine("m-old-agent", null);

        // execution
        boolean result = availability.isAdoptableOn(machine, BREW);

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

    @Test
    void isSoftwareManageable_chocoPresentManaged_true() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine machine = machine("m-win", Map.of(BREW, UNSUPPORTED, WINGET, UNSUPPORTED, CHOCO, PRESENT),
                ChocolateyStatus.MANAGED);

        // execution
        boolean result = availability.isSoftwareManageable(machine);

        // verifications
        assertThat(result).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @EnumSource(value = ChocolateyStatus.class, mode = EnumSource.Mode.EXCLUDE, names = "MANAGED")
    void isSoftwareManageable_chocoPresentNotManaged_false(ChocolateyStatus status) {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine machine = machine("m-win", Map.of(BREW, UNSUPPORTED, WINGET, UNSUPPORTED, CHOCO, PRESENT), status);

        // execution
        boolean result = availability.isSoftwareManageable(machine);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isSoftwareManageable_chocoPresentWithoutChocolateyObject_false() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine machine = machine("m-win", Map.of(BREW, UNSUPPORTED, WINGET, UNSUPPORTED, CHOCO, PRESENT));

        // execution
        boolean result = availability.isSoftwareManageable(machine);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isSoftwareManageable_chocoEnabledDeviceNeverReported_true() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine machine = machine("m-old-agent", null);

        // execution
        boolean result = availability.isSoftwareManageable(machine);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isSoftwareManageable_chocoNotManagedButWingetPresent_true() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine machine = machine("m-win", Map.of(BREW, UNSUPPORTED, WINGET, PRESENT, CHOCO, PRESENT),
                ChocolateyStatus.ACTION_REQUIRED);

        // execution
        boolean result = availability.isSoftwareManageable(machine);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void requireSoftwareManageable_chocoOnlyDeviceNotManaged_badRequestNamesOnlyIt() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine blocked = machine("m-blocked", Map.of(WINGET, UNSUPPORTED, CHOCO, PRESENT),
                ChocolateyStatus.ACTION_REQUIRED);
        Machine managed = machine("m-managed", Map.of(WINGET, UNSUPPORTED, CHOCO, PRESENT), ChocolateyStatus.MANAGED);
        stubMachines(Set.of("m-blocked", "m-managed"), blocked, managed);
        List<String> machineIds = List.of("m-blocked", "m-managed");
        List<PackageManagerType> managers = List.of(CHOCO);

        // execution
        Throwable thrown = catchThrowable(() -> availability.requireSoftwareManageable(machineIds, managers));

        // verifications
        assertThat(thrown).isInstanceOf(BadRequestException.class)
                .hasMessageContaining("m-blocked").hasMessageNotContaining("m-managed");
    }

    @Test
    void supporting_chocoDevicesNotManaged_leftOutInTheOrderAsked() {
        // setup
        Map<PackageManagerType, PackageManagerState> chocoPresent = Map.of(CHOCO, PRESENT);
        Machine managed = machine("m-managed", chocoPresent, ChocolateyStatus.MANAGED);
        Machine upgrade = machine("m-upgrade", chocoPresent, ChocolateyStatus.UPGRADE_REQUIRED);
        Machine noObject = machine("m-no-object", chocoPresent);
        Machine missing = machine("m-missing", Map.of(CHOCO, MISSING));
        Machine unsupported = machine("m-unsupported", Map.of(CHOCO, UNSUPPORTED));
        Machine oldAgent = machine("m-old-agent", null);
        stubMachines(Set.of("m-old-agent", "m-upgrade", "m-missing", "m-no-object", "m-managed", "m-unsupported"),
                managed, upgrade, noObject, missing, unsupported, oldAgent);
        List<String> machineIds = List.of("m-old-agent", "m-upgrade", "m-missing", "m-no-object", "m-managed",
                "m-unsupported");

        // execution
        List<String> result = availability.supporting(machineIds, CHOCO);

        // verifications
        assertThat(result).containsExactly("m-old-agent", "m-missing", "m-managed");
    }

    @Test
    void isPresentOn_chocoPresentManaged_true() {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, PRESENT), ChocolateyStatus.MANAGED);

        // execution
        boolean result = PackageManagerAvailability.isPresentOn(machine, CHOCO);

        // verifications
        assertThat(result).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @EnumSource(value = ChocolateyStatus.class, mode = EnumSource.Mode.EXCLUDE, names = "MANAGED")
    void isPresentOn_chocoPresentNotManaged_false(ChocolateyStatus status) {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, PRESENT), status);

        // execution
        boolean result = PackageManagerAvailability.isPresentOn(machine, CHOCO);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isPresentOn_chocoPresentWithoutChocolateyObject_false() {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, PRESENT));

        // execution
        boolean result = PackageManagerAvailability.isPresentOn(machine, CHOCO);

        // verifications
        assertThat(result).isFalse();
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"MISSING", "UNKNOWN", "UNSUPPORTED"})
    void isPresentOn_chocoNotPresent_false(PackageManagerState state) {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, state));

        // execution
        boolean result = PackageManagerAvailability.isPresentOn(machine, CHOCO);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isPresentOn_chocoOnDeviceThatNeverReportedItsManagers_true() {
        // setup
        Machine machine = machine("m-old-agent", null);

        // execution
        boolean result = PackageManagerAvailability.isPresentOn(machine, CHOCO);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isPresentOn_wingetPresentWhileChocoNotManaged_true() {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, PRESENT), ChocolateyStatus.ACTION_REQUIRED);

        // execution
        boolean result = PackageManagerAvailability.isPresentOn(machine, WINGET);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isSupportedOn_chocoPresentManaged_true() {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, PRESENT), ChocolateyStatus.MANAGED);

        // execution
        boolean result = PackageManagerAvailability.isSupportedOn(machine, CHOCO);

        // verifications
        assertThat(result).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @EnumSource(value = ChocolateyStatus.class, mode = EnumSource.Mode.EXCLUDE, names = "MANAGED")
    void isSupportedOn_chocoPresentNotManaged_false(ChocolateyStatus status) {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, PRESENT), status);

        // execution
        boolean result = PackageManagerAvailability.isSupportedOn(machine, CHOCO);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isSupportedOn_chocoPresentWithoutChocolateyObject_false() {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, PRESENT));

        // execution
        boolean result = PackageManagerAvailability.isSupportedOn(machine, CHOCO);

        // verifications
        assertThat(result).isFalse();
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerState.class, names = {"MISSING", "UNKNOWN"})
    void isSupportedOn_chocoMissingOrUnknown_true(PackageManagerState state) {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, state));

        // execution
        boolean result = PackageManagerAvailability.isSupportedOn(machine, CHOCO);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isSupportedOn_chocoUnsupported_false() {
        // setup
        Machine machine = machine("m-server", Map.of(WINGET, PRESENT, CHOCO, UNSUPPORTED));

        // execution
        boolean result = PackageManagerAvailability.isSupportedOn(machine, CHOCO);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isSupportedOn_chocoOnDeviceThatNeverReportedItsManagers_true() {
        // setup
        Machine machine = machine("m-old-agent", null);

        // execution
        boolean result = PackageManagerAvailability.isSupportedOn(machine, CHOCO);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isSupportedOn_wingetPresentWhileChocoNotManaged_true() {
        // setup
        Machine machine = machine("m-win", Map.of(WINGET, PRESENT, CHOCO, PRESENT), ChocolateyStatus.ACTION_REQUIRED);

        // execution
        boolean result = PackageManagerAvailability.isSupportedOn(machine, WINGET);

        // verifications
        assertThat(result).isTrue();
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void isAdoptionOffered_choco_falseWhetherEnabledOrNot(boolean chocoEnabled) {
        // setup
        packageManagerProperties.setChocoEnabled(chocoEnabled);

        // execution
        boolean result = availability.isAdoptionOffered(CHOCO);

        // verifications
        assertThat(result).isFalse();
    }

    @ParameterizedTest
    @EnumSource(value = PackageManagerType.class, names = {"BREW", "WINGET"})
    void isAdoptionOffered_brewOrWinget_true(PackageManagerType manager) {
        // setup
        packageManagerProperties.setChocoEnabled(true);

        // execution
        boolean result = availability.isAdoptionOffered(manager);

        // verifications
        assertThat(result).isTrue();
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void adoptionManagers_chocoEnabledOrNot_brewAndWingetOnly(boolean chocoEnabled) {
        // setup
        packageManagerProperties.setChocoEnabled(chocoEnabled);

        // execution
        List<PackageManagerType> result = availability.adoptionManagers();

        // verifications
        assertThat(result).containsExactlyInAnyOrder(BREW, WINGET);
    }

    @Test
    void isAdoptableOn_enabledChocoPresentManaged_false() {
        // setup
        packageManagerProperties.setChocoEnabled(true);
        Machine machine = machine("m-server", Map.of(WINGET, UNSUPPORTED, CHOCO, PRESENT), ChocolateyStatus.MANAGED);

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

    private static Machine machine(String machineId, Map<PackageManagerType, PackageManagerState> packageManagers,
                                   ChocolateyStatus chocolateyStatus) {
        Machine machine = machine(machineId, packageManagers);
        machine.setChocolatey(MachineChocolatey.builder().status(chocolateyStatus).build());
        return machine;
    }
}
