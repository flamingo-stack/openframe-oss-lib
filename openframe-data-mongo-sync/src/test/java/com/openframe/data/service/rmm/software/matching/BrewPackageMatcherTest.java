package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BrewPackageMatcherTest {

    @Mock private PackageCatalogRepository catalogRepository;
    @InjectMocks private BrewPackageMatcher matcher;

    @Test
    void match_tokenInTheCatalog_matched_tokenMissing_noPackage() {
        PackageCatalogEntry wget = entry("wget", BrewPackageType.FORMULA, "1.25.0");
        when(catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.BREW, Set.of("wget", "tapped-tool")))
                .thenReturn(List.of(wget));

        List<PackageMatch> matches = matcher.match(List.of(program("Wget"), program("tapped-tool")));

        assertThat(matches.get(0).getEntry()).isSameAs(wget);
        assertThat(matches.get(1).hasNoPackage()).isTrue();
    }

    @Test
    void match_tokenIsBothFormulaAndCask_takesTheFormula() {
        PackageCatalogEntry cask = entry("docker", BrewPackageType.CASK, "4.40.0");
        PackageCatalogEntry formula = entry("docker", BrewPackageType.FORMULA, "28.0.1");
        when(catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.BREW, Set.of("docker")))
                .thenReturn(List.of(cask, formula));

        List<PackageMatch> matches = matcher.match(List.of(program("docker")));

        assertThat(matches.get(0).getEntry()).isSameAs(formula);
    }

    @Test
    void match_catalogEntryWithoutAVersion_noPackage() {
        when(catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.BREW, Set.of("ghost")))
                .thenReturn(List.of(entry("ghost", BrewPackageType.CASK, null)));

        List<PackageMatch> matches = matcher.match(List.of(program("ghost")));

        assertThat(matches.get(0).hasNoPackage()).isTrue();
    }

    @Test
    void match_programWithoutAName_noPackage_catalogNotAsked() {
        List<PackageMatch> matches = matcher.match(List.of(program(null)));

        assertThat(matches.get(0).hasNoPackage()).isTrue();
        verifyNoInteractions(catalogRepository);
    }

    private static InstalledProgram program(String name) {
        return InstalledProgram.builder().fleetSource(FleetSource.HOMEBREW_PACKAGES).name(name).build();
    }

    private static PackageCatalogEntry entry(String token, BrewPackageType type, String version) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.BREW).packageId(token).brewType(type).version(version).build();
    }
}
