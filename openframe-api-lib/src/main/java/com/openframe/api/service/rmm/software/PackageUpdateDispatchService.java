package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageUpdateDeliverySeed;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.data.nats.packageupdate.UpdateMode;
import com.openframe.data.nats.packageupdate.UpdateSource;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateDispatchService {

    static final int DEFAULT_FORCE_COUNTDOWN_SECONDS = 300;

    private final DeliveryDispatcher deliveryDispatcher;
    private final PackageUpdateRequestRepository requestRepository;
    private final PackageUpdateDeviceStateRepository deviceStateRepository;
    private final TenantIdProvider tenantIdProvider;

    public void dispatchAdminUpdateNow(String executionId, SoftwareAction action, SoftwarePackageInput pkg,
                                       List<String> machineIds, String initiatedBy) {
        dispatch(executionId, action, pkg, machineIds, PackageUpdateSource.ADMIN, initiatedBy,
                PackageUpdateMode.WAIT, DEFAULT_FORCE_COUNTDOWN_SECONDS, null);
    }

    public void dispatch(String executionId, SoftwareAction action, SoftwarePackageInput pkg, List<String> machineIds,
                         PackageUpdateSource source, String initiatedBy, PackageUpdateMode mode,
                         Integer forceCountdownSeconds, Long deadlineSeconds) {
        String tenantId = tenantIdProvider.getTenantId();
        Instant now = Instant.now();

        requestRepository.save(PackageUpdateRequest.builder()
                .tenantId(tenantId)
                .requestId(executionId)
                .action(action)
                .source(source)
                .packageManager(pkg.getPackageManager())
                .packageName(pkg.getPackageName())
                .brewPackageType(pkg.getBrewPackageType())
                .mode(mode)
                .forceCountdownSeconds(forceCountdownSeconds)
                .deadlineSeconds(deadlineSeconds)
                .status(SoftwareActionStatus.SCHEDULED)
                .machineIds(machineIds)
                .totalMachineCount(machineIds.size())
                .attempts(1)
                .initiatedBy(initiatedBy)
                .createdAt(now)
                .updatedAt(now)
                .build());

        deviceStateRepository.saveAll(machineIds.stream()
                .map(machineId -> PackageUpdateDeviceState.builder()
                        .tenantId(tenantId)
                        .requestId(executionId)
                        .machineId(machineId)
                        .status(SoftwareActionStatus.SCHEDULED)
                        .mode(mode)
                        .createdAt(now)
                        .updatedAt(now)
                        .build())
                .toList());

        PackageReference packageRef = packageReference(pkg);
        UpdateSource wireSource = wireSource(source);
        UpdateMode wireMode = mode == PackageUpdateMode.FORCE ? UpdateMode.FORCE : UpdateMode.WAIT;
        Integer countdown = wireMode == UpdateMode.FORCE ? forceCountdownSeconds : null;

        machineIds.forEach(machineId -> deliveryDispatcher.dispatch(PackageUpdateDeliverySeed.builder()
                .machineId(machineId)
                .requestId(executionId)
                .source(wireSource)
                .packageRef(packageRef)
                .mode(wireMode)
                .countdownSeconds(countdown)
                .build()));

        log.info("Package-update dispatched requestId={} action={} source={} mode={} machines={} package={}/{}",
                executionId, action, source, mode, machineIds.size(), pkg.getPackageManager(), pkg.getPackageName());
    }

    private static PackageReference packageReference(SoftwarePackageInput pkg) {
        PackageReference.PackageReferenceBuilder ref = PackageReference.builder()
                .manager(pkg.getPackageManager());
        if (pkg.getPackageManager() == PackageManagerType.BREW) {
            return ref.kind(pkg.getBrewPackageType()).name(pkg.getPackageName()).build();
        }
        return ref.id(pkg.getPackageName()).build();
    }

    private static UpdateSource wireSource(PackageUpdateSource source) {
        return switch (source) {
            case AUTO -> UpdateSource.builder().kind(UpdateSource.Kind.AUTO).build();
            case ADMIN -> UpdateSource.builder().kind(UpdateSource.Kind.MANUAL).origin(UpdateSource.Origin.ADMIN).build();
            case USER -> UpdateSource.builder().kind(UpdateSource.Kind.MANUAL).origin(UpdateSource.Origin.USER).build();
        };
    }
}
