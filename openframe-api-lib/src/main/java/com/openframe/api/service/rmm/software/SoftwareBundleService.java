package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.CreateSoftwareBundleInput;
import com.openframe.api.dto.rmm.software.CreateSoftwareScheduleInput;
import com.openframe.api.dto.rmm.software.SoftwareBundleResponse;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.dto.rmm.software.SoftwareSchedulePackageInput;
import com.openframe.api.dto.rmm.software.SoftwareScheduleResponse;
import com.openframe.api.dto.rmm.software.UpdateSoftwareBundleInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.software.SoftwareBundle;
import com.openframe.data.document.rmm.software.SoftwareBundleMode;
import com.openframe.data.document.rmm.software.SoftwareBundleOnlineDispatch;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareBundleStatus;
import com.openframe.data.repository.rmm.SoftwareBundleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareBundleRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareBundleService {

    private final SoftwareBundleRepository bundleRepository;
    private final SoftwareBundleOnlineDispatchRepository onlineDispatchRepository;
    private final SoftwareScheduleService softwareScheduleService;
    private final TenantIdProvider tenantIdProvider;

    @Value("${openframe.rmm.software.bundle.pending-ttl}")
    private Duration pendingTtl;

    @Value("${openframe.rmm.software.bundle.schedule.reconnect-window-seconds}")
    private long scheduleReconnectWindowSeconds;

    public SoftwareBundleResponse create(CreateSoftwareBundleInput input, String createdBy) {
        String tenantId = tenantIdProvider.getTenantId();
        Instant now = Instant.now();
        SoftwareBundle entity = SoftwareBundle.builder()
                .tenantId(tenantId)
                .action(input.getAction())
                .mode(input.getMode())
                .status(SoftwareBundleStatus.PENDING)
                .machineIds(List.copyOf(input.getMachineIds()))
                .packages(toDomainPackages(input.getPackages()))
                .startAt(input.getStartAt())
                .createdBy(createdBy)
                .createdAt(now)
                .updatedAt(now)
                .expireAt(now.plus(pendingTtl))
                .build();
        SoftwareBundle saved = bundleRepository.save(entity);
        log.info("Created software bundle id={} action={} devices={} packages={} tenantId={}",
                saved.getId(), saved.getAction(), saved.getMachineIds().size(),
                saved.getPackages().size(), tenantId);
        return toResponse(saved);
    }

    public SoftwareBundleResponse update(UpdateSoftwareBundleInput input, String actor) {
        SoftwareBundle entity = loadPendingOrThrow(input.getId());
        entity.setMode(input.getMode());
        entity.setMachineIds(List.copyOf(input.getMachineIds()));
        entity.setPackages(toDomainPackages(input.getPackages()));
        entity.setStartAt(input.getStartAt());
        Instant now = Instant.now();
        entity.setUpdatedAt(now);
        entity.setExpireAt(now.plus(pendingTtl));
        SoftwareBundle saved = bundleRepository.save(entity);
        log.debug("Updated software bundle id={} devices={} packages={} actor={}",
                saved.getId(), saved.getMachineIds().size(), saved.getPackages().size(), actor);
        return toResponse(saved);
    }

    public boolean delete(String id, String actor) {
        SoftwareBundle entity = loadPendingOrThrow(id);
        bundleRepository.delete(entity);
        log.info("Deleted PENDING software bundle id={} actor={}", id, actor);
        return true;
    }

    public Optional<SoftwareBundleResponse> findById(String id) {
        return bundleRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), id).map(SoftwareBundleService::toResponse);
    }

    public List<SoftwareBundleResponse> list(SoftwareBundleStatus status) {
        String tenantId = tenantIdProvider.getTenantId();
        List<SoftwareBundle> bundles = status == null
                ? bundleRepository.findByTenantIdOrderByIdDesc(tenantId)
                : bundleRepository.findByTenantIdAndStatusOrderByIdDesc(tenantId, status);
        return bundles.stream().map(SoftwareBundleService::toResponse).toList();
    }

    public SoftwareBundleResponse run(String id, String actor) {
        SoftwareBundle entity = loadPendingOrThrow(id);
        if (entity.getPackages() == null || entity.getPackages().isEmpty()) {
            throw new BadRequestException("Cannot run software bundle " + id + ": no packages selected");
        }
        if (entity.getMachineIds() == null || entity.getMachineIds().isEmpty()) {
            throw new BadRequestException("Cannot run software bundle " + id + ": no devices selected");
        }

        Instant now = Instant.now();
        if (entity.getMode() == SoftwareBundleMode.SCHEDULED) {
            runScheduled(entity, actor);
        } else {
            armOnlineDispatch(entity, now);
        }

        entity.setStatus(SoftwareBundleStatus.COMPLETED);
        entity.setCompletedAt(now);
        entity.setUpdatedAt(now);
        entity.setExpireAt(null); // completed bundles are history — never reaped
        bundleRepository.save(entity);

        log.info("Ran software bundle id={} mode={} action={} devices={} actor={}",
                id, entity.getMode(), entity.getAction(), entity.getMachineIds().size(), actor);
        return toResponse(entity);
    }

    private void runScheduled(SoftwareBundle bundle, String actor) {
        if (bundle.getStartAt() == null) {
            throw new BadRequestException("Cannot run SCHEDULED software bundle " + bundle.getId()
                    + ": startAt is required");
        }
        CreateSoftwareScheduleInput input = new CreateSoftwareScheduleInput();
        input.setName(scheduleName(bundle));
        input.setAction(bundle.getAction());
        input.setPackages(toSchedulePackages(bundle.getPackages()));
        input.setTimeReference(ScheduleTimeReference.SERVER);
        input.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        input.setReconnectWindowSeconds(scheduleReconnectWindowSeconds);
        input.setStartAt(bundle.getStartAt());
        input.setMachineIds(bundle.getMachineIds());

        SoftwareScheduleResponse schedule = softwareScheduleService.create(input, actor);
        bundle.setScheduleId(schedule.getId());
        log.info("SCHEDULED software bundle id={} → created schedule id={} startAt={} reconnectWindowSeconds={}",
                bundle.getId(), schedule.getId(), bundle.getStartAt(), scheduleReconnectWindowSeconds);
    }

    private static String scheduleName(SoftwareBundle bundle) {
        String first = bundle.getPackages().get(0).getPackageName();
        int extra = bundle.getPackages().size() - 1;
        String label = extra > 0 ? first + " +" + extra + " more" : first;
        return bundle.getAction() + " " + label + " [" + bundle.getId() + "]";
    }

    private static List<SoftwareSchedulePackageInput> toSchedulePackages(List<SoftwareBundlePackage> packages) {
        return packages.stream()
                .map(p -> {
                    SoftwareSchedulePackageInput i = new SoftwareSchedulePackageInput();
                    i.setPackageManager(p.getPackageManager());
                    i.setPackageName(p.getPackageName());
                    i.setBrewPackageType(p.getBrewPackageType());
                    return i;
                })
                .toList();
    }

    private void armOnlineDispatch(SoftwareBundle bundle, Instant now) {
        for (String machineId : new LinkedHashSet<>(bundle.getMachineIds())) {
            boolean alreadyArmed = onlineDispatchRepository
                    .findByTenantIdAndMachineIdAndBundleId(bundle.getTenantId(), machineId, bundle.getId())
                    .isPresent();
            if (alreadyArmed) {
                continue;
            }
            try {
                onlineDispatchRepository.save(SoftwareBundleOnlineDispatch.builder()
                        .tenantId(bundle.getTenantId())
                        .machineId(machineId)
                        .bundleId(bundle.getId())
                        .firstSeenAt(now)
                        .status(DeviceOnlineDispatchStatus.NEW)
                        .build());
            } catch (DuplicateKeyException raced) {
                log.debug("Bundle online sentinel already armed bundleId={} machineId={}", bundle.getId(), machineId);
            }
        }
    }

    private SoftwareBundle loadOrThrow(String id) {
        return bundleRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), id)
                .orElseThrow(() -> new NotFoundException("Software bundle not found: " + id));
    }

    private SoftwareBundle loadPendingOrThrow(String id) {
        SoftwareBundle entity = loadOrThrow(id);
        if (entity.getStatus() != SoftwareBundleStatus.PENDING) {
            throw new BadRequestException("Software bundle " + id + " is " + entity.getStatus()
                    + " and can no longer be modified or run");
        }
        return entity;
    }

    private static List<SoftwareBundlePackage> toDomainPackages(List<SoftwarePackageInput> packages) {
        if (packages == null) {
            return List.of();
        }
        return packages.stream()
                .map(p -> SoftwareBundlePackage.builder()
                        .packageManager(p.getPackageManager())
                        .packageName(p.getPackageName())
                        .brewPackageType(p.getBrewPackageType())
                        .build())
                .toList();
    }

    private static SoftwareBundleResponse toResponse(SoftwareBundle b) {
        return SoftwareBundleResponse.builder()
                .id(b.getId())
                .action(b.getAction())
                .mode(b.getMode())
                .status(b.getStatus())
                .machineIds(b.getMachineIds())
                .packages(b.getPackages())
                .startAt(b.getStartAt())
                .scheduleId(b.getScheduleId())
                .createdBy(b.getCreatedBy())
                .createdAt(b.getCreatedAt())
                .updatedAt(b.getUpdatedAt())
                .completedAt(b.getCompletedAt())
                .executionIds(b.getExecutionIds())
                .build();
    }
}
