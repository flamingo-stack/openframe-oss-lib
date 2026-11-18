package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareAutoUpdatePolicyResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdate;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.nats.packageupdate.PackageAutoUpdateWithdrawal;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.software.PackageAutoUpdatePolicyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

import static java.util.Comparator.comparing;
import static java.util.stream.Collectors.collectingAndThen;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.partitioningBy;
import static java.util.stream.Collectors.toList;
import static java.util.stream.Collectors.toSet;

// AUTO-UPDATE of a Software, from the policies linked to it: ON while any of them keeps the package updated,
// OFF once all are turned off, null when it has none.
@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareAutoUpdateService {

    private final PackageAutoUpdatePolicyRepository policyRepository;
    private final TenantIdProvider tenantIdProvider;
    private final PackageAutoUpdateWithdrawal withdrawal;
    private final PackageAutoUpdatePolicyService packageAutoUpdatePolicyService;

    public SoftwareAutoUpdatePolicyResponse getPolicy(String softwareId) {
        String tenantId = tenantIdProvider.getTenantId();
        List<String> softwareIds = List.of(softwareId);
        List<PackageAutoUpdatePolicy> enabled = policyRepository.findByTenantIdAndSoftwareIdIn(tenantId, softwareIds)
                .stream()
                .filter(PackageAutoUpdatePolicy::isEnabled)
                .toList();
        boolean anyEnabled = !enabled.isEmpty();
        PackageUpdateSettings settings = enabled.stream()
                .max(comparing(PackageAutoUpdatePolicy::getUpdatedAt))
                .map(PackageAutoUpdatePolicy::getSettings)
                .orElse(null);
        List<String> machineIds = ids(enabled, PackageAutoUpdatePolicy::getMachineId);
        return SoftwareAutoUpdatePolicyResponse.builder()
                .enabled(anyEnabled)
                .settings(settings)
                .machineIds(machineIds)
                .build();
    }

    public void turnOn(String softwareId, PackageCatalogEntry managingPackage, List<String> machineIds,
                       PackageUpdateSettings settings, String actor) {
        String tenantId = tenantIdProvider.getTenantId();
        PackageManagerType packageManager = managingPackage.getManager();
        String packageName = managingPackage.getPackageId();
        BrewPackageType brewPackageType = managingPackage.getBrewType();
        List<String> softwareIds = List.of(softwareId);
        Set<String> alreadyOn = policyRepository.findByTenantIdAndSoftwareIdIn(tenantId, softwareIds).stream()
                .filter(policy -> isOnFor(policy, managingPackage))
                .map(PackageAutoUpdatePolicy::getMachineId)
                .collect(toSet());
        Map<Boolean, List<String>> byAlreadyOn = machineIds.stream().collect(partitioningBy(alreadyOn::contains));
        List<String> kept = byAlreadyOn.get(true);
        List<String> added = byAlreadyOn.get(false);
        PackageAutoUpdatePolicy template = PackageAutoUpdatePolicy.builder()
                .tenantId(tenantId)
                .softwareId(softwareId)
                .packageManager(packageManager)
                .packageName(packageName)
                .brewPackageType(brewPackageType)
                .settings(settings)
                .updatedBy(actor)
                .build();
        // a kept device keeps its lastVersion: it may not have been ordered the current version yet
        policyRepository.updateSettings(template, kept);
        addPolicies(template, added);
        long turnedOff = policyRepository.disableOthersOfSoftware(template, machineIds);
        // read after the update, as in turnOff
        policyRepository.findByTenantIdAndSoftwareIdIn(tenantId, softwareIds).stream()
                .filter(policy -> !policy.isEnabled())
                .forEach(this::withdrawTurnedOff);
        log.info("Auto-update turned on softwareId={} package={}/{} kept={} added={} turnedOff={} actor={}",
                softwareId, packageManager, packageName, kept.size(), added.size(), turnedOff, actor);
    }

    public void turnOff(String softwareId, String actor) {
        String tenantId = tenantIdProvider.getTenantId();
        long turnedOff = policyRepository.disableBySoftwareId(tenantId, softwareId, actor);
        // read after the update: from here on a failed device schedules no retry, so none can slip past this
        policyRepository.findByTenantIdAndSoftwareIdIn(tenantId, List.of(softwareId))
                .forEach(this::withdrawTurnedOff);
        log.info("Auto-update turned off softwareId={} policies={} actor={}", softwareId, turnedOff, actor);
    }

    public boolean hasPolicy(String softwareId) {
        return policyRepository.existsByTenantIdAndSoftwareId(tenantIdProvider.getTenantId(), softwareId);
    }

    // A title Fleet does not list yet, named after the package its policies update.
    public SoftwareResponse titleFromPolicies(String softwareId) {
        String tenantId = tenantIdProvider.getTenantId();
        List<String> softwareIds = List.of(softwareId);
        String name = policyRepository.findByTenantIdAndSoftwareIdIn(tenantId, softwareIds).stream()
                .map(PackageAutoUpdatePolicy::getPackageName)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(softwareId);
        return SoftwareResponse.builder().id(softwareId).name(name).build();
    }

    public void applyToSoftware(List<SoftwareResponse> rows) {
        List<String> softwareIds = ids(rows, SoftwareResponse::getId);
        if (softwareIds.isEmpty()) {
            return;
        }
        Map<String, SoftwareAutoUpdateStatus> statuses = statusBy(
                policyRepository.findByTenantIdAndSoftwareIdIn(tenantIdProvider.getTenantId(), softwareIds),
                PackageAutoUpdatePolicy::getSoftwareId);
        rows.forEach(row -> row.setAutoUpdate(statuses.get(row.getId())));
    }

    public void applyToSoftwareOnDevice(String machineId, List<SoftwareResponse> rows) {
        List<String> softwareIds = ids(rows, SoftwareResponse::getId);
        if (softwareIds.isEmpty()) {
            return;
        }
        Map<String, SoftwareAutoUpdateStatus> statuses = statusBy(
                policyRepository.findByTenantIdAndMachineIdAndSoftwareIdIn(tenantIdProvider.getTenantId(), machineId,
                        softwareIds),
                PackageAutoUpdatePolicy::getSoftwareId);
        rows.forEach(row -> row.setAutoUpdate(statuses.get(row.getId())));
    }

    public void applyToDevices(String softwareId, List<SoftwareOnDeviceResponse> rows) {
        List<String> machineIds = ids(rows, SoftwareAutoUpdateService::machineId);
        if (machineIds.isEmpty()) {
            return;
        }
        Map<String, SoftwareAutoUpdateStatus> statuses = statusBy(
                policyRepository.findByTenantIdAndSoftwareIdAndMachineIdIn(tenantIdProvider.getTenantId(), softwareId,
                        machineIds),
                PackageAutoUpdatePolicy::getMachineId);
        rows.forEach(row -> row.setAutoUpdate(statuses.get(machineId(row))));
    }

    private static boolean isOnFor(PackageAutoUpdatePolicy policy, PackageCatalogEntry managingPackage) {
        String packageId = managingPackage.getPackageId();
        return policy.isEnabled() && policy.getPackageManager() == managingPackage.getManager()
                && packageId.equals(policy.getPackageName());
    }

    private void addPolicies(PackageAutoUpdatePolicy template, List<String> machineIds) {
        if (machineIds.isEmpty()) {
            return;
        }
        String tenantId = template.getTenantId();
        String actor = template.getUpdatedBy();
        PackageManagerType packageManager = template.getPackageManager();
        String packageName = template.getPackageName();
        BrewPackageType brewPackageType = template.getBrewPackageType();
        String softwareId = template.getSoftwareId();
        PackageUpdateSettings settings = template.getSettings();
        RunningExecutionRows execution = RunningExecutionRows.builder()
                .tenantId(tenantId)
                .machineIds(machineIds)
                .initiatedBy(actor)
                .packageManager(packageManager)
                .packageName(packageName)
                .build();
        SoftwareAutoUpdate autoUpdate = SoftwareAutoUpdate.builder().enabled(true).build();
        packageAutoUpdatePolicyService.turnOn(execution, brewPackageType, softwareId, autoUpdate, settings);
    }

    private void withdrawTurnedOff(PackageAutoUpdatePolicy policy) {
        withdrawal.withdraw(policy, "auto-update turned off");
    }

    private static String machineId(SoftwareOnDeviceResponse row) {
        return row.getDevice() == null ? null : row.getDevice().getMachineId();
    }

    private static <T> List<String> ids(List<T> rows, Function<T, String> id) {
        return rows.stream().map(id).filter(Objects::nonNull).distinct().toList();
    }

    private static Map<String, SoftwareAutoUpdateStatus> statusBy(List<PackageAutoUpdatePolicy> policies,
                                                                  Function<PackageAutoUpdatePolicy, String> key) {
        return policies.stream().collect(groupingBy(key, collectingAndThen(toList(), SoftwareAutoUpdateService::statusOf)));
    }

    private static SoftwareAutoUpdateStatus statusOf(List<PackageAutoUpdatePolicy> policies) {
        return policies.stream().anyMatch(PackageAutoUpdatePolicy::isEnabled)
                ? SoftwareAutoUpdateStatus.ON
                : SoftwareAutoUpdateStatus.OFF;
    }
}
