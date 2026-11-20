package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChocoAdoptionMatcherTest {

    @Mock private ProgramPackageCorrelator programPackageCorrelator;

    @InjectMocks private ChocoAdoptionMatcher matcher;

    @Test
    void getFleetSource_theWindowsProgramsTable() {
        assertThat(matcher.getFleetSource()).isEqualTo(FleetSource.PROGRAMS);
    }

    @Test
    void isForAdoption_chocoUpdatesOnlyWhatItInstalled_true() {
        assertThat(matcher.isForAdoption()).isTrue();
    }

    @Test
    void match_programs_correlatedWithThePackagesOfChoco() {
        // setup
        InstalledProgram sevenZip = InstalledProgram.builder().name("7-Zip 24.09 (x64)").fleetSource(FleetSource.PROGRAMS).build();
        List<InstalledProgram> programs = List.of(sevenZip);
        List<PackageMatch> correlated = List.of(PackageMatch.noPackage());
        when(programPackageCorrelator.correlate(PackageManagerType.CHOCO, programs)).thenReturn(correlated);

        // execution
        List<PackageMatch> matches = matcher.match(programs);

        // verifications
        assertThat(matches).isSameAs(correlated);
    }
}
