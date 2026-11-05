package com.openframe.api.service.rmm.software.matching;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WingetPackageMatcherTest {

    private static final String ACROBAT_UPGRADE_CODE = "{AC76BA86-1033-FFFF-7760-BC15014EA700}";

    @Mock private PackageCatalogRepository catalogRepository;

    @Captor private ArgumentCaptor<Collection<String>> keysCaptor;

    @InjectMocks private WingetPackageMatcher matcher;

    @Test
    void match_programWithAWingetUpgradeCode_thatPackage() {
        // setup
        SoftwareResponse acrobat = program("Adobe Acrobat (64-bit)", ACROBAT_UPGRADE_CODE);
        PackageCatalogEntry reader = wingetPackage("Adobe.Acrobat.Reader.64-bit");
        reader.setUpgradeCodes(List.of("{ac76ba86-1033-ffff-7760-bc15014ea700}"));
        when(catalogRepository.findByManagerAndUpgradeCodesIn(eq(PackageManagerType.WINGET), anyCollection()))
                .thenReturn(List.of(reader));

        // execution
        List<PackageMatch> matches = matcher.match(List.of(acrobat));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(reader);
    }

    @Test
    void match_upgradeCode_queriedLowerCase() {
        // setup
        SoftwareResponse acrobat = program("Adobe Acrobat (64-bit)", ACROBAT_UPGRADE_CODE);

        // execution
        matcher.match(List.of(acrobat));

        // verifications
        verify(catalogRepository).findByManagerAndUpgradeCodesIn(eq(PackageManagerType.WINGET), keysCaptor.capture());
        assertThat(keysCaptor.getValue()).containsExactly("{ac76ba86-1033-ffff-7760-bc15014ea700}");
    }

    @Test
    void match_nameWithArchitecture_thePackageOfThatArchitecture() {
        // setup
        SoftwareResponse firefox = program("Mozilla Firefox (x64 en-US)", null);
        PackageCatalogEntry mozilla = wingetPackage("Mozilla.Firefox", "mozillafirefox(X64)", "mozillafirefox");
        PackageCatalogEntry other = wingetPackage("Other.Firefox", "mozillafirefox");
        stubNames(mozilla, other);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(firefox));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(mozilla);
    }

    @Test
    void match_nameOfSeveralVariants_basePackage() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", null);
        PackageCatalogEntry base = wingetPackage("Google.Chrome", "googlechrome");
        PackageCatalogEntry variant = wingetPackage("Google.Chrome.EXE", "googlechrome");
        stubNames(variant, base);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(chrome));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(base);
    }

    @Test
    void match_nameOfUnrelatedPackages_ambiguous() {
        // setup
        SoftwareResponse notepad = program("Notepad++", null);
        stubNames(wingetPackage("Notepad++.Notepad++", "notepad"), wingetPackage("ndd.Notepad--", "notepad"));

        // execution
        List<PackageMatch> matches = matcher.match(List.of(notepad));

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::isMatched, PackageMatch::hasNoPackage)
                .containsExactly(tuple(false, false));
    }

    @Test
    void match_nameWingetDoesNotCarry_noPackage() {
        // setup
        SoftwareResponse tool = program("Contoso Internal Tool", null);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(tool));

        // verifications
        assertThat(matches).extracting(PackageMatch::hasNoPackage).containsExactly(true);
    }

    @Test
    void match_severalRows_oneResultPerRowInOrder() {
        // setup
        SoftwareResponse chrome = program("Google Chrome", null);
        SoftwareResponse tool = program("Contoso Internal Tool", null);
        PackageCatalogEntry google = wingetPackage("Google.Chrome", "googlechrome");
        stubNames(google);

        // execution
        List<PackageMatch> matches = matcher.match(List.of(tool, chrome));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(null, google);
    }

    private void stubNames(PackageCatalogEntry... entries) {
        when(catalogRepository.findByManagerAndNormalizedNamesIn(eq(PackageManagerType.WINGET), anyCollection()))
                .thenReturn(List.of(entries));
    }

    private static PackageCatalogEntry wingetPackage(String id, String... normalizedNames) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET)
                .packageId(id)
                .version("1.0")
                .normalizedNames(List.of(normalizedNames))
                .build();
    }

    private static SoftwareResponse program(String name, String upgradeCode) {
        return SoftwareResponse.builder()
                .name(name)
                .fleetSource("programs")
                .upgradeCode(upgradeCode)
                .build();
    }
}
