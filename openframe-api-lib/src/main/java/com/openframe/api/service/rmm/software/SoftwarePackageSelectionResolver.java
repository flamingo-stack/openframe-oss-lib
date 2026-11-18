package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwarePackageSelection;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

import static org.springframework.util.StringUtils.hasText;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwarePackageSelectionResolver {

    private final SoftwareInventoryService softwareInventoryService;

    public void resolve(List<? extends SoftwarePackageSelection> selections) {
        selections.forEach(this::resolve);
    }

    private void resolve(SoftwarePackageSelection selection) {
        if (hasPackage(selection)) {
            return;
        }
        if (!hasSoftwareOnly(selection)) {
            throw new BadRequestException("A package needs packageManager and packageName together, or only softwareId"
                    + " for the server to pick the package");
        }
        String softwareId = selection.getSoftwareId();
        PackageCatalogEntry managingPackage = softwareInventoryService.getManagingPackage(softwareId);
        PackageManagerType packageManager = managingPackage.getManager();
        String packageName = managingPackage.getPackageId();
        BrewPackageType brewPackageType = managingPackage.getBrewType();
        selection.setPackageManager(packageManager);
        selection.setPackageName(packageName);
        selection.setBrewPackageType(brewPackageType);
    }

    private static boolean hasPackage(SoftwarePackageSelection selection) {
        String packageName = selection.getPackageName();
        return selection.getPackageManager() != null && hasText(packageName);
    }

    private static boolean hasSoftwareOnly(SoftwarePackageSelection selection) {
        String softwareId = selection.getSoftwareId();
        String packageName = selection.getPackageName();
        return hasText(softwareId) && selection.getPackageManager() == null && !hasText(packageName);
    }
}
