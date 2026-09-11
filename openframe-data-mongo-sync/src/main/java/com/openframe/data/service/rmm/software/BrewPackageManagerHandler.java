package com.openframe.data.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class BrewPackageManagerHandler implements PackageManagerHandler {

    private static final String CASK_FLAG = "--cask";

    @Override
    public PackageManagerType manager() {
        return PackageManagerType.BREW;
    }

    @Override
    public SoftwareScriptCode scriptCode(SoftwareAction action) {
        return action.select(SoftwareScriptCode.BREW_INSTALL, SoftwareScriptCode.BREW_UPDATE);
    }

    @Override
    public List<String> buildArgs(String packageName, BrewPackageType brewPackageType) {
        if (packageName == null || packageName.isBlank()) {
            throw new BadRequestException("packageName is required for a brew package");
        }
        if (brewPackageType == null) {
            throw new BadRequestException("brewPackageType (CASK/FORMULA) is required for a brew package");
        }
        return brewPackageType == BrewPackageType.CASK
                ? List.of(CASK_FLAG, packageName)
                : List.of(packageName);
    }
}
