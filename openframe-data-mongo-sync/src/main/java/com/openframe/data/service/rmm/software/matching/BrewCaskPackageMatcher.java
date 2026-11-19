package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.rmm.software.FleetSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

// a cask that has an app comes as its own Fleet source, under the cask's token: brew installed it, so brew manages it
@Component
@RequiredArgsConstructor
public class BrewCaskPackageMatcher implements PackageMatcher {

    private final BrewPackageMatcher brewPackageMatcher;

    @Override
    public FleetSource getFleetSource() {
        return FleetSource.HOMEBREW_CASKS;
    }

    @Override
    public boolean isForAdoption() {
        return false;
    }

    @Override
    public List<PackageMatch> match(List<InstalledProgram> programs) {
        return brewPackageMatcher.match(programs, BrewPackageType.CASK);
    }
}
