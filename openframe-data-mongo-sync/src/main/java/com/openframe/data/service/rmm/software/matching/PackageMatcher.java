package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.rmm.software.FleetSource;

import java.util.List;

// finds the catalog package behind the rows of one osquery table, the way the package manager itself does
public interface PackageMatcher {

    FleetSource getFleetSource();

    // true for a manager that updates only what it installed itself: its match is the package to adopt the program into
    default boolean isForAdoption() {
        return false;
    }

    // one result per program, in the order of the programs
    List<PackageMatch> match(List<InstalledProgram> programs);
}
