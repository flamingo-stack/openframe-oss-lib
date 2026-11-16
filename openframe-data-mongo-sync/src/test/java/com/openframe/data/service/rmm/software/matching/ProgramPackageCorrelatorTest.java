package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProgramPackageCorrelatorTest {

    private static final String ACROBAT_UPGRADE_CODE = "{AC76BA86-1033-FFFF-7760-BC15014EA700}";

    @Mock private PackageCatalogRepository catalogRepository;

    @Captor private ArgumentCaptor<Collection<String>> keysCaptor;

    @InjectMocks private ProgramPackageCorrelator programPackageCorrelator;

    @Test
    void correlate_upgradeCodeOfOnePackage_thatPackage() {
        // setup
        InstalledProgram acrobat = program("Adobe Acrobat (64-bit)", "Adobe", ACROBAT_UPGRADE_CODE, null);
        PackageCatalogEntry reader = wingetPackage("Adobe.Acrobat.Reader.64-bit", List.of(), List.of());
        reader.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        stubCatalog(reader);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(acrobat));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(reader);
    }

    @Test
    void correlate_codes_queriedLowerCase() {
        // setup
        InstalledProgram git = program("Git", "The Git Development Community", ACROBAT_UPGRADE_CODE, "Git_is1");

        // execution
        programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(git));

        // verifications
        verify(catalogRepository).findByManagerAndAnyMatchingKey(eq(PackageManagerType.WINGET), keysCaptor.capture(),
                anyCollection(), anyCollection(), anyCollection());
        assertThat(keysCaptor.getValue()).containsExactly("git_is1");
    }

    @Test
    void correlate_nameAndPublisher_thePackageWithBoth() {
        // setup
        InstalledProgram git = program("Git", "The Git Development Community", null, null);
        PackageCatalogEntry gitGit = wingetPackage("Git.Git", List.of("git"), List.of("thegitdevelopmentcommunity"));
        PackageCatalogEntry microsoftGit = wingetPackage("Microsoft.Git", List.of("git"), List.of("thegitclientteamatmicrosoft"));
        stubCatalog(gitGit, microsoftGit);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(git));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(gitGit);
    }

    @Test
    void correlate_nameWithoutAPublisher_noNameSearch() {
        // setup
        InstalledProgram git = program("Git", null, null, null);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(git));

        // verifications
        assertThat(matches).extracting(PackageMatch::hasNoPackage).containsExactly(true);
        verifyNoInteractions(catalogRepository);
    }

    @Test
    void correlate_nameWithArchitecture_architectureSearchFirst() {
        // setup
        InstalledProgram firefox = program("Mozilla Firefox (x64 en-US)", "Mozilla", null, null);
        PackageCatalogEntry mozilla = wingetPackage("Mozilla.Firefox", List.of("mozillafirefox(X64)", "mozillafirefox"),
                List.of("mozilla"));
        PackageCatalogEntry afrikaans = wingetPackage("Mozilla.Firefox.af", List.of("mozillafirefox"), List.of("mozilla"));
        stubCatalog(mozilla, afrikaans);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(firefox));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(mozilla);
    }

    @Test
    void correlate_severalByNameOneByCode_theOneByCode() {
        // setup
        InstalledProgram chrome = program("Google Chrome", "Google LLC", null, "Google Chrome");
        PackageCatalogEntry chromeMsi = wingetPackage("Google.Chrome", List.of("googlechrome"), List.of("google"));
        chromeMsi.setProductCodes(List.of("google chrome"));
        PackageCatalogEntry chromeExe = wingetPackage("Google.Chrome.EXE", List.of("googlechrome"), List.of("google"));
        stubCatalog(chromeMsi, chromeExe);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(chrome));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(chromeMsi);
    }

    @Test
    void correlate_severalByNameNoneByCode_ambiguous() {
        // setup
        InstalledProgram chromium = program("Chromium", "The Chromium Authors", null, null);
        stubCatalog(wingetPackage("eloston.ungoogled-chromium", List.of("chromium"), List.of("thechromiumauthors")),
                wingetPackage("Hibbiki.Chromium", List.of("chromium"), List.of("thechromiumauthors")));

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(chromium));

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::isMatched, PackageMatch::hasNoPackage)
                .containsExactly(tuple(false, false));
    }

    @Test
    void correlate_severalPackages_bestCandidateIsTheMostInstalled() {
        // setup
        InstalledProgram vlc = program("VLC media player", "VideoLAN", null, null);
        PackageCatalogEntry nightly = wingetPackage("VideoLAN.VLC.Nightly", List.of("vlcmediaplayer"), List.of("videolan"));
        nightly.setPopularity(40);
        PackageCatalogEntry stable = wingetPackage("VideoLAN.VLC.Stable", List.of("vlcmediaplayer"), List.of("videolan"));
        stable.setPopularity(9000);
        stubCatalog(nightly, stable);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(vlc));

        // verifications
        assertThat(matches).extracting(PackageMatch::isMatched).containsExactly(false);
        assertThat(matches.getFirst().getBestCandidate()).isSameAs(stable);
    }

    @Test
    void correlate_severalPackagesEquallyInstalled_bestCandidateHasTheShortestId() {
        // setup
        InstalledProgram chromium = program("Chromium", "The Chromium Authors", null, null);
        PackageCatalogEntry ungoogled =
                wingetPackage("eloston.ungoogled-chromium", List.of("chromium"), List.of("thechromiumauthors"));
        PackageCatalogEntry hibbiki = wingetPackage("Hibbiki.Chromium", List.of("chromium"), List.of("thechromiumauthors"));
        stubCatalog(ungoogled, hibbiki);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(chromium));

        // verifications
        assertThat(matches.getFirst().getBestCandidate()).isSameAs(hibbiki);
    }

    @Test
    void correlate_packagesByCodeAndByName_bestCandidateIsOneFoundByCode() {
        // setup
        InstalledProgram tool = program("Tool", "Contoso", ACROBAT_UPGRADE_CODE, null);
        PackageCatalogEntry byName = wingetPackage("A.Tool", List.of("tool"), List.of("contoso"));
        byName.setPopularity(9000);
        PackageCatalogEntry first = wingetPackage("Contoso.Tool", List.of(), List.of());
        first.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        PackageCatalogEntry second = wingetPackage("Fabrikam.Tool", List.of(), List.of());
        second.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        stubCatalog(byName, second, first);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(tool));

        // verifications
        assertThat(matches).extracting(PackageMatch::isMatched).containsExactly(false);
        assertThat(matches.getFirst().getBestCandidate()).isSameAs(first);
    }

    @Test
    void correlate_baseNextToItsVariant_theBase() {
        // setup
        InstalledProgram chrome = program("Google Chrome", "Google LLC", null, null);
        PackageCatalogEntry exe = wingetPackage("Google.Chrome.EXE", List.of("googlechrome"), List.of("google"));
        PackageCatalogEntry base = wingetPackage("Google.Chrome", List.of("googlechrome"), List.of("google"));
        stubCatalog(exe, base);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(chrome));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(base);
    }

    @Test
    void correlate_severalByCodeAndOneByName_decidedAmongTheOnesByCode() {
        // setup
        InstalledProgram tool = program("Tool", "Contoso", ACROBAT_UPGRADE_CODE, null);
        PackageCatalogEntry byName = wingetPackage("A.Tool", List.of("tool"), List.of("contoso"));
        PackageCatalogEntry base = wingetPackage("Contoso.Tool", List.of(), List.of());
        base.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        PackageCatalogEntry beta = wingetPackage("Contoso.Tool.Beta", List.of(), List.of());
        beta.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        stubCatalog(byName, beta, base);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(tool));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(base);
    }

    @Test
    void correlate_packagesOfEveryVersion_theOneOfTheInstalledVersion() {
        // setup
        InstalledProgram runtime = program("Microsoft .NET Runtime - 8.0.34 (x64)", "Microsoft Corporation", null, null);
        PackageCatalogEntry runtime6 = wingetPackage("Microsoft.DotNet.Runtime.6",
                List.of("microsoftnetruntime(X64)", "microsoftnetruntime"), List.of("microsoft"));
        PackageCatalogEntry runtime8 = wingetPackage("Microsoft.DotNet.Runtime.8",
                List.of("microsoftnetruntime(X64)", "microsoftnetruntime"), List.of("microsoft"));
        stubCatalog(runtime6, runtime8);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(runtime));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(runtime8);
    }

    @Test
    void correlate_onePackageOfAnotherVersion_noPackage() {
        // setup
        InstalledProgram sdk = program("Microsoft .NET Framework 4.8 SDK", "Microsoft Corporation", null, null);
        stubCatalog(wingetPackage("Microsoft.DotNet.Framework.DeveloperPack.4.6",
                List.of("microsoftnetframeworksdk"), List.of("microsoft")));

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(sdk));

        // verifications
        assertThat(matches).extracting(PackageMatch::hasNoPackage).containsExactly(true);
    }

    @Test
    void correlate_onePackageOfTheInstalledVersion_thatPackage() {
        // setup
        InstalledProgram sdk = program("Microsoft .NET Framework 4.6.2 SDK", "Microsoft Corporation", null, null);
        PackageCatalogEntry developerPack = wingetPackage("Microsoft.DotNet.Framework.DeveloperPack.4.6",
                List.of("microsoftnetframeworksdk"), List.of("microsoft"));
        stubCatalog(developerPack);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(sdk));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(developerPack);
    }

    @Test
    void correlate_decidedPackageOfAnotherVersion_ambiguousWithoutABestCandidate() {
        // setup
        InstalledProgram sublime = program("Sublime Text Build 3126", "Sublime HQ Pty Ltd", null, null);
        stubCatalog(wingetPackage("SublimeHQ.SublimeText.4", List.of("sublimetext"), List.of("sublimehq")),
                wingetPackage("SublimeHQ.SublimeText.4.Dev", List.of("sublimetext"), List.of("sublimehq")));

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(sublime));

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::isMatched, PackageMatch::hasNoPackage, PackageMatch::getBestCandidate)
                .containsExactly(tuple(false, false, null));
    }

    @Test
    void correlate_twoPackagesByCode_ambiguous() {
        // setup
        InstalledProgram tool = program("Tool", "Contoso", ACROBAT_UPGRADE_CODE, null);
        PackageCatalogEntry first = wingetPackage("Contoso.Tool", List.of(), List.of());
        first.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        PackageCatalogEntry second = wingetPackage("Other.Tool", List.of(), List.of());
        second.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        stubCatalog(first, second);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(tool));

        // verifications
        assertThat(matches).extracting(PackageMatch::isMatched).containsExactly(false);
    }

    @Test
    void correlate_blankUpgradeCode_notAKey() {
        // setup
        InstalledProgram tool = program("Contoso Tool", null, "", null);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(tool));

        // verifications
        assertThat(matches).extracting(PackageMatch::hasNoPackage).containsExactly(true);
        verifyNoInteractions(catalogRepository);
    }

    @Test
    void correlate_packagesOfAnotherManager_searchedAmongThatManagersPackages() {
        // setup
        InstalledProgram git = program("Git", "The Git Development Community", null, null);
        PackageCatalogEntry chocoGit = PackageCatalogEntry.builder().manager(PackageManagerType.CHOCO).packageId("git")
                .normalizedNames(List.of("git")).normalizedPublishers(List.of("thegitdevelopmentcommunity")).build();
        when(catalogRepository.findByManagerAndAnyMatchingKey(eq(PackageManagerType.CHOCO), anyCollection(),
                anyCollection(), anyCollection(), anyCollection()))
                .thenReturn(List.of(chocoGit));

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.CHOCO, List.of(git));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(chocoGit);
    }

    private void stubCatalog(PackageCatalogEntry... entries) {
        when(catalogRepository.findByManagerAndAnyMatchingKey(eq(PackageManagerType.WINGET), anyCollection(),
                anyCollection(), anyCollection(), anyCollection()))
                .thenReturn(List.of(entries));
    }

    private static PackageCatalogEntry wingetPackage(String id, List<String> names, List<String> publishers) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET)
                .packageId(id)
                .version("1.0")
                .normalizedNames(names)
                .normalizedPublishers(publishers)
                .build();
    }

    private static InstalledProgram program(String name, String publisher, String upgradeCode, String productCode) {
        return InstalledProgram.builder()
                .name(name)
                .publisher(publisher)
                .fleetSource(FleetSource.PROGRAMS)
                .upgradeCode(upgradeCode)
                .productCodes(productCode == null ? List.of() : List.of(productCode))
                .build();
    }

    @Test
    void correlate_msixPackage_byItsPackageFamilyName() {
        // setup
        InstalledProgram xaml = InstalledProgram.builder()
                .name("Microsoft.UI.Xaml.2.8").publisher("Microsoft Platform Extensions").fleetSource(FleetSource.PROGRAMS)
                .packageFamilyNames(List.of("Microsoft.UI.Xaml.2.8_8wekyb3d8bbwe"))
                .build();
        PackageCatalogEntry xaml28 = wingetPackage("Microsoft.UI.Xaml.2.8", List.of(), List.of());
        xaml28.setPackageFamilyNames(List.of("microsoft.ui.xaml.2.8_8wekyb3d8bbwe"));
        PackageCatalogEntry xaml27 = wingetPackage("Microsoft.UI.Xaml.2.7", List.of(), List.of());
        xaml27.setPackageFamilyNames(List.of("microsoft.ui.xaml.2.7_8wekyb3d8bbwe"));
        stubCatalog(xaml28, xaml27);

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(xaml));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(xaml28);
        verify(catalogRepository).findByManagerAndAnyMatchingKey(eq(PackageManagerType.WINGET), anyCollection(),
                anyCollection(), keysCaptor.capture(), anyCollection());
        assertThat(keysCaptor.getValue()).containsExactly("microsoft.ui.xaml.2.8_8wekyb3d8bbwe");
    }

    @Test
    void correlate_systemComponent_noPackageWithoutASearch() {
        // setup
        InstalledProgram refreshManager = InstalledProgram.builder()
                .name("Adobe Refresh Manager").publisher("Adobe Systems Incorporated").fleetSource(FleetSource.PROGRAMS)
                .productCodes(List.of("{AC76BA86-0804-1033-1959-018244601180}")).systemComponent(true)
                .build();

        // execution
        List<PackageMatch> matches = programPackageCorrelator.correlate(PackageManagerType.WINGET, List.of(refreshManager));

        // verifications
        assertThat(matches).extracting(PackageMatch::hasNoPackage).containsExactly(true);
        verifyNoInteractions(catalogRepository);
    }
}
