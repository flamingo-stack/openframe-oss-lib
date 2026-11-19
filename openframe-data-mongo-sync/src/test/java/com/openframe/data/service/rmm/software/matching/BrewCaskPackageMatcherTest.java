package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BrewCaskPackageMatcherTest {

    @Mock private PackageCatalogRepository catalogRepository;

    private BrewCaskPackageMatcher matcher;

    @BeforeEach
    void setUp() {
        BrewPackageMatcher brewPackageMatcher = new BrewPackageMatcher(catalogRepository);
        matcher = new BrewCaskPackageMatcher(brewPackageMatcher);
    }

    @Test
    void getFleetSource_theCaskRowsOfOurFleet_notForAdoption() {
        assertThat(matcher.getFleetSource()).isEqualTo(FleetSource.HOMEBREW_CASKS);
        assertThat(matcher.isForAdoption()).isFalse();
    }

    @Test
    void match_tokenIsBothFormulaAndCask_takesTheCask() {
        // setup
        PackageCatalogEntry formula = entry("docker", BrewPackageType.FORMULA);
        PackageCatalogEntry cask = entry("docker", BrewPackageType.CASK);
        when(catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.BREW, Set.of("docker")))
                .thenReturn(List.of(formula, cask));
        InstalledProgram docker = program("docker");

        // execution
        List<PackageMatch> matches = matcher.match(List.of(docker));

        // verifications
        assertThat(matches).singleElement().extracting(PackageMatch::getEntry).isSameAs(cask);
    }

    @Test
    void match_tokenInTheCatalog_matched_tokenMissing_noPackage() {
        // setup
        PackageCatalogEntry slack = entry("slack", BrewPackageType.CASK);
        when(catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.BREW, Set.of("slack", "gone")))
                .thenReturn(List.of(slack));
        List<InstalledProgram> programs = List.of(program("Slack"), program("gone"));

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(slack, null);
        assertThat(matches.get(1).hasNoPackage()).isTrue();
    }

    private static InstalledProgram program(String name) {
        return InstalledProgram.builder().name(name).fleetSource(FleetSource.HOMEBREW_CASKS).build();
    }

    private static PackageCatalogEntry entry(String token, BrewPackageType type) {
        return PackageCatalogEntry.builder().manager(PackageManagerType.BREW).packageId(token).brewType(type)
                .version("1.0.0").build();
    }
}
