package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVersionStatus;
import com.openframe.data.service.rmm.software.matching.InstalledProgram;
import com.openframe.data.service.rmm.software.matching.PackageMatch;
import com.openframe.data.service.rmm.software.matching.SoftwarePackageMatcher;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.nats.delivery.PackageAdoptReach;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Collection;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareCatalogStatusTest {

    private static final String TENANT_ID = "t1";
    private static final String MACHINE_ID = "m1";
    private static final SoftwareBundlePackage ADOPTION_INTO_CHOCO_7ZIP = SoftwareBundlePackage.builder()
            .packageManager(PackageManagerType.CHOCO).packageName("7zip").version("24.09").build();

    @Mock private PackageCatalogRepository catalogRepository;
    @Mock private SoftwarePackageMatcher packageMatcher;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private PackageAdoptReach packageAdoptReach;
    @Mock private MachineRepository machineRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    private SoftwareCatalogStatus status() {
        return new SoftwareCatalogStatus(catalogRepository, packageMatcher, packageManagerAvailability,
                packageAdoptReach, machineRepository, tenantIdProvider);
    }

    @Test
    void brewFormulaBehindTheCatalog_isOutdatedWithTheCatalogAsLatest() {
        SoftwareResponse xz = row("xz", SoftwareSource.BREW, "5.8.3", 0);
        catalog(entry("xz", "5.8.4", BrewPackageType.FORMULA));

        status().apply(List.of(xz));

        assertThat(xz.getVersionStatus()).isEqualTo(SoftwareVersionStatus.OUTDATED);
        assertThat(xz.getLatestVersion()).isEqualTo("5.8.4");
        assertThat(xz.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.OFF);
    }

    @Test
    void brewFormulaAtOrPastTheCatalog_isUpToDate() {
        SoftwareResponse same = row("jq", SoftwareSource.BREW, "1.7.1", 0);
        SoftwareResponse ahead = row("git", SoftwareSource.BREW, "2.51.1", 0);
        catalog(entry("jq", "1.7.1", BrewPackageType.FORMULA), entry("git", "2.51.0", BrewPackageType.FORMULA));

        status().apply(List.of(same, ahead));

        assertThat(same.getVersionStatus()).isEqualTo(SoftwareVersionStatus.UP_TO_DATE);
        assertThat(ahead.getVersionStatus()).isEqualTo(SoftwareVersionStatus.UP_TO_DATE);
    }

    @Test
    void formulaAndCaskSharingAToken_theFormulaWins() {
        SoftwareResponse docker = row("docker", SoftwareSource.BREW, "28.0.0", 0);
        catalog(entry("docker", "4.40.0", BrewPackageType.CASK), entry("docker", "28.1.0", BrewPackageType.FORMULA));

        status().apply(List.of(docker));

        assertThat(docker.getLatestVersion()).isEqualTo("28.1.0");
        assertThat(docker.getVersionStatus()).isEqualTo(SoftwareVersionStatus.OUTDATED);
    }

    @Test
    void brewTitleTheCatalogDoesNotCarry_hasNoPackageAndAnUnknownStatus() {
        SoftwareResponse tapped = row("some-tap-tool", SoftwareSource.BREW, "1.0.0", 0);
        catalog();

        status().apply(List.of(tapped));

        assertThat(tapped.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.NO_PACKAGE);
        assertThat(tapped.getVersionStatus()).isEqualTo(SoftwareVersionStatus.UNKNOWN);
    }

    @Test
    void anAutoUpdatePolicy_staysAsItIs() {
        SoftwareResponse xz = row("xz", SoftwareSource.BREW, "5.8.3", 0);
        xz.setAutoUpdate(SoftwareAutoUpdateStatus.ON);
        catalog(entry("xz", "5.8.4", BrewPackageType.FORMULA));

        status().apply(List.of(xz));

        assertThat(xz.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.ON);
    }

    @Test
    void devicesOnDifferentVersions_areOutdatedWithoutTheCatalog() {
        SoftwareResponse chrome = row("Google Chrome", SoftwareSource.UNMANAGED, "141.0", 2);

        status().apply(List.of(chrome));

        assertThat(chrome.getVersionStatus()).isEqualTo(SoftwareVersionStatus.OUTDATED);
        verifyNoInteractions(catalogRepository);
    }

    // with one version everywhere and no catalog entry nothing says whether a newer release is out
    @Test
    void notABrewTitle_keepsItsLatestAndAutoUpdate_statusUnknown() {
        SoftwareResponse acrobat = row("Adobe Acrobat", SoftwareSource.UNMANAGED, "25.1", 0);
        acrobat.setLatestVersion("25.1");

        status().apply(List.of(acrobat));

        assertThat(acrobat.getVersionStatus()).isEqualTo(SoftwareVersionStatus.UNKNOWN);
        assertThat(acrobat.getLatestVersion()).isEqualTo("25.1");
        assertThat(acrobat.getAutoUpdate()).isNull();
        verifyNoInteractions(catalogRepository);
    }

    @Test
    void oneCatalogQueryForAllBrewRows_byLowerCaseToken() {
        catalog(entry("xz", "5.8.4", BrewPackageType.FORMULA));

        status().apply(List.of(row("XZ", SoftwareSource.BREW, "5.8.4", 0), row("jq", SoftwareSource.BREW, "1.7", 0),
                row("Slack", SoftwareSource.UNMANAGED, "4.4", 0)));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<String>> tokens = ArgumentCaptor.forClass(Collection.class);
        verify(catalogRepository).findByManagerAndPackageIdIn(eq(PackageManagerType.BREW), tokens.capture());
        assertThat(tokens.getValue()).containsExactlyInAnyOrder("xz", "jq");
    }

    @Test
    void catalogEntryWithoutAVersionOrToken_isSkipped() {
        SoftwareResponse xz = row("xz", SoftwareSource.BREW, "5.8.3", 0);
        PackageCatalogEntry noToken = entry(null, "9.9.9", BrewPackageType.FORMULA);
        catalog(entry("xz", null, BrewPackageType.FORMULA), noToken, entry("xz", "5.8.4", BrewPackageType.CASK));

        status().apply(List.of(xz));

        assertThat(xz.getLatestVersion()).isEqualTo("5.8.4");
        assertThat(xz.getVersionStatus()).isEqualTo(SoftwareVersionStatus.OUTDATED);
    }

    @Test
    void apply_programMatchedToAWingetPackage_wingetWithItsLatestAndAutoUpdateOff() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", "141.0");
        stubMatch(chrome, PackageMatch.of(wingetPackage("Google.Chrome", "142.0")));

        // execution
        status().apply(List.of(chrome));

        // verifications
        assertThat(chrome)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getLatestVersion,
                        SoftwareResponse::getVersionStatus, SoftwareResponse::getAutoUpdate)
                .containsExactly(SoftwareSource.WINGET, "142.0", SoftwareVersionStatus.OUTDATED,
                        SoftwareAutoUpdateStatus.OFF);
    }

    @Test
    void apply_programWithoutAPackage_noPackageFound() {
        // setup
        SoftwareResponse tool = program("Contoso Tool", "1.0");
        stubMatch(tool, PackageMatch.noPackage());

        // execution
        status().apply(List.of(tool));

        // verifications
        assertThat(tool)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getAutoUpdate)
                .containsExactly(SoftwareSource.UNMANAGED, SoftwareAutoUpdateStatus.NO_PACKAGE);
    }

    @Test
    void apply_programWithSeveralUnrelatedPackages_leftUnknown() {
        // setup
        SoftwareResponse notepad = program("Notepad++", "8.6");
        stubMatch(notepad, PackageMatch.ambiguous());

        // execution
        status().apply(List.of(notepad));

        // verifications
        assertThat(notepad)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getVersionStatus,
                        SoftwareResponse::getAutoUpdate)
                .containsExactly(SoftwareSource.UNMANAGED, SoftwareVersionStatus.UNKNOWN, null);
    }

    @Test
    void apply_matchedProgramWithAnAutoUpdatePolicy_policyStays() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", "141.0");
        chrome.setAutoUpdate(SoftwareAutoUpdateStatus.ON);
        stubMatch(chrome, PackageMatch.of(wingetPackage("Google.Chrome", "141.0")));

        // execution
        status().apply(List.of(chrome));

        // verifications
        assertThat(chrome.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.ON);
    }

    @Test
    void apply_brewCaskWithoutAVersion_autoUpdatePossibleStatusUnknown() {
        // setup
        SoftwareResponse tool = row("some-cask", SoftwareSource.BREW, "1.0", 0);
        catalog(entry("some-cask", "latest", BrewPackageType.CASK));

        // execution
        status().apply(List.of(tool));

        // verifications
        assertThat(tool)
                .extracting(SoftwareResponse::getAutoUpdate, SoftwareResponse::getVersionStatus)
                .containsExactly(SoftwareAutoUpdateStatus.OFF, SoftwareVersionStatus.UNKNOWN);
    }

    @Test
    void apply_brewCaskVersionWithABuild_comparedWithoutTheBuild() {
        // setup
        SoftwareResponse affinity = row("affinity", SoftwareSource.BREW, "3.3.3", 0);
        catalog(entry("affinity", "3.3.3,5004", BrewPackageType.CASK));

        // execution
        status().apply(List.of(affinity));

        // verifications
        assertThat(affinity)
                .extracting(SoftwareResponse::getLatestVersion, SoftwareResponse::getVersionStatus)
                .containsExactly("3.3.3", SoftwareVersionStatus.UP_TO_DATE);
    }

    @Test
    void apply_brewTitleInTheCatalog_managedByItsCatalogPackage() {
        // setup
        SoftwareResponse docker = row("Docker", SoftwareSource.BREW, "28.0.0", 0);
        PackageCatalogEntry formula = entry("docker", "28.1.0", BrewPackageType.FORMULA);
        catalog(entry("docker", "4.40.0", BrewPackageType.CASK), formula);

        // execution
        status().apply(List.of(docker));

        // verifications
        assertThat(docker.getManagingPackage()).isSameAs(formula);
    }

    @Test
    void apply_brewTitleTheCatalogDoesNotCarry_noManagingPackage() {
        // setup
        SoftwareResponse tapped = row("some-tap-tool", SoftwareSource.BREW, "1.0.0", 0);
        catalog();

        // execution
        status().apply(List.of(tapped));

        // verifications
        assertThat(tapped.getManagingPackage()).isNull();
    }

    @Test
    void apply_programMatchedToAWingetPackage_managedByThatPackage() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", "141.0");
        PackageCatalogEntry wingetChrome = wingetPackage("Google.Chrome", "142.0");
        stubMatch(chrome, PackageMatch.of(wingetChrome));

        // execution
        status().apply(List.of(chrome));

        // verifications
        assertThat(chrome.getManagingPackage()).isSameAs(wingetChrome);
    }

    @ParameterizedTest
    @MethodSource("matchesWithoutAPackage")
    void apply_programNotMatchedToOnePackage_noManagingPackage(PackageMatch match) {
        // setup
        SoftwareResponse tool = program("Contoso Tool", "1.0");
        stubMatch(tool, match);

        // execution
        status().apply(List.of(tool));

        // verifications
        assertThat(tool.getManagingPackage()).isNull();
    }

    @Test
    void apply_titleNoMatcherTakes_noManagingPackage() {
        // setup
        SoftwareResponse choco = row("7zip", SoftwareSource.CHOCOLATEY, "24.08", 0);

        // execution
        status().apply(List.of(choco));

        // verifications
        assertThat(choco.getManagingPackage()).isNull();
    }

    private static Stream<Arguments> matchesWithoutAPackage() {
        return Stream.of(Arguments.of(PackageMatch.noPackage()), Arguments.of(PackageMatch.ambiguous()));
    }

    private void catalog(PackageCatalogEntry... entries) {
        when(catalogRepository.findByManagerAndPackageIdIn(eq(PackageManagerType.BREW), any()))
                .thenReturn(List.of(entries));
    }

    @Test
    void apply_caskRowSharingATokenWithAFormula_theCaskWins() {
        // setup
        SoftwareResponse docker = row("docker", SoftwareSource.BREW, "4.39.0", 0);
        docker.setFleetSource(FleetSource.HOMEBREW_CASKS);
        PackageCatalogEntry cask = entry("docker", "4.40.0", BrewPackageType.CASK);
        catalog(entry("docker", "28.1.0", BrewPackageType.FORMULA), cask);

        // execution
        status().apply(List.of(docker));

        // verifications
        assertThat(docker.getManagingPackage()).isSameAs(cask);
        assertThat(docker.getLatestVersion()).isEqualTo("4.40.0");
        assertThat(docker.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.OFF);
    }

    private static PackageCatalogEntry entry(String token, String version, BrewPackageType type) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.BREW)
                .packageId(token)
                .version(version)
                .brewType(type)
                .build();
    }

    private static SoftwareResponse row(String name, SoftwareSource source, String currentVersion, int older) {
        return SoftwareResponse.builder()
                .name(name)
                .source(source)
                .currentVersion(currentVersion)
                .olderVersionsCount(older)
                .build();
    }

    @Test
    void apply_programWithOnlyAPackageToAdoptInto_needsAdoptionWithItsLatestAndNoManagingPackage() {
        // setup
        SoftwareResponse sevenZip = program("7-Zip", "24.08");
        PackageCatalogEntry choco7zip = chocoPackage("7zip", "24.09");
        stubMatch(sevenZip, PackageMatch.noPackage());
        stubAdoptionMatch(sevenZip, PackageMatch.of(choco7zip));
        when(packageManagerAvailability.isEnabled(PackageManagerType.CHOCO)).thenReturn(true);

        // execution
        status().apply(List.of(sevenZip));

        // verifications
        assertThat(sevenZip)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getLatestVersion,
                        SoftwareResponse::getVersionStatus, SoftwareResponse::getAutoUpdate,
                        SoftwareResponse::getManagingPackage, SoftwareResponse::getAdoptionPackage)
                .containsExactly(SoftwareSource.UNMANAGED, "24.09", SoftwareVersionStatus.OUTDATED,
                        SoftwareAutoUpdateStatus.NEEDS_ADOPTION, null, ADOPTION_INTO_CHOCO_7ZIP);
    }

    @Test
    void apply_packageToAdoptIntoOfADisabledManager_noPackageFound() {
        // setup
        SoftwareResponse sevenZip = program("7-Zip", "24.08");
        stubMatch(sevenZip, PackageMatch.noPackage());
        stubAdoptionMatch(sevenZip, PackageMatch.of(chocoPackage("7zip", "24.09")));
        when(packageManagerAvailability.isEnabled(PackageManagerType.CHOCO)).thenReturn(false);

        // execution
        status().apply(List.of(sevenZip));

        // verifications
        assertThat(sevenZip.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.NO_PACKAGE);
        assertThat(sevenZip.getAdoptionPackage()).isNull();
        assertThat(sevenZip.getLatestVersion()).isNull();
    }

    @Test
    void apply_wingetPackageAndAPackageToAdoptInto_wingetManagesForTheTenant() {
        // setup
        SoftwareResponse sevenZip = program("7-Zip", "24.08");
        PackageCatalogEntry winget7zip = wingetPackage("7zip.7zip", "24.09");
        stubMatch(sevenZip, PackageMatch.of(winget7zip));
        stubAdoptionMatch(sevenZip, PackageMatch.of(chocoPackage("7zip", "24.09")));

        // execution
        status().apply(List.of(sevenZip));

        // verifications
        assertThat(sevenZip.getManagingPackage()).isSameAs(winget7zip);
        assertThat(sevenZip.getAdoptionPackage()).isNull();
        assertThat(sevenZip.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.OFF);
    }

    @Test
    void applyOnDevice_wingetRunsOnTheDevice_wingetManages() {
        // setup
        SoftwareResponse sevenZip = program("7-Zip", "24.08");
        PackageCatalogEntry winget7zip = wingetPackage("7zip.7zip", "24.09");
        stubDevice(Map.of(PackageManagerType.WINGET, PackageManagerState.PRESENT,
                PackageManagerType.CHOCO, PackageManagerState.PRESENT));
        stubMatch(sevenZip, PackageMatch.of(winget7zip));
        stubAdoptionMatch(sevenZip, PackageMatch.of(chocoPackage("7zip", "24.09")));

        // execution
        status().applyOnDevice(MACHINE_ID, List.of(sevenZip));

        // verifications
        assertThat(sevenZip.getManagingPackage()).isSameAs(winget7zip);
        assertThat(sevenZip.getSource()).isEqualTo(SoftwareSource.WINGET);
        assertThat(sevenZip.getAdoptionPackage()).isNull();
    }

    @Test
    void applyOnDevice_wingetDoesNotRunOnTheDevice_thePackageToAdoptIntoInstead() {
        // setup
        SoftwareResponse sevenZip = program("7-Zip", "24.08");
        PackageCatalogEntry choco7zip = chocoPackage("7zip", "24.09");
        Machine server = stubDevice(Map.of(PackageManagerType.WINGET, PackageManagerState.UNSUPPORTED,
                PackageManagerType.CHOCO, PackageManagerState.PRESENT));
        stubMatch(sevenZip, PackageMatch.of(wingetPackage("7zip.7zip", "24.09")));
        stubAdoptionMatch(sevenZip, PackageMatch.of(choco7zip));
        when(packageManagerAvailability.isAdoptableOn(server, PackageManagerType.CHOCO)).thenReturn(true);

        // execution
        status().applyOnDevice(MACHINE_ID, List.of(sevenZip));

        // verifications
        assertThat(sevenZip)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getAutoUpdate,
                        SoftwareResponse::getManagingPackage, SoftwareResponse::getAdoptionPackage)
                .containsExactly(SoftwareSource.UNMANAGED, SoftwareAutoUpdateStatus.NEEDS_ADOPTION, null,
                        ADOPTION_INTO_CHOCO_7ZIP);
    }

    @Test
    void applyOnDevice_wingetDoesNotRunAndChocoCannotBeAdoptedIntoThere_noPackageButTheLatestVersionIsKnown() {
        // setup
        SoftwareResponse sevenZip = program("7-Zip", "24.08");
        Machine server = stubDevice(Map.of(PackageManagerType.WINGET, PackageManagerState.UNSUPPORTED,
                PackageManagerType.CHOCO, PackageManagerState.UNSUPPORTED));
        stubMatch(sevenZip, PackageMatch.of(wingetPackage("7zip.7zip", "24.09")));
        stubAdoptionMatch(sevenZip, PackageMatch.of(chocoPackage("7zip", "24.09")));
        when(packageManagerAvailability.isAdoptableOn(server, PackageManagerType.CHOCO)).thenReturn(false);

        // execution
        status().applyOnDevice(MACHINE_ID, List.of(sevenZip));

        // verifications
        assertThat(sevenZip)
                .extracting(SoftwareResponse::getAutoUpdate, SoftwareResponse::getManagingPackage,
                        SoftwareResponse::getAdoptionPackage, SoftwareResponse::getLatestVersion)
                .containsExactly(SoftwareAutoUpdateStatus.NO_PACKAGE, null, null, "24.09");
    }

    @Test
    void applyOnDevice_wingetDoesNotRunAndNothingToAdoptInto_noPackageButTheLatestVersionIsKnown() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", "141.0");
        stubDevice(Map.of(PackageManagerType.WINGET, PackageManagerState.UNSUPPORTED));
        stubMatch(chrome, PackageMatch.of(wingetPackage("Google.Chrome", "142.0")));

        // execution
        status().applyOnDevice(MACHINE_ID, List.of(chrome));

        // verifications
        assertThat(chrome)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getLatestVersion,
                        SoftwareResponse::getVersionStatus, SoftwareResponse::getAutoUpdate,
                        SoftwareResponse::getManagingPackage)
                .containsExactly(SoftwareSource.UNMANAGED, "142.0", SoftwareVersionStatus.OUTDATED,
                        SoftwareAutoUpdateStatus.NO_PACKAGE, null);
    }

    @Test
    void applyOnDevice_deviceThatNeverReportedItsManagers_wingetManages() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", "141.0");
        PackageCatalogEntry wingetChrome = wingetPackage("Google.Chrome", "142.0");
        stubDevice(null);
        stubMatch(chrome, PackageMatch.of(wingetChrome));

        // execution
        status().applyOnDevice(MACHINE_ID, List.of(chrome));

        // verifications
        assertThat(chrome.getManagingPackage()).isSameAs(wingetChrome);
    }

    @Test
    void applyOnDevice_unknownDevice_asForTheTenant() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", "141.0");
        PackageCatalogEntry wingetChrome = wingetPackage("Google.Chrome", "142.0");
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.empty());
        stubMatch(chrome, PackageMatch.of(wingetChrome));

        // execution
        status().applyOnDevice(MACHINE_ID, List.of(chrome));

        // verifications
        assertThat(chrome.getManagingPackage()).isSameAs(wingetChrome);
    }

    private Machine stubDevice(Map<PackageManagerType, PackageManagerState> packageManagers) {
        Machine device = new Machine();
        device.setMachineId(MACHINE_ID);
        device.setPackageManagers(packageManagers);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.of(device));
        when(packageAdoptReach.isReachable(MACHINE_ID)).thenReturn(true);
        return device;
    }

    private void stubAdoptionMatch(SoftwareResponse row, PackageMatch match) {
        when(packageMatcher.matchForAdoption(anyList())).thenAnswer(invocation -> {
            List<InstalledProgram> programs = invocation.getArgument(0);
            Map<InstalledProgram, PackageMatch> matches = new IdentityHashMap<>();
            programs.stream()
                    .filter(program -> row.getName().equals(program.getName()))
                    .forEach(program -> matches.put(program, match));
            return matches;
        });
    }

    private static PackageCatalogEntry chocoPackage(String id, String version) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.CHOCO)
                .packageId(id)
                .version(version)
                .build();
    }

    private void stubMatch(SoftwareResponse row, PackageMatch match) {
        when(packageMatcher.match(anyList())).thenAnswer(invocation -> {
            List<InstalledProgram> programs = invocation.getArgument(0);
            Map<InstalledProgram, PackageMatch> matches = new IdentityHashMap<>();
            programs.stream()
                    .filter(program -> row.getName().equals(program.getName()))
                    .forEach(program -> matches.put(program, match));
            return matches;
        });
    }

    private static PackageCatalogEntry wingetPackage(String id, String version) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET)
                .packageId(id)
                .version(version)
                .build();
    }

    private static SoftwareResponse program(String name, String currentVersion) {
        SoftwareResponse program = row(name, SoftwareSource.UNMANAGED, currentVersion, 0);
        program.setFleetSource(FleetSource.PROGRAMS);
        return program;
    }

    @Test
    void apply_rowWithoutKeyLists_matcherGetsEmptyListsAndNoSystemComponent() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", "142.0");
        List<InstalledProgram> asked = new ArrayList<>();
        when(packageMatcher.match(anyList())).thenAnswer(invocation -> {
            asked.addAll(invocation.getArgument(0));
            return new IdentityHashMap<>();
        });

        // execution
        status().apply(List.of(chrome));

        // verifications
        assertThat(asked).hasSize(1);
        assertThat(asked.getFirst().getProductCodes()).isEmpty();
        assertThat(asked.getFirst().getPackageFamilyNames()).isEmpty();
        assertThat(asked.getFirst().isSystemComponent()).isFalse();
        assertThat(asked.getFirst().getStoredMatch()).isNull();
    }

    @Test
    void apply_macAppWithACaskToAdoptInto_needsAdoptionWithTheCask() {
        // setup
        SoftwareResponse slack = macApp("Slack", "4.40");
        stubAdoptionMatch(slack, PackageMatch.of(brewCask("slack", "4.41")));
        when(packageManagerAvailability.isEnabled(PackageManagerType.BREW)).thenReturn(true);

        // execution
        status().apply(List.of(slack));

        // verifications
        assertThat(slack)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getAutoUpdate,
                        SoftwareResponse::getManagingPackage, SoftwareResponse::getAdoptionPackage)
                .containsExactly(SoftwareSource.UNMANAGED, SoftwareAutoUpdateStatus.NEEDS_ADOPTION, null,
                        adoptionIntoCask("slack", "4.41"));
    }

    @ParameterizedTest
    @CsvSource({
            "'3.3.3,5004', 3.3.3",
            "latest, ",
            ", "
    })
    void apply_macAppAndACaskVersionWithABuildOrWithoutANumber_latestAsAnAppReportsIt(String caskVersion,
                                                                                     String latest) {
        // setup
        SoftwareResponse slack = macApp("Slack", "3.3.2");
        stubAdoptionMatch(slack, PackageMatch.of(brewCask("slack", caskVersion)));
        when(packageManagerAvailability.isEnabled(PackageManagerType.BREW)).thenReturn(true);

        // execution
        status().apply(List.of(slack));

        // verifications
        assertThat(slack)
                .extracting(SoftwareResponse::getLatestVersion, SoftwareResponse::getAdoptionPackage)
                .containsExactly(latest, adoptionIntoCask("slack", latest));
    }

    @Test
    void apply_macAppNoCaskFits_noPackage() {
        // setup
        SoftwareResponse tool = macApp("Contoso Tool", "1.0");
        stubAdoptionMatch(tool, PackageMatch.noPackage());

        // execution
        status().apply(List.of(tool));

        // verifications
        assertThat(tool)
                .extracting(SoftwareResponse::getAutoUpdate, SoftwareResponse::getAdoptionPackage)
                .containsExactly(SoftwareAutoUpdateStatus.NO_PACKAGE, null);
    }

    @Test
    void apply_macAppWithSeveralCasksAndNoBestOne_leftUnknown() {
        // setup
        SoftwareResponse tool = macApp("Contoso Tool", "1.0");
        stubAdoptionMatch(tool, PackageMatch.ambiguous());

        // execution
        status().apply(List.of(tool));

        // verifications
        assertThat(tool)
                .extracting(SoftwareResponse::getAutoUpdate, SoftwareResponse::getAdoptionPackage)
                .containsExactly(null, null);
    }

    @Test
    void applyOnDevice_macAppOnADeviceThatCanRunBrew_needsAdoptionWithTheCask() {
        // setup
        SoftwareResponse slack = macApp("Slack", "4.40");
        Machine mac = stubDevice(Map.of(PackageManagerType.BREW, PackageManagerState.MISSING));
        stubAdoptionMatch(slack, PackageMatch.of(brewCask("slack", "4.41")));
        when(packageManagerAvailability.isAdoptableOn(mac, PackageManagerType.BREW)).thenReturn(true);

        // execution
        status().applyOnDevice(MACHINE_ID, List.of(slack));

        // verifications
        assertThat(slack)
                .extracting(SoftwareResponse::getAutoUpdate, SoftwareResponse::getManagingPackage,
                        SoftwareResponse::getAdoptionPackage)
                .containsExactly(SoftwareAutoUpdateStatus.NEEDS_ADOPTION, null, adoptionIntoCask("slack", "4.41"));
    }

    @Test
    void applyOnDevice_macAppOnADeviceTheAdoptOrderCannotReach_manuallyInstalledWithoutTheOffer() {
        // setup
        SoftwareResponse slack = macApp("Slack", "4.40");
        Machine mac = new Machine();
        mac.setMachineId(MACHINE_ID);
        mac.setPackageManagers(Map.of(PackageManagerType.BREW, PackageManagerState.PRESENT));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.of(mac));
        when(packageAdoptReach.isReachable(MACHINE_ID)).thenReturn(false);
        stubAdoptionMatch(slack, PackageMatch.of(brewCask("slack", "4.41")));

        // execution
        status().applyOnDevice(MACHINE_ID, List.of(slack));

        // verifications
        assertThat(slack)
                .extracting(SoftwareResponse::getAutoUpdate, SoftwareResponse::getAdoptionPackage,
                        SoftwareResponse::getLatestVersion)
                .containsExactly(SoftwareAutoUpdateStatus.NO_PACKAGE, null, "4.41");
        verify(packageManagerAvailability, never()).isAdoptableOn(mac, PackageManagerType.BREW);
    }

    @Test
    void applyOnDevice_macAppOnADeviceWhereBrewIsUnsupported_noPackage() {
        // setup
        SoftwareResponse slack = macApp("Slack", "4.40");
        Machine mac = stubDevice(Map.of(PackageManagerType.BREW, PackageManagerState.UNSUPPORTED));
        stubAdoptionMatch(slack, PackageMatch.of(brewCask("slack", "4.41")));
        when(packageManagerAvailability.isAdoptableOn(mac, PackageManagerType.BREW)).thenReturn(false);

        // execution
        status().applyOnDevice(MACHINE_ID, List.of(slack));

        // verifications
        assertThat(slack)
                .extracting(SoftwareResponse::getAutoUpdate, SoftwareResponse::getManagingPackage,
                        SoftwareResponse::getAdoptionPackage)
                .containsExactly(SoftwareAutoUpdateStatus.NO_PACKAGE, null, null);
    }

    @ParameterizedTest
    @CsvSource({
            "'3.3.3,5004', 3.3.3",
            "latest, ",
            ", "
    })
    void applyOnDevice_brewUnsupportedAndACaskVersionWithABuildOrWithoutANumber_latestAsAnAppReportsIt(
            String caskVersion, String latest) {
        // setup
        SoftwareResponse slack = macApp("Slack", "3.3.2");
        Machine mac = stubDevice(Map.of(PackageManagerType.BREW, PackageManagerState.UNSUPPORTED));
        stubAdoptionMatch(slack, PackageMatch.of(brewCask("slack", caskVersion)));
        when(packageManagerAvailability.isAdoptableOn(mac, PackageManagerType.BREW)).thenReturn(false);

        // execution
        status().applyOnDevice(MACHINE_ID, List.of(slack));

        // verifications
        assertThat(slack)
                .extracting(SoftwareResponse::getLatestVersion, SoftwareResponse::getAutoUpdate)
                .containsExactly(latest, SoftwareAutoUpdateStatus.NO_PACKAGE);
    }

    private static SoftwareResponse macApp(String name, String currentVersion) {
        SoftwareResponse app = row(name, SoftwareSource.UNMANAGED, currentVersion, 0);
        app.setFleetSource(FleetSource.APPS);
        return app;
    }

    private static SoftwareBundlePackage adoptionIntoCask(String token, String version) {
        return SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.BREW)
                .packageName(token)
                .brewPackageType(BrewPackageType.CASK)
                .version(version)
                .build();
    }

    private static PackageCatalogEntry brewCask(String token, String version) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.BREW)
                .brewType(BrewPackageType.CASK)
                .packageId(token)
                .version(version)
                .build();
    }

    @Test
    void programOf_macApp_carriesItsBundleIdAppFileNamesAndTopLevelFlag() {
        // setup
        SoftwareResponse slack = row("Slack", SoftwareSource.UNMANAGED, "4.4", 0);
        slack.setFleetSource(FleetSource.APPS);
        slack.setBundleIdentifier("com.tinyspeck.slackmacgap");
        slack.setAppFileNames(List.of("Slack"));
        slack.setTopLevelApp(true);

        // execution
        InstalledProgram program = SoftwareCatalogStatus.programOf(slack);

        // verifications
        assertThat(program.getFleetSource()).isEqualTo(FleetSource.APPS);
        assertThat(program.getBundleIdentifier()).isEqualTo("com.tinyspeck.slackmacgap");
        assertThat(program.getAppFileNames()).containsExactly("Slack");
        assertThat(program.getTopLevelApp()).isTrue();
    }

    @Test
    void programOf_rowWithoutAppKeys_noBundleIdNoAppFileNamesTopLevelUnknown() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", "142.0");

        // execution
        InstalledProgram program = SoftwareCatalogStatus.programOf(chrome);

        // verifications
        assertThat(program.getBundleIdentifier()).isNull();
        assertThat(program.getAppFileNames()).isEmpty();
        assertThat(program.getTopLevelApp()).isNull();
    }
}
