package com.openframe.data.service.rmm.software.matching;

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
class WingetInstalledPackageMatcherTest {

    @Mock private PackageCatalogRepository catalogRepository;
    @InjectMocks private WingetInstalledPackageMatcher matcher;

    @Test
    void getFleetSource_theTableOfPackagesWingetInstalled() {
        assertThat(matcher.getFleetSource()).isEqualTo(FleetSource.WINGET_PACKAGES);
    }

    @Test
    void isForAdoption_wingetUpdatesWhatItInstalled_false() {
        assertThat(matcher.isForAdoption()).isFalse();
    }

    @Test
    void match_idInTheCatalog_matched_idMissing_noPackage() {
        PackageCatalogEntry chrome = entry("Google.Chrome");
        when(catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.WINGET, Set.of("Google.Chrome", "9NBLGGH4NNS1")))
                .thenReturn(List.of(chrome));

        List<PackageMatch> matches = matcher.match(List.of(program("Google.Chrome"), program("9NBLGGH4NNS1")));

        assertThat(matches.get(0).getEntry()).isSameAs(chrome);
        assertThat(matches.get(1).hasNoPackage()).isTrue();
    }

    @Test
    void match_devicesReportDifferentIds_ambiguous() {
        when(catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.WINGET, Set.of("Zoom.Zoom", "Zoom.Zoom.EXE")))
                .thenReturn(List.of(entry("Zoom.Zoom"), entry("Zoom.Zoom.EXE")));

        List<PackageMatch> matches = matcher.match(List.of(program("Zoom.Zoom", "Zoom.Zoom.EXE")));

        assertThat(matches.get(0).isMatched()).isFalse();
        assertThat(matches.get(0).hasNoPackage()).isFalse();
    }

    @Test
    void match_programWithoutAnId_noPackage_catalogNotAsked() {
        List<PackageMatch> matches = matcher.match(List.of(program()));

        assertThat(matches.get(0).hasNoPackage()).isTrue();
        verifyNoInteractions(catalogRepository);
    }

    private static InstalledProgram program(String... wingetIds) {
        return InstalledProgram.builder()
                .fleetSource(FleetSource.WINGET_PACKAGES).name("Some Program").wingetIds(List.of(wingetIds)).build();
    }

    private static PackageCatalogEntry entry(String packageId) {
        return PackageCatalogEntry.builder().manager(PackageManagerType.WINGET).packageId(packageId).build();
    }
}
