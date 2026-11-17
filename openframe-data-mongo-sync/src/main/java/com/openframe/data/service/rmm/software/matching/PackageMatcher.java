package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.rmm.software.FleetSource;

import java.util.List;

// finds the catalog package behind the rows of one osquery table, the way the package manager itself does
public interface PackageMatcher {

    FleetSource getFleetSource();

    // one result per program, in the order of the programs
    List<PackageMatch> match(List<InstalledProgram> programs);
}
