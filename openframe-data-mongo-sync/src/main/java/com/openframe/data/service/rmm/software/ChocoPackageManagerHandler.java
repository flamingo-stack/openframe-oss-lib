package com.openframe.data.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class ChocoPackageManagerHandler implements PackageManagerHandler {

    private static final Pattern PACKAGE_ID = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]*$");
    private static final List<String> FILE_SUFFIXES = List.of(".nupkg", ".nuspec", ".config");

    private final PackageManagerProperties packageManagerProperties;

    @Override
    public PackageManagerType manager() {
        return PackageManagerType.CHOCO;
    }

    @Override
    public SoftwareScriptCode scriptCode(SoftwareAction action) {
        return switch (action) {
            case INSTALL -> SoftwareScriptCode.CHOCO_INSTALL;
            case UPDATE -> SoftwareScriptCode.CHOCO_UPDATE;
            case ADOPT -> throw new BadRequestException("No software script adopts a package: an adoption is an order");
        };
    }

    @Override
    public List<String> buildArgs(String packageName, BrewPackageType brewPackageType) {
        if (!isPackageId(packageName)) {
            throw new BadRequestException("packageName is not a valid Chocolatey package id");
        }
        return List.of(packageName, packageManagerProperties.getChoco().getFeedUrl());
    }

    private static boolean isPackageId(String packageName) {
        if (packageName == null || !PACKAGE_ID.matcher(packageName).matches()) {
            return false;
        }
        String lowerCaseName = packageName.toLowerCase(Locale.ROOT);
        return FILE_SUFFIXES.stream().noneMatch(lowerCaseName::endsWith);
    }
}
