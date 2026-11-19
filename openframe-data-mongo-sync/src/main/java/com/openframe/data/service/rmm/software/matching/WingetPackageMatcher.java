package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class WingetPackageMatcher implements PackageMatcher {

    private final ProgramPackageCorrelator programPackageCorrelator;

    @Override
    public FleetSource getFleetSource() {
        return FleetSource.PROGRAMS;
    }

    @Override
    public boolean isForAdoption() {
        return false;
    }

    @Override
    public List<PackageMatch> match(List<InstalledProgram> programs) {
        return programPackageCorrelator.correlate(PackageManagerType.WINGET, programs);
    }
}
