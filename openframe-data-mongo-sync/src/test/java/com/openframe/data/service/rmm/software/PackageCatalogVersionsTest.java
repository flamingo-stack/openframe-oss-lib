package com.openframe.data.service.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
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

        assertThat(catalogVersions.latest(PackageManagerType.BREW, "docker", BrewPackageType.CASK)).contains("4.41.2");
        assertThat(catalogVersions.latest(PackageManagerType.BREW, "docker", BrewPackageType.FORMULA)).contains("28.1.1");
    }

    @Test
    void winget_versionOfThePackage() {
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.WINGET, "Google.Chrome"))
                .thenReturn(List.of(entry(PackageManagerType.WINGET, "Google.Chrome", null, "142.0.7444.60")));

        assertThat(catalogVersions.latest(PackageManagerType.WINGET, "Google.Chrome", null)).contains("142.0.7444.60");
    }

    @Test
    void notInCatalog_empty() {
        when(catalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.CHOCO, "googlechrome"))
                .thenReturn(List.of());

        assertThat(catalogVersions.latest(PackageManagerType.CHOCO, "googlechrome", null)).isEmpty();
    }

    private static PackageCatalogEntry entry(PackageManagerType manager, String packageId, BrewPackageType brewType,
                                             String version) {
        return PackageCatalogEntry.builder().manager(manager).packageId(packageId).brewType(brewType).version(version).build();
    }
}
