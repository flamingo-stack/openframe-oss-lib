package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVersionStatus;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareCatalogStatusTest {

    private static final String ACROBAT_UPGRADE_CODE = "{AC76BA86-1033-FFFF-7760-BC15014EA700}";

    @Mock private PackageCatalogRepository catalogRepository;

    @Captor private ArgumentCaptor<Collection<String>> keysCaptor;

    private SoftwareCatalogStatus status() {
        return new SoftwareCatalogStatus(catalogRepository);
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
    void apply_windowsProgramWithAWingetUpgradeCode_wingetPackageWithItsLatest() {
        // setup
        SoftwareResponse acrobat = program("Adobe Acrobat (64-bit)", ACROBAT_UPGRADE_CODE, "24.1");
        PackageCatalogEntry reader = wingetPackage("Adobe.Acrobat.Reader.64-bit", "25.1");
        reader.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        when(catalogRepository.findByManagerAndUpgradeCodesIn(eq(PackageManagerType.WINGET), anyCollection()))
                .thenReturn(List.of(reader));

        // execution
        status().apply(List.of(acrobat));

        // verifications
        assertThat(acrobat)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getLatestVersion,
                        SoftwareResponse::getVersionStatus, SoftwareResponse::getAutoUpdate)
                .containsExactly(SoftwareSource.WINGET, "25.1", SoftwareVersionStatus.OUTDATED,
                        SoftwareAutoUpdateStatus.OFF);
    }

    @Test
    void apply_windowsProgramUpgradeCode_queriedLowerCase() {
        // setup
        SoftwareResponse acrobat = program("Adobe Acrobat (64-bit)", ACROBAT_UPGRADE_CODE, "24.1");

        // execution
        status().apply(List.of(acrobat));

        // verifications
        verify(catalogRepository).findByManagerAndUpgradeCodesIn(eq(PackageManagerType.WINGET), keysCaptor.capture());
        assertThat(keysCaptor.getValue()).containsExactly("{ac76ba86-1033-ffff-7760-bc15014ea700}");
    }

    @Test
    void apply_windowsProgramNameWithArchitecture_thePackageOfThatArchitecture() {
        // setup
        SoftwareResponse firefox = program("Mozilla Firefox (x64 en-US)", null, "150.0");
        PackageCatalogEntry mozilla = wingetPackage("Mozilla.Firefox", "154.0.1", "mozillafirefox(X64)",
                "mozillafirefox");
        PackageCatalogEntry other = wingetPackage("Other.Firefox", "1.0", "mozillafirefox");
        stubWingetNames(mozilla, other);

        // execution
        status().apply(List.of(firefox));

        // verifications
        assertThat(firefox.getLatestVersion()).isEqualTo("154.0.1");
    }

    @Test
    void apply_windowsProgramNameOfSeveralVariants_basePackage() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", null, "141.0");
        PackageCatalogEntry base = wingetPackage("Google.Chrome", "141.0", "googlechrome");
        PackageCatalogEntry variant = wingetPackage("Google.Chrome.EXE", "140.0", "googlechrome");
        stubWingetNames(variant, base);

        // execution
        status().apply(List.of(chrome));

        // verifications
        assertThat(chrome)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getVersionStatus)
                .containsExactly(SoftwareSource.WINGET, SoftwareVersionStatus.UP_TO_DATE);
    }

    @Test
    void apply_windowsProgramNameOfUnrelatedPackages_leftUnknown() {
        // setup
        SoftwareResponse notepad = program("Notepad++", null, "8.6");
        PackageCatalogEntry notepadPlusPlus = wingetPackage("Notepad++.Notepad++", "8.9", "notepad");
        PackageCatalogEntry notepadMinusMinus = wingetPackage("ndd.Notepad--", "3.0", "notepad");
        stubWingetNames(notepadPlusPlus, notepadMinusMinus);

        // execution
        status().apply(List.of(notepad));

        // verifications
        assertThat(notepad)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getVersionStatus,
                        SoftwareResponse::getAutoUpdate)
                .containsExactly(SoftwareSource.UNMANAGED, SoftwareVersionStatus.UNKNOWN, null);
    }

    @Test
    void apply_windowsProgramWingetDoesNotCarry_noPackageFound() {
        // setup
        SoftwareResponse tool = program("Contoso Internal Tool", null, "1.0");

        // execution
        status().apply(List.of(tool));

        // verifications
        assertThat(tool)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getAutoUpdate)
                .containsExactly(SoftwareSource.UNMANAGED, SoftwareAutoUpdateStatus.NO_PACKAGE);
    }

    @Test
    void apply_windowsProgramListedUnderAnotherVersion_comparedWithThatVersion() {
        // setup
        SoftwareResponse lemonade = program("Lemonade Server", null, "26.44.1");
        PackageCatalogEntry server = wingetPackage("AMD.LemonadeServer", "2026.44.1", "lemonadeserver");
        server.setDisplayVersion("26.44.1");
        stubWingetNames(server);

        // execution
        status().apply(List.of(lemonade));

        // verifications
        assertThat(lemonade)
                .extracting(SoftwareResponse::getLatestVersion, SoftwareResponse::getVersionStatus)
                .containsExactly("26.44.1", SoftwareVersionStatus.UP_TO_DATE);
    }

    @Test
    void apply_windowsProgramWithAnAutoUpdatePolicy_policyStays() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", null, "141.0");
        chrome.setAutoUpdate(SoftwareAutoUpdateStatus.ON);
        stubWingetNames(wingetPackage("Google.Chrome", "141.0", "googlechrome"));

        // execution
        status().apply(List.of(chrome));

        // verifications
        assertThat(chrome.getAutoUpdate()).isEqualTo(SoftwareAutoUpdateStatus.ON);
    }

    @Test
    void apply_macAppACaskInstalls_brewWithTheCaskVersionWithoutItsBuild() {
        // setup
        SoftwareResponse affinity = macApp("Affinity", "3.3.3");
        PackageCatalogEntry cask = cask("affinity", "3.3.3,5004", "affinity.app");
        when(catalogRepository.findByManagerAndAppNamesIn(eq(PackageManagerType.BREW), anyCollection()))
                .thenReturn(List.of(cask));

        // execution
        status().apply(List.of(affinity));

        // verifications
        assertThat(affinity)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getLatestVersion,
                        SoftwareResponse::getVersionStatus, SoftwareResponse::getAutoUpdate)
                .containsExactly(SoftwareSource.BREW, "3.3.3", SoftwareVersionStatus.UP_TO_DATE, null);
    }

    @Test
    void apply_macApps_queriedByLowerCaseBundleNameWithOneSuffix() {
        // setup
        List<SoftwareResponse> apps = List.of(macApp("Google Chrome", "141.0"), macApp("Firefox.app", "150.0"));

        // execution
        status().apply(apps);

        // verifications
        verify(catalogRepository).findByManagerAndAppNamesIn(eq(PackageManagerType.BREW), keysCaptor.capture());
        assertThat(keysCaptor.getValue()).containsExactlyInAnyOrder("google chrome.app", "firefox.app");
    }

    @Test
    void apply_macAppNoCaskInstalls_untouched() {
        // setup
        SoftwareResponse app = macApp("Contoso Mac Tool", "1.0");

        // execution
        status().apply(List.of(app));

        // verifications
        assertThat(app)
                .extracting(SoftwareResponse::getSource, SoftwareResponse::getVersionStatus,
                        SoftwareResponse::getAutoUpdate)
                .containsExactly(SoftwareSource.UNMANAGED, SoftwareVersionStatus.UNKNOWN, null);
    }

    @Test
    void apply_chocolateyPackage_catalogNotAsked() {
        // setup
        SoftwareResponse chocolatey = row("googlechrome", SoftwareSource.CHOCOLATEY, "141.0", 0);
        chocolatey.setFleetSource("chocolatey_packages");

        // execution
        status().apply(List.of(chocolatey));

        // verifications
        verifyNoInteractions(catalogRepository);
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

    private void catalog(PackageCatalogEntry... entries) {
        when(catalogRepository.findByManagerAndPackageIdIn(eq(PackageManagerType.BREW), any()))
                .thenReturn(List.of(entries));
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

    private void stubWingetNames(PackageCatalogEntry... entries) {
        when(catalogRepository.findByManagerAndNormalizedNamesIn(eq(PackageManagerType.WINGET), anyCollection()))
                .thenReturn(List.of(entries));
    }

    private static PackageCatalogEntry wingetPackage(String id, String version, String... normalizedNames) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET)
                .packageId(id)
                .version(version)
                .normalizedNames(List.of(normalizedNames))
                .build();
    }

    private static PackageCatalogEntry cask(String token, String version, String appName) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.BREW)
                .brewType(BrewPackageType.CASK)
                .packageId(token)
                .version(version)
                .appNames(List.of(appName))
                .build();
    }

    private static SoftwareResponse program(String name, String upgradeCode, String currentVersion) {
        SoftwareResponse program = row(name, SoftwareSource.UNMANAGED, currentVersion, 0);
        program.setFleetSource("programs");
        program.setUpgradeCode(upgradeCode);
        return program;
    }

    private static SoftwareResponse macApp(String name, String currentVersion) {
        SoftwareResponse app = row(name, SoftwareSource.UNMANAGED, currentVersion, 0);
        app.setFleetSource("apps");
        return app;
    }
}
