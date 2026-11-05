package com.openframe.api.service.rmm.software.matching;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.data.document.packagesearch.PackageManagerType;

import java.util.List;

public interface PackageMatcher {

    PackageManagerType getManager();

    // one result per row, in the order of the rows
    List<PackageMatch> match(List<SoftwareResponse> rows);
}
