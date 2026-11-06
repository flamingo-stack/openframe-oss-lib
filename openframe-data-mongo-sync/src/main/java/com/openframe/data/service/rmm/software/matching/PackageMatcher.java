package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageManagerType;

import java.util.List;

// finds the package of one manager's catalog that an installed program is, the way that manager itself does
public interface PackageMatcher {

    PackageManagerType getManager();

    // one result per program, in the order of the programs
    List<PackageMatch> match(List<InstalledProgram> programs);
}
