package com.openframe.api.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Homebrew (macOS) handler. Casks (GUI apps) need the {@code --cask} flag; formulae (CLI tools)
 * do not — the effective command becomes {@code brew install --cask slack} or
 * {@code brew install wireshark}.
 */
@Component
public class BrewPackageManagerHandler implements PackageManagerHandler {

    private static final String CASK_FLAG = "--cask";

    @Override
    public PackageManagerType manager() {
        return PackageManagerType.BREW;
    }

    @Override
    public SoftwareScriptCode scriptCode(SoftwareAction action) {
        return switch (action) {
            case INSTALL -> SoftwareScriptCode.BREW_INSTALL;
            case UPDATE -> SoftwareScriptCode.BREW_UPGRADE;
        };
    }

    @Override
    public List<String> buildArgs(String packageId, BrewPackageType packageType) {
        if (packageId == null || packageId.isBlank()) {
            throw new BadRequestException("packageId is required for a brew package");
        }
        return packageType == BrewPackageType.CASK
                ? List.of(CASK_FLAG, packageId)
                : List.of(packageId);
    }
}
