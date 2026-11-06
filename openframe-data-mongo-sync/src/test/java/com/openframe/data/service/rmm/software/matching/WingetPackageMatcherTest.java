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
class WingetPackageMatcherTest {

    private static final String ACROBAT_UPGRADE_CODE = "{AC76BA86-1033-FFFF-7760-BC15014EA700}";

    @Mock private PackageCatalogRepository catalogRepository;

    @Captor private ArgumentCaptor<Collection<String>> keysCaptor;

    @InjectMocks private WingetPackageMatcher matcher;

    @Test
    void match_upgradeCodeOfOnePackage_thatPackage() {
        // setup
        InstalledProgram acrobat = program("Adobe Acrobat (64-bit)", "Adobe", ACROBAT_UPGRADE_CODE, null);
        PackageCatalogEntry reader = wingetPackage("Adobe.Acrobat.Reader.64-bit", List.of(), List.of());
        reader.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        stubCatalog(reader);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(acrobat));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(reader);
    }

    @Test
    void match_codes_queriedLowerCase() {
        // setup
        InstalledProgram git = program("Git", "The Git Development Community", ACROBAT_UPGRADE_CODE, "Git_is1");

        // execution
        matcher.match(List.of(git));

        // verifications
        verify(catalogRepository).findByManagerAndAnyMatchingKey(eq(PackageManagerType.WINGET), keysCaptor.capture(),
                anyCollection(), anyCollection(), anyCollection());
        assertThat(keysCaptor.getValue()).containsExactly("git_is1");
    }

    @Test
    void match_nameAndPublisher_thePackageWithBoth() {
        // setup
        InstalledProgram git = program("Git", "The Git Development Community", null, null);
        PackageCatalogEntry gitGit = wingetPackage("Git.Git", List.of("git"), List.of("thegitdevelopmentcommunity"));
        PackageCatalogEntry microsoftGit = wingetPackage("Microsoft.Git", List.of("git"), List.of("thegitclientteamatmicrosoft"));
        stubCatalog(gitGit, microsoftGit);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(git));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(gitGit);
    }

    @Test
    void match_nameWithoutAPublisher_noNameSearch() {
        // setup
        InstalledProgram git = program("Git", null, null, null);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(git));

        // verifications
        assertThat(matches).extracting(PackageMatch::hasNoPackage).containsExactly(true);
        verifyNoInteractions(catalogRepository);
    }

    @Test
    void match_nameWithArchitecture_architectureSearchFirst() {
        // setup
        InstalledProgram firefox = program("Mozilla Firefox (x64 en-US)", "Mozilla", null, null);
        PackageCatalogEntry mozilla = wingetPackage("Mozilla.Firefox", List.of("mozillafirefox(X64)", "mozillafirefox"),
                List.of("mozilla"));
        PackageCatalogEntry afrikaans = wingetPackage("Mozilla.Firefox.af", List.of("mozillafirefox"), List.of("mozilla"));
        stubCatalog(mozilla, afrikaans);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(firefox));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(mozilla);
    }

    @Test
    void match_severalByNameOneByCode_theOneByCode() {
        // setup
        InstalledProgram chrome = program("Google Chrome", "Google LLC", null, "Google Chrome");
        PackageCatalogEntry chromeMsi = wingetPackage("Google.Chrome", List.of("googlechrome"), List.of("google"));
        chromeMsi.setProductCodes(List.of("google chrome"));
        PackageCatalogEntry chromeExe = wingetPackage("Google.Chrome.EXE", List.of("googlechrome"), List.of("google"));
        stubCatalog(chromeMsi, chromeExe);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(chrome));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(chromeMsi);
    }

    @Test
    void match_severalByNameNoneByCode_ambiguous() {
        // setup
        InstalledProgram chrome = program("Google Chrome", "Google LLC", null, null);
        stubCatalog(wingetPackage("Google.Chrome", List.of("googlechrome"), List.of("google")),
                wingetPackage("Google.Chrome.EXE", List.of("googlechrome"), List.of("google")));

        // execution
        List<PackageMatch> matches = matcher.match(List.of(chrome));

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::isMatched, PackageMatch::hasNoPackage)
                .containsExactly(tuple(false, false));
    }

    @Test
    void match_twoPackagesByCode_ambiguous() {
        // setup
        InstalledProgram tool = program("Tool", "Contoso", ACROBAT_UPGRADE_CODE, null);
        PackageCatalogEntry first = wingetPackage("Contoso.Tool", List.of(), List.of());
        first.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        PackageCatalogEntry second = wingetPackage("Other.Tool", List.of(), List.of());
        second.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        stubCatalog(first, second);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(tool));

        // verifications
        assertThat(matches).extracting(PackageMatch::isMatched).containsExactly(false);
    }

    @Test
    void match_blankUpgradeCode_notAKey() {
        // setup
        InstalledProgram tool = program("Contoso Tool", null, "", null);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(tool));

        // verifications
        assertThat(matches).extracting(PackageMatch::hasNoPackage).containsExactly(true);
        verifyNoInteractions(catalogRepository);
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
    void match_msixPackage_byItsPackageFamilyName() {
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
        List<PackageMatch> matches = matcher.match(List.of(xaml));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(xaml28);
        verify(catalogRepository).findByManagerAndAnyMatchingKey(eq(PackageManagerType.WINGET), anyCollection(),
                anyCollection(), keysCaptor.capture(), anyCollection());
        assertThat(keysCaptor.getValue()).containsExactly("microsoft.ui.xaml.2.8_8wekyb3d8bbwe");
    }

    @Test
    void match_systemComponent_noPackageWithoutASearch() {
        // setup
        InstalledProgram refreshManager = InstalledProgram.builder()
                .name("Adobe Refresh Manager").publisher("Adobe Systems Incorporated").fleetSource(FleetSource.PROGRAMS)
                .productCodes(List.of("{AC76BA86-0804-1033-1959-018244601180}")).systemComponent(true)
                .build();

        // execution
        List<PackageMatch> matches = matcher.match(List.of(refreshManager));

        // verifications
        assertThat(matches).extracting(PackageMatch::hasNoPackage).containsExactly(true);
        verifyNoInteractions(catalogRepository);
    }
}
