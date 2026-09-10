package com.openframe.api.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class WingetPackageManagerHandler implements PackageManagerHandler {

    private static final String ID_FLAG = "--id";
    private static final String EXACT_FLAG = "-e";

    @Override
    public PackageManagerType manager() {
        return PackageManagerType.WINGET;
    }

    @Override
    public SoftwareScriptCode scriptCode(SoftwareAction action) {
        return action.select(SoftwareScriptCode.WINGET_INSTALL, SoftwareScriptCode.WINGET_UPDATE);
    }

    @Override
    public List<String> buildArgs(String packageName, BrewPackageType packageType) {
        if (packageName == null || packageName.isBlank()) {
            throw new BadRequestException("packageName is required for a winget package");
        }
        return List.of(ID_FLAG, packageName, EXACT_FLAG);
    }
}
