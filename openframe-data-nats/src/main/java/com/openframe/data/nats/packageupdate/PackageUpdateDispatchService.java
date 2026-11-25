package com.openframe.data.nats.packageupdate;

import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageAdoptDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateDispatchService {

    static final int DEFAULT_FORCE_COUNTDOWN_SECONDS = 300;

    private final DeliveryRouter deliveryRouter;
    private final PackageUpdateRequestRepository requestRepository;
    private final PackageUpdateDeviceStateRepository deviceStateRepository;
    private final ScriptExecutionRepository scriptExecutionRepository;
    private final TenantIdProvider tenantIdProvider;
    private final PackageManagerProperties packageManagerProperties;

    public String dispatchAdminUpdateNow(RunningExecutionRows execution, BrewPackageType brewPackageType) {
        return dispatch(execution, brewPackageType, PackageUpdateSource.ADMIN, PackageUpdateMode.WAIT,
                DEFAULT_FORCE_COUNTDOWN_SECONDS, null);
    }

    public String dispatchAdminUpdate(RunningExecutionRows execution, BrewPackageType brewPackageType,
                                      PackageUpdateSettings settings) {
        return dispatchWith(execution, brewPackageType, PackageUpdateSource.ADMIN, settings);
    }

    public String dispatchAutoUpdate(RunningExecutionRows execution, BrewPackageType brewPackageType,
                                     PackageUpdateSettings settings) {
        return dispatchWith(execution, brewPackageType, PackageUpdateSource.AUTO, settings);
    }

    // Bundles, schedules and policies saved before Update Settings existed carry none and keep the old behaviour.
    private String dispatchWith(RunningExecutionRows execution, BrewPackageType brewPackageType, PackageUpdateSource source, PackageUpdateSettings settings) {
        if (settings == null) {
            return dispatch(execution, brewPackageType, source, PackageUpdateMode.WAIT, DEFAULT_FORCE_COUNTDOWN_SECONDS, null);
        }
        return dispatch(execution, brewPackageType, source, settings.getMode(),
                settings.getCountdownSeconds(), settings.getDeadlineSeconds());
    }

    // Every dispatch is its own request, so a shared execution id never collides on the request index; returns its id.
    // A device no route reaches is refused before anything is written: callers split their devices with
    // PackageUpdateEligibilityService first, a state written for such a device would stay SCHEDULED for good.
    public String dispatch(RunningExecutionRows execution, BrewPackageType brewPackageType, PackageUpdateSource source,
                           PackageUpdateMode mode, Integer forceCountdownSeconds, Long deadlineSeconds) {
        // the device state is unique per request and machine, so a repeated id would fail the whole dispatch
        List<String> targets = execution.getMachineIds().stream().distinct().toList();
        requireReachable(targets);

        PackageUpdateRequest request = newRequest(execution, targets, SoftwareAction.UPDATE, SoftwareActionStatus.SCHEDULED)
                .brewPackageType(brewPackageType)
                .source(source)
                .mode(mode)
                .forceCountdownSeconds(forceCountdownSeconds)
                .deadlineSeconds(deadlineSeconds)
                .build();
        record(execution, request);

        targets.stream()
                .map(machineId -> PackageUpdateWire.seed(machineId, request))
                .forEach(deliveryRouter::dispatch);

        String requestId = request.getRequestId();
        log.info("Package-update dispatched requestId={} executionId={} source={} mode={} machines={} package={}/{}",
                requestId, execution.getExecutionId(), source, mode, targets.size(), execution.getPackageManager(),
                execution.getPackageName());
        return requestId;
    }

    // the caller checks that the PACKAGE_ADOPT order reaches every device; the agent reports no progress, only the
    // outcome, so the request starts IN_PROGRESS
    public String dispatchAdopt(RunningExecutionRows execution, BrewPackageType brewPackageType, String softwareId,
                                String bundleId) {
        List<String> targets = execution.getMachineIds().stream().distinct().toList();
        PackageUpdateRequest request = newRequest(execution, targets, SoftwareAction.ADOPT, SoftwareActionStatus.IN_PROGRESS)
                .brewPackageType(brewPackageType)
                .source(PackageUpdateSource.ADMIN)
                .softwareId(softwareId)
                .build();
        record(execution, request);

        String requestId = request.getRequestId();
        PackageReference packageRef = PackageUpdateWire.reference(execution.getPackageManager(),
                execution.getPackageName(), brewPackageType, request.getFeed());
        targets.stream()
                .map(machineId -> PackageAdoptDeliverySeed.builder()
                        .machineId(machineId)
                        .requestId(requestId)
                        .packageRef(packageRef)
                        .bundleId(bundleId)
                        .build())
                .forEach(deliveryRouter::dispatch);

        log.info("Package-adopt dispatched requestId={} executionId={} machines={} package={}/{}",
                requestId, execution.getExecutionId(), targets.size(), execution.getPackageManager(),
                execution.getPackageName());
        return requestId;
    }

    private PackageUpdateRequest.PackageUpdateRequestBuilder newRequest(RunningExecutionRows execution, List<String> targets,
                                                                        SoftwareAction action, SoftwareActionStatus status) {
        String tenantId = tenantIdProvider.getTenantId();
        String requestId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        return PackageUpdateRequest.builder()
                .tenantId(tenantId)
                .requestId(requestId)
                .executionId(execution.getExecutionId())
                .action(action)
                .packageManager(execution.getPackageManager())
                .packageName(execution.getPackageName())
                .feed(feedOf(execution.getPackageManager()))
                .status(status)
                .machineIds(targets)
                .totalMachineCount(targets.size())
                .attempts(1)
                .initiatedBy(execution.getInitiatedBy())
                .createdAt(now)
                .updatedAt(now);
    }

    private String feedOf(PackageManagerType manager) {
        return manager == PackageManagerType.CHOCO ? packageManagerProperties.getChoco().getFeedUrl() : null;
    }

    private void record(RunningExecutionRows execution, PackageUpdateRequest request) {
        String tenantId = request.getTenantId();
        String requestId = request.getRequestId();
        List<String> targets = request.getMachineIds();
        scriptExecutionRepository.saveQueued(execution.toBuilder()
                .tenantId(tenantId)
                .machineIds(targets)
                .packageUpdateRequestId(requestId)
                .build());
        requestRepository.save(request);

        Instant createdAt = request.getCreatedAt();
        deviceStateRepository.saveAll(targets.stream()
                .map(machineId -> PackageUpdateDeviceState.builder()
                        .tenantId(tenantId)
                        .requestId(requestId)
                        .machineId(machineId)
                        .status(request.getStatus())
                        .mode(request.getMode())
                        .createdAt(createdAt)
                        .updatedAt(createdAt)
                        .build())
                .toList());
    }

    private void requireReachable(List<String> targets) {
        Set<String> reachable = deliveryRouter.reachable(DeliveryType.PACKAGE_UPDATE, targets);
        List<String> unreachable = targets.stream().filter(machineId -> !reachable.contains(machineId)).toList();
        if (!unreachable.isEmpty()) {
            throw new IllegalArgumentException("No delivery route reaches machines " + unreachable + " for "
                    + DeliveryType.PACKAGE_UPDATE + ": split the devices with PackageUpdateEligibilityService first");
        }
    }
}
