package com.openframe.data.service.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdate;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageAutoUpdatePolicyService {

    private final PackageAutoUpdatePolicyRepository repository;
    private final PackageCatalogVersions catalogVersions;

    // A run with Auto-update off leaves an earlier policy as it is: only Turn Off Auto-Update turns one off.
    // The run itself brings the package to the catalog's latest, so the trigger starts from the next release.
    public void turnOn(RunningExecutionRows execution, BrewPackageType brewPackageType, String softwareId,
                       SoftwareAutoUpdate autoUpdate, PackageUpdateSettings updateSettings) {
        if (autoUpdate == null || !autoUpdate.isEnabled()) {
            return;
        }
        PackageAutoUpdatePolicy.PackageAutoUpdatePolicyBuilder policy = PackageAutoUpdatePolicy.builder()
                .tenantId(execution.getTenantId())
                .packageManager(execution.getPackageManager())
                .packageName(execution.getPackageName())
                .brewPackageType(brewPackageType)
                .softwareId(softwareId)
                .settings(autoUpdate.settingsOr(updateSettings))
                .updatedBy(execution.getInitiatedBy());
        if (catalogVersions.hasLatest(execution.getPackageManager(), execution.getPackageName(), brewPackageType)) {
            policy.lastVersion(catalogVersions.latest(execution.getPackageManager(), execution.getPackageName(),
                    brewPackageType));
        }
        repository.enable(policy.build(), execution.getMachineIds());
        log.info("Auto-update turned on package={}/{} machines={} softwareId={}",
                execution.getPackageManager(), execution.getPackageName(), execution.getMachineIds().size(), softwareId);
    }
}
