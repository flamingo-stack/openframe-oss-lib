package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

// Chocolatey has no correlation of its own: its catalog entries carry winget's keys, written by us per package
@Component
@RequiredArgsConstructor
public class ChocoAdoptionMatcher implements PackageMatcher {

    private final ProgramPackageCorrelator programPackageCorrelator;

    @Override
    public FleetSource getFleetSource() {
        return FleetSource.PROGRAMS;
    }

    @Override
    public boolean isForAdoption() {
        return true;
    }

    @Override
    public List<PackageMatch> match(List<InstalledProgram> programs) {
        return programPackageCorrelator.correlate(PackageManagerType.CHOCO, programs);
    }
}
