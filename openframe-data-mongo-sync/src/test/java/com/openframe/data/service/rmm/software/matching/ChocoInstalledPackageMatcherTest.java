package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChocoInstalledPackageMatcherTest {

    private static final String CHROME_ID = "GoogleChrome";
    private static final String SEVEN_ZIP_ID = "7zip";

    @Mock private PackageCatalogRepository catalogRepository;

    @InjectMocks private ChocoInstalledPackageMatcher matcher;

    private PackageCatalogEntry chrome;
    private PackageCatalogEntry sevenZip;

    @BeforeEach
    void setUp() {
        chrome = entry(CHROME_ID);
        sevenZip = entry(SEVEN_ZIP_ID);
    }

    @Test
    void getFleetSource_theTableOfPackagesChocoInstalled() {
        // execution
        FleetSource fleetSource = matcher.getFleetSource();

        // verifications
        assertThat(fleetSource).isEqualTo(FleetSource.CHOCOLATEY_PACKAGES);
    }

    @Test
    void isForAdoption_chocoUpdatesWhatItInstalled_false() {
        // execution
        boolean forAdoption = matcher.isForAdoption();

        // verifications
        assertThat(forAdoption).isFalse();
    }

    @Test
    void conditionalOnProperty_chocoEnabledSwitch_beanOnlyWhenTrue() {
        // execution
        ConditionalOnProperty condition = ChocoInstalledPackageMatcher.class.getAnnotation(ConditionalOnProperty.class);

        // verifications
        assertThat(condition).isNotNull();
        assertThat(condition.name()).containsExactly("openframe.package-managers.choco-enabled");
        assertThat(condition.havingValue()).isEqualTo("true");
        assertThat(condition.matchIfMissing()).isFalse();
    }

    @Test
    void match_nameEqualsTheCatalogId_matched() {
        // setup
        when(catalogRepository.findByManager(PackageManagerType.CHOCO)).thenReturn(List.of(sevenZip, chrome));
        List<InstalledProgram> programs = List.of(program(CHROME_ID));

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::isMatched, PackageMatch::getEntry)
                .containsExactly(tuple(true, chrome));
    }

    @Test
    void match_nameInAnotherLetterCase_matched() {
        // setup
        when(catalogRepository.findByManager(PackageManagerType.CHOCO)).thenReturn(List.of(sevenZip, chrome));
        List<InstalledProgram> programs = List.of(program("googlechrome"), program("7ZIP"));

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::getEntry)
                .containsExactly(chrome, sevenZip);
    }

    @Test
    void match_catalogIdsDifferOnlyByLetterCase_firstEntryMatched() {
        // setup
        PackageCatalogEntry lowerCaseChrome = entry("googlechrome");
        when(catalogRepository.findByManager(PackageManagerType.CHOCO)).thenReturn(List.of(chrome, lowerCaseChrome));
        List<InstalledProgram> programs = List.of(program("GOOGLECHROME"));

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).getEntry()).isSameAs(chrome);
    }

    @Test
    void match_nameNotInTheCatalog_noPackage() {
        // setup
        when(catalogRepository.findByManager(PackageManagerType.CHOCO)).thenReturn(List.of(sevenZip, chrome));
        List<InstalledProgram> programs = List.of(program("7zip.install"));

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::isMatched, PackageMatch::hasNoPackage)
                .containsExactly(tuple(false, true));
    }

    @Test
    void match_emptyCatalog_noPackage() {
        // setup
        when(catalogRepository.findByManager(PackageManagerType.CHOCO)).thenReturn(List.of());
        List<InstalledProgram> programs = List.of(program(CHROME_ID));

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::hasNoPackage)
                .containsExactly(true);
    }

    @Test
    void match_severalPrograms_resultsInProgramOrder() {
        // setup
        when(catalogRepository.findByManager(PackageManagerType.CHOCO)).thenReturn(List.of(chrome, sevenZip));
        List<InstalledProgram> programs = List.of(program("KB2919355"), program(SEVEN_ZIP_ID),
                program("chocolatey-core.extension"), program(CHROME_ID));

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::getEntry)
                .containsExactly(null, sevenZip, null, chrome);
    }

    @Test
    void match_severalPrograms_catalogLoadedOnce() {
        // setup
        when(catalogRepository.findByManager(PackageManagerType.CHOCO)).thenReturn(List.of(chrome, sevenZip));
        List<InstalledProgram> programs = List.of(program(CHROME_ID), program(SEVEN_ZIP_ID), program("KB2919355"));

        // execution
        matcher.match(programs);

        // verifications
        verify(catalogRepository).findByManager(PackageManagerType.CHOCO);
    }

    @Test
    void match_programWithoutANameAmongOthers_noPackageForItOthersMatched() {
        // setup
        when(catalogRepository.findByManager(PackageManagerType.CHOCO)).thenReturn(List.of(chrome, sevenZip));
        List<InstalledProgram> programs = List.of(program(null), program(CHROME_ID));

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::hasNoPackage, PackageMatch::getEntry)
                .containsExactly(tuple(true, null), tuple(false, chrome));
    }

    @Test
    void match_onlyProgramsWithoutAName_noPackageEach() {
        // setup
        List<InstalledProgram> programs = List.of(program(null), program(null));

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches)
                .extracting(PackageMatch::hasNoPackage)
                .containsExactly(true, true);
    }

    @Test
    void match_noPrograms_empty() {
        // setup
        List<InstalledProgram> programs = List.of();

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches).isEmpty();
    }

    private static InstalledProgram program(String name) {
        return InstalledProgram.builder()
                .fleetSource(FleetSource.CHOCOLATEY_PACKAGES)
                .name(name)
                .build();
    }

    private static PackageCatalogEntry entry(String packageId) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.CHOCO)
                .packageId(packageId)
                .build();
    }
}
