package com.openframe.api.service.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;

import java.util.List;

public interface PackageManagerHandler {

    PackageManagerType manager();

    SoftwareScriptCode scriptCode(SoftwareAction action);

    List<String> buildArgs(String packageName, BrewPackageType packageType);
}
