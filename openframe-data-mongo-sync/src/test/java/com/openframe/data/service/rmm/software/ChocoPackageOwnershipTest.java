package com.openframe.data.service.rmm.software;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.chocolatey.ChocolateyStatus;
import com.openframe.data.document.device.chocolatey.MachineChocolatey;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChocoPackageOwnershipTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String CHROME_ID = "GoogleChrome";
    private static final String SEVEN_ZIP_ID = "7zip";

    @Mock private MachineRepository machineRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private SoftwareSettingsService softwareSettingsService;

    @InjectMocks private ChocoPackageOwnership ownership;

    @Test
    void owns_managedAndIdInPackages_true() {
        // setup
        Machine machine = machine("m-1", ChocolateyStatus.MANAGED, List.of(SEVEN_ZIP_ID, CHROME_ID), List.of());

        // execution
        boolean result = ownership.owns(machine, CHROME_ID);

        // verifications
        assertThat(result).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"googlechrome", "GOOGLECHROME", "googleChrome"})
    void owns_idInAnotherLetterCase_true(String packageId) {
        // setup
        Machine machine = machine("m-1", ChocolateyStatus.MANAGED, List.of(SEVEN_ZIP_ID, CHROME_ID), List.of());

        // execution
        boolean result = ownership.owns(machine, packageId);

        // verifications
        assertThat(result).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @EnumSource(value = ChocolateyStatus.class, mode = EnumSource.Mode.EXCLUDE, names = "MANAGED")
    void owns_statusNotManaged_false(ChocolateyStatus status) {
        // setup
        Machine machine = machine("m-1", status, List.of(CHROME_ID), List.of());

        // execution
        boolean result = ownership.owns(machine, CHROME_ID);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void owns_noChocolateyObject_false() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("m-1");

        // execution
        boolean result = ownership.owns(machine, CHROME_ID);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void owns_managedAndIdInNeitherList_false() {
        // setup
        Machine machine = machine("m-1", ChocolateyStatus.MANAGED, List.of(SEVEN_ZIP_ID), List.of("git"));

        // execution
        boolean result = ownership.owns(machine, CHROME_ID);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void owns_managedWithoutPackageLists_false() {
        // setup
        Machine machine = machine("m-1", ChocolateyStatus.MANAGED, null, null);

        // execution
        boolean result = ownership.owns(machine, CHROME_ID);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void owns_idOnlyInExistingPackagesAndSettingOff_false() {
        // setup
        when(softwareSettingsService.updatesExistingChocolateyPackages()).thenReturn(false);
        Machine machine = machine("m-1", ChocolateyStatus.MANAGED, List.of(SEVEN_ZIP_ID), List.of(CHROME_ID));

        // execution
        boolean result = ownership.owns(machine, CHROME_ID);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void owns_idOnlyInExistingPackagesAndSettingOn_true() {
        // setup
        when(softwareSettingsService.updatesExistingChocolateyPackages()).thenReturn(true);
        Machine machine = machine("m-1", ChocolateyStatus.MANAGED, List.of(SEVEN_ZIP_ID), List.of(CHROME_ID));

        // execution
        boolean result = ownership.owns(machine, CHROME_ID);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void owns_idInExistingPackagesInAnotherLetterCaseAndSettingOn_true() {
        // setup
        when(softwareSettingsService.updatesExistingChocolateyPackages()).thenReturn(true);
        Machine machine = machine("m-1", ChocolateyStatus.MANAGED, List.of(), List.of(CHROME_ID));

        // execution
        boolean result = ownership.owns(machine, "googlechrome");

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void owns_notManagedWithIdInExistingPackagesAndSettingOn_false() {
        // setup
        lenient().when(softwareSettingsService.updatesExistingChocolateyPackages()).thenReturn(true);
        Machine machine = machine("m-1", ChocolateyStatus.ACTION_REQUIRED, List.of(), List.of(CHROME_ID));

        // execution
        boolean result = ownership.owns(machine, CHROME_ID);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void owners_ownersNonOwnersAndUnknownMachines_ownersInTheOrderAsked() {
        // setup
        Machine first = machine("m-1", ChocolateyStatus.MANAGED, List.of(CHROME_ID), List.of());
        Machine notManaged = machine("m-2", ChocolateyStatus.UPGRADE_REQUIRED, List.of(CHROME_ID), List.of());
        Machine third = machine("m-3", ChocolateyStatus.MANAGED, List.of(SEVEN_ZIP_ID, "googlechrome"), List.of());
        Machine otherPackage = machine("m-4", ChocolateyStatus.MANAGED, List.of(SEVEN_ZIP_ID), List.of());
        List<String> machineIds = List.of("m-3", "m-2", "m-gone", "m-4", "m-1");
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), sameIds("m-3", "m-2", "m-gone", "m-4", "m-1")))
                .thenReturn(List.of(first, notManaged, third, otherPackage));

        // execution
        List<String> result = ownership.owners(machineIds, CHROME_ID);

        // verifications
        assertThat(result).containsExactly("m-3", "m-1");
    }

    @Test
    void owners_idOnlyInExistingPackagesAndSettingOn_included() {
        // setup
        Machine existing = machine("m-1", ChocolateyStatus.MANAGED, List.of(), List.of(CHROME_ID));
        List<String> machineIds = List.of("m-1");
        when(softwareSettingsService.updatesExistingChocolateyPackages()).thenReturn(true);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), sameIds("m-1")))
                .thenReturn(List.of(existing));

        // execution
        List<String> result = ownership.owners(machineIds, CHROME_ID);

        // verifications
        assertThat(result).containsExactly("m-1");
    }

    @Test
    void owners_idOnlyInExistingPackagesAndSettingOff_excluded() {
        // setup
        Machine existing = machine("m-1", ChocolateyStatus.MANAGED, List.of(), List.of(CHROME_ID));
        Machine installed = machine("m-2", ChocolateyStatus.MANAGED, List.of(CHROME_ID), List.of());
        List<String> machineIds = List.of("m-1", "m-2");
        when(softwareSettingsService.updatesExistingChocolateyPackages()).thenReturn(false);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), sameIds("m-1", "m-2")))
                .thenReturn(List.of(existing, installed));

        // execution
        List<String> result = ownership.owners(machineIds, CHROME_ID);

        // verifications
        assertThat(result).containsExactly("m-2");
    }

    @Test
    void owners_noMachineFound_empty() {
        // setup
        List<String> machineIds = List.of("m-gone");
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT_ID), sameIds("m-gone"))).thenReturn(List.of());

        // execution
        List<String> result = ownership.owners(machineIds, CHROME_ID);

        // verifications
        assertThat(result).isEmpty();
    }

    @Test
    void owners_noMachineIds_empty() {
        // setup
        List<String> machineIds = List.of();

        // execution
        List<String> result = ownership.owners(machineIds, CHROME_ID);

        // verifications
        assertThat(result).isEmpty();
    }

    private static Machine machine(String machineId, ChocolateyStatus status, List<String> packages,
                                   List<String> existingPackages) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        machine.setChocolatey(MachineChocolatey.builder()
                .status(status)
                .packages(packages)
                .existingPackages(existingPackages)
                .build());
        return machine;
    }

    private static Collection<String> sameIds(String... machineIds) {
        Set<String> expected = Set.of(machineIds);
        return argThat(ids -> ids != null && expected.equals(new HashSet<>(ids)));
    }
}
