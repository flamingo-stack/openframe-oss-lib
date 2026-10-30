package com.openframe.client.service.rmm;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptType;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionKind;
import com.openframe.data.document.rmm.software.SoftwareActionResult;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareBundleMode;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.rmm.SoftwareActionResultRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.software.PackageCatalogVersions;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.service.rmm.software.PackageUpdateEligibilityService;
import com.openframe.delivery.track.DeliveryTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toList;

// Brings every device with an enabled auto-update policy to the catalog's latest version of its package.
// One job per package and version: devices that reach a version later join the same Software Actions row.
@Slf4j
@Component
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageAutoUpdateTrigger {

    private final PackageAutoUpdatePolicyRepository policyRepository;
    private final PackageCatalogVersions catalogVersions;
    private final PackageUpdateEligibilityService packageUpdateEligibility;
    private final PackageManagerRegistry packageManagerRegistry;
    private final ScriptRepository scriptRepository;
    private final SoftwareActionResultRepository actionResultRepository;
    private final PackageUpdateDispatchService packageUpdateDispatchService;
    private final DeliveryTracker deliveryTracker;
    private final TenantIdProvider tenantIdProvider;

    public void run() {
        String tenantId = tenantIdProvider.getTenantId();
        Map<PackageKey, List<PackageAutoUpdatePolicy>> byPackage = policyRepository.findByTenantIdAndEnabledTrue(tenantId)
                .stream()
                .collect(groupingBy(PackageKey::of, LinkedHashMap::new, toList()));
        byPackage.forEach((pkg, policies) -> {
            try {
                if (catalogVersions.hasLatest(pkg.manager(), pkg.name(), pkg.brewType())) {
                    orderOutdated(tenantId, pkg, catalogVersions.latest(pkg.manager(), pkg.name(), pkg.brewType()),
                            policies);
                }
            } catch (Exception e) {
                log.error("Auto-update of {}/{} failed", pkg.manager(), pkg.name(), e);
            }
        });
    }

    private void orderOutdated(String tenantId, PackageKey pkg, String version, List<PackageAutoUpdatePolicy> policies) {
        List<PackageAutoUpdatePolicy> outdated = policies.stream()
                .filter(policy -> !version.equals(policy.getLastVersion()))
                .toList();
        if (outdated.isEmpty()) {
            return;
        }
        // a device whose agent cannot take the order yet stays outdated and is ordered once it can
        Set<String> eligible = packageUpdateEligibility.eligibleConnectedMachines(SoftwareAction.UPDATE,
                machineIds(outdated));
        List<PackageAutoUpdatePolicy> due = outdated.stream()
                .filter(policy -> eligible.contains(policy.getMachineId()))
                .toList();
        if (due.isEmpty()) {
            return;
        }
        Script script = updateScript(tenantId, pkg.manager());
        due.forEach(this::withdrawRetry);

        String executionId = SoftwareExecutionId.forAutoUpdate(tenantId, pkg.manager(), pkg.name(), version);
        recordJob(tenantId, executionId, pkg, version, machineIds(due));
        RunningExecutionRows rows = RunningExecutionRows.builder()
                .tenantId(tenantId)
                .executionId(executionId)
                .scriptId(script.getId())
                .privilegeLevel(script.getPrivilegeLevel())
                .timeoutSeconds(script.getDefaultTimeoutSeconds())
                .source(ExecutionSource.PACKAGE_AUTO_UPDATE)
                .packageManager(pkg.manager())
                .packageName(pkg.name())
                .softwareAction(SoftwareAction.UPDATE)
                .build();
        bySettings(due).forEach((settings, group) -> {
            packageUpdateDispatchService.dispatchAutoUpdate(rows.toBuilder().machineIds(machineIds(group)).build(),
                    pkg.brewType(), settings);
            policyRepository.markOrdered(group.stream().map(PackageAutoUpdatePolicy::getId).toList(), version);
        });
        log.info("Auto-update ordered package={}/{} version={} machines={} executionId={}",
                pkg.manager(), pkg.name(), version, due.size(), executionId);
    }

    // a retry still waiting would replace this order on the agent
    private void withdrawRetry(PackageAutoUpdatePolicy policy) {
        String retryRequestId = policy.getRetryRequestId();
        if (retryRequestId != null) {
            deliveryTracker.cancel(DeliveryType.PACKAGE_UPDATE, retryRequestId, policy.getMachineId(), "a newer version is ordered");
        }
    }

    // every tenant is seeded with the update scripts, so a missing one is a broken tenant, not a skip
    private Script updateScript(String tenantId, PackageManagerType manager) {
        String name = packageManagerRegistry.handlerFor(manager).scriptCode(SoftwareAction.UPDATE).canonicalName();
        return scriptRepository.findByTenantIdAndNameAndType(tenantId, name, ScriptType.SOFTWARE)
                .orElseThrow(() -> new IllegalStateException("Update script " + name + " is not seeded for tenant " + tenantId));
    }

    private void recordJob(String tenantId, String executionId, PackageKey pkg, String version, List<String> machineIds) {
        Instant now = Instant.now();
        SoftwareActionResult job = actionResultRepository.findByTenantIdAndExecutionId(tenantId, executionId)
                .orElseGet(() -> SoftwareActionResult.builder()
                        .id(executionId)
                        .tenantId(tenantId)
                        .executionId(executionId)
                        .action(SoftwareAction.UPDATE)
                        .kind(SoftwareActionKind.AUTO_UPDATE)
                        .packageManager(pkg.manager())
                        .packageName(pkg.name())
                        .version(version)
                        .status(SoftwareActionStatus.IN_PROGRESS)
                        .mode(SoftwareBundleMode.NOW)
                        .machineIds(List.of())
                        .dispatchedAt(now)
                        .createdAt(now)
                        .build());
        Set<String> targets = new LinkedHashSet<>(job.getMachineIds() == null ? List.of() : job.getMachineIds());
        targets.addAll(machineIds);
        job.setMachineIds(new ArrayList<>(targets));
        job.setTotalMachineCount(targets.size());
        actionResultRepository.save(job);
    }

    // groupingBy refuses a null key, and a policy without settings is a group of its own
    private static Map<PackageUpdateSettings, List<PackageAutoUpdatePolicy>> bySettings(List<PackageAutoUpdatePolicy> policies) {
        Map<PackageUpdateSettings, List<PackageAutoUpdatePolicy>> groups = new LinkedHashMap<>();
        policies.forEach(policy -> groups.computeIfAbsent(policy.getSettings(), settings -> new ArrayList<>()).add(policy));
        return groups;
    }

    private static List<String> machineIds(List<PackageAutoUpdatePolicy> policies) {
        return policies.stream().map(PackageAutoUpdatePolicy::getMachineId).toList();
    }

    private record PackageKey(PackageManagerType manager, String name, BrewPackageType brewType) {

        static PackageKey of(PackageAutoUpdatePolicy policy) {
            return new PackageKey(policy.getPackageManager(), policy.getPackageName(), policy.getBrewPackageType());
        }
    }
}
