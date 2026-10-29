package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateDispatchService {

    static final int DEFAULT_FORCE_COUNTDOWN_SECONDS = 300;

    private final DeliveryDispatcher deliveryDispatcher;
    private final PackageUpdateRequestRepository requestRepository;
    private final PackageUpdateDeviceStateRepository deviceStateRepository;
    private final ScriptExecutionRepository scriptExecutionRepository;
    private final TenantIdProvider tenantIdProvider;

    public void dispatchAdminUpdateNow(RunningExecutionRows execution, BrewPackageType brewPackageType) {
        dispatch(execution, brewPackageType, PackageUpdateSource.ADMIN, PackageUpdateMode.WAIT,
                DEFAULT_FORCE_COUNTDOWN_SECONDS, null);
    }

    // Bundles and schedules saved before Update Settings existed carry none and keep the old behaviour.
    public void dispatchAdminUpdate(RunningExecutionRows execution, BrewPackageType brewPackageType,
                                    PackageUpdateSettings settings) {
        if (settings == null) {
            dispatchAdminUpdateNow(execution, brewPackageType);
            return;
        }
        dispatch(execution, brewPackageType, PackageUpdateSource.ADMIN, settings.getMode(),
                settings.getCountdownSeconds(), settings.getDeadlineSeconds());
    }

    // Every dispatch is its own request, so a shared execution id never collides on the request index.
    public void dispatch(RunningExecutionRows execution, BrewPackageType brewPackageType, PackageUpdateSource source,
                         PackageUpdateMode mode, Integer forceCountdownSeconds, Long deadlineSeconds) {
        String tenantId = tenantIdProvider.getTenantId();
        String requestId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        // the device state is unique per request and machine, so a repeated id would fail the whole dispatch
        List<String> targets = execution.getMachineIds().stream().distinct().toList();

        scriptExecutionRepository.saveQueued(execution.toBuilder()
                .tenantId(tenantId)
                .machineIds(targets)
                .packageUpdateRequestId(requestId)
                .build());

        requestRepository.save(PackageUpdateRequest.builder()
                .tenantId(tenantId)
                .requestId(requestId)
                .executionId(execution.getExecutionId())
                .action(SoftwareAction.UPDATE)
                .source(source)
                .packageManager(execution.getPackageManager())
                .packageName(execution.getPackageName())
                .brewPackageType(brewPackageType)
                .mode(mode)
                .forceCountdownSeconds(forceCountdownSeconds)
                .deadlineSeconds(deadlineSeconds)
                .status(SoftwareActionStatus.SCHEDULED)
                .machineIds(targets)
                .totalMachineCount(targets.size())
                .attempts(1)
                .initiatedBy(execution.getInitiatedBy())
                .createdAt(now)
                .updatedAt(now)
                .build());

        deviceStateRepository.saveAll(targets.stream()
                .map(machineId -> PackageUpdateDeviceState.builder()
                        .tenantId(tenantId)
                        .requestId(requestId)
                        .machineId(machineId)
                        .status(SoftwareActionStatus.SCHEDULED)
                        .mode(mode)
                        .createdAt(now)
                        .updatedAt(now)
                        .build())
                .toList());

        targets.forEach(machineId -> deliveryDispatcher.dispatch(PackageUpdateWire.seed(
                machineId, requestId, source, execution.getPackageManager(), execution.getPackageName(),
                brewPackageType, mode, forceCountdownSeconds)));

        log.info("Package-update dispatched requestId={} executionId={} source={} mode={} machines={} package={}/{}",
                requestId, execution.getExecutionId(), source, mode, targets.size(), execution.getPackageManager(),
                execution.getPackageName());
    }
}
