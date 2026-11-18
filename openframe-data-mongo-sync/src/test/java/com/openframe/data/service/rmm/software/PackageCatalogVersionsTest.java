package com.openframe.data.service.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageCatalogVersionsTest {

    @Mock private PackageCatalogRepository catalogRepository;

    @InjectMocks private PackageCatalogVersions catalogVersions;

    @Test
    void brew_formulaAndCaskTwins_theBrewTypePicks() {
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.BREW, "docker")).thenReturn(List.of(
                entry(PackageManagerType.BREW, "docker", BrewPackageType.FORMULA, "28.1.1"),
                entry(PackageManagerType.BREW, "docker", BrewPackageType.CASK, "4.41.2")));

        assertThat(catalogVersions.latest(PackageManagerType.BREW, "docker", BrewPackageType.CASK)).isEqualTo("4.41.2");
        assertThat(catalogVersions.latest(PackageManagerType.BREW, "docker", BrewPackageType.FORMULA)).isEqualTo("28.1.1");
    }

    @Test
    void winget_versionOfThePackage() {
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.WINGET, "Google.Chrome"))
                .thenReturn(List.of(entry(PackageManagerType.WINGET, "Google.Chrome", null, "142.0.7444.60")));

        assertThat(catalogVersions.hasLatest(PackageManagerType.WINGET, "Google.Chrome", null)).isTrue();
        assertThat(catalogVersions.latest(PackageManagerType.WINGET, "Google.Chrome", null)).isEqualTo("142.0.7444.60");
    }

    @Test
    void notInCatalog_noLatest_andAskingForItFails() {
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.CHOCO, "googlechrome"))
                .thenReturn(List.of());

        assertThat(catalogVersions.hasLatest(PackageManagerType.CHOCO, "googlechrome", null)).isFalse();
        assertThatThrownBy(() -> catalogVersions.latest(PackageManagerType.CHOCO, "googlechrome", null))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void shownLatest_wingetPackageWithADisplayVersion_displayVersionReturned() {
        // setup
        PackageCatalogEntry chrome = PackageCatalogEntry.builder().manager(PackageManagerType.WINGET)
                .packageId("Google.Chrome").version("142.0.7444.60").displayVersion("142.0").build();
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.WINGET, "Google.Chrome"))
                .thenReturn(List.of(chrome));

        // execution
        String shownLatest = catalogVersions.shownLatest(PackageManagerType.WINGET, "Google.Chrome", null);

        // verifications
        assertThat(shownLatest).isEqualTo("142.0");
    }

    @Test
    void shownLatest_wingetPackageWithoutADisplayVersion_versionReturned() {
        // setup
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.WINGET, "Google.Chrome"))
                .thenReturn(List.of(entry(PackageManagerType.WINGET, "Google.Chrome", null, "142.0.7444.60")));

        // execution
        String shownLatest = catalogVersions.shownLatest(PackageManagerType.WINGET, "Google.Chrome", null);

        // verifications
        assertThat(shownLatest).isEqualTo("142.0.7444.60");
    }

    @Test
    void shownLatest_brewCaskVersionWithABuild_buildLeftOut() {
        // setup
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.BREW, "maccy"))
                .thenReturn(List.of(entry(PackageManagerType.BREW, "maccy", BrewPackageType.CASK, "3.3.3,5004")));

        // execution
        String shownLatest = catalogVersions.shownLatest(PackageManagerType.BREW, "maccy", BrewPackageType.CASK);

        // verifications
        assertThat(shownLatest).isEqualTo("3.3.3");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = "latest")
    void hasShownLatest_brewCaskWithoutANumberedVersion_false(String version) {
        // setup
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.BREW, "zed"))
                .thenReturn(List.of(entry(PackageManagerType.BREW, "zed", BrewPackageType.CASK, version)));

        // execution
        boolean hasShownLatest = catalogVersions.hasShownLatest(PackageManagerType.BREW, "zed", BrewPackageType.CASK);

        // verifications
        assertThat(hasShownLatest).isFalse();
    }

    @Test
    void shownLatest_packageNotInTheCatalog_throwsIllegalState() {
        // setup
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.CHOCO, "googlechrome"))
                .thenReturn(List.of());

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> catalogVersions.shownLatest(PackageManagerType.CHOCO, "googlechrome", null));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("No catalog version to show of CHOCO/googlechrome");
    }

    private static PackageCatalogEntry entry(PackageManagerType manager, String packageId, BrewPackageType brewType,
                                             String version) {
        return PackageCatalogEntry.builder().manager(manager).packageId(packageId).brewType(brewType).version(version).build();
    }
}
