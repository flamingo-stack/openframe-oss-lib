package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.CreateSoftwareScheduleInput;
import com.openframe.api.dto.rmm.software.SoftwareBundleResponse;
import com.openframe.api.dto.rmm.software.SoftwareBundleScheduleInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.dto.rmm.software.SoftwareSchedulePackageInput;
import com.openframe.api.dto.rmm.software.SoftwareScheduleResponse;
import com.openframe.api.dto.rmm.software.SubmitSoftwareBundleInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.software.SoftwareBundle;
import com.openframe.data.document.rmm.software.SoftwareBundleMode;
import com.openframe.data.document.rmm.software.SoftwareBundleOnlineDispatch;
import com.openframe.data.document.rmm.software.SoftwareActionResult;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareBundleStatus;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.repository.rmm.SoftwareActionResultRepository;
import com.openframe.data.repository.rmm.SoftwareBundleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareBundleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.MachinePlatformResolver;
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
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareBundleService {

    private static final int MAX_PACKAGES = 50;

    private final SoftwareBundleRepository bundleRepository;
    private final SoftwareBundleOnlineDispatchRepository onlineDispatchRepository;
    private final SoftwareScheduleService softwareScheduleService;
    private final SoftwareActionResultRepository softwareActionResultRepository;
    private final MachinePlatformResolver machinePlatformResolver;
    private final TenantIdProvider tenantIdProvider;

    @Value("${openframe.rmm.software.bundle.pending-ttl}")
    private Duration pendingTtl;

    @Value("${openframe.rmm.software.bundle.schedule.reconnect-window-seconds}")
    private long scheduleReconnectWindowSeconds;

    public boolean delete(String id, String actor) {
        Optional<SoftwareBundle> found = bundleRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), id);
        if (found.isEmpty()) {
            return true;
        }
        SoftwareBundle entity = found.get();
        if (entity.getStatus() == SoftwareBundleStatus.COMPLETED) {
            return false;
        }
        bundleRepository.delete(entity);
        log.info("Deleted PENDING software bundle id={} actor={}", id, actor);
        return true;
    }

    public Optional<SoftwareBundleResponse> findById(String id) {
        return bundleRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), id).map(SoftwareBundleService::toResponse);
    }

    public SoftwareBundleResponse createBundleStub(String createdBy) {
        String tenantId = tenantIdProvider.getTenantId();
        Instant now = Instant.now();
        SoftwareBundle entity = SoftwareBundle.builder()
                .tenantId(tenantId)
                .status(SoftwareBundleStatus.PENDING)
                .machineIds(List.of())
                .packages(List.of())
                .createdBy(createdBy)
                .createdAt(now)
                .updatedAt(now)
                .expireAt(now.plus(pendingTtl))
                .build();
        SoftwareBundle saved = bundleRepository.save(entity);
        log.info("Created draft software bundle id={} tenantId={}", saved.getId(), tenantId);
        return toResponse(saved);
    }

    public SoftwareBundleResponse addDevices(String bundleId, List<String> machineIds, String actor) {
        SoftwareBundle entity = loadPendingOrThrow(bundleId);
        LinkedHashSet<String> set = new LinkedHashSet<>(currentMachineIds(entity));
        set.addAll(machineIds);
        entity.setMachineIds(List.copyOf(set));
        return saveTouched(entity, actor);
    }

    public SoftwareBundleResponse removeDevices(String bundleId, List<String> machineIds, String actor) {
        SoftwareBundle entity = loadPendingOrThrow(bundleId);
        LinkedHashSet<String> set = new LinkedHashSet<>(currentMachineIds(entity));
        machineIds.forEach(set::remove);
        entity.setMachineIds(List.copyOf(set));
        return saveTouched(entity, actor);
    }

    public SoftwareBundleResponse submit(SubmitSoftwareBundleInput input, String actor) {
        SoftwareBundle entity = loadOrThrow(input.getId());
        if (entity.getStatus() == SoftwareBundleStatus.COMPLETED) {
            log.info("submitSoftwareBundle id={} already COMPLETED — returning unchanged", input.getId());
            return toResponse(entity);
        }
        List<String> machineIds = currentMachineIds(entity);
        if (machineIds.isEmpty()) {
            throw new BadRequestException("Cannot submit software bundle " + input.getId() + ": no devices assigned");
        }
        List<SoftwareBundlePackage> packages = toDomainPackages(input.getPackages());
        validatePackages(packages);
        Map<String, OsType> deviceOsTypes = machinePlatformResolver.osTypesByMachineId(machineIds);
        rejectDevicesWithoutCompatiblePackage(machineIds, packages, deviceOsTypes);

        entity.setAction(input.getAction());
        entity.setPackages(packages);

        Instant now = Instant.now();
        if (input.getSchedule() != null) {
            entity.setMode(SoftwareBundleMode.SCHEDULED);
            entity.setStartAt(input.getSchedule().getStartAt());
            submitScheduled(entity, input.getSchedule(), actor);
        } else {
            entity.setMode(SoftwareBundleMode.NOW);
            armOnlineDispatch(entity, now);
            entity.setExecutionIds(executionIds(entity));
        }

        entity.setStatus(SoftwareBundleStatus.COMPLETED);
        entity.setCompletedAt(now);
        entity.setUpdatedAt(now);
        entity.setExpireAt(null); // completed bundles are history — never reaped
        bundleRepository.save(entity);

        writeActionResults(entity, packages, deviceOsTypes, now, actor);

        log.info("Submitted software bundle id={} mode={} action={} devices={} packages={} actor={}",
                entity.getId(), entity.getMode(), entity.getAction(), machineIds.size(), packages.size(), actor);
        return toResponse(entity);
    }

    private void writeActionResults(SoftwareBundle bundle, List<SoftwareBundlePackage> packages,
                                    Map<String, OsType> deviceOsTypes, Instant now, String actor) {
        boolean scheduled = bundle.getMode() == SoftwareBundleMode.SCHEDULED;
        List<SoftwareActionResult> results = new java.util.ArrayList<>(packages.size());
        for (SoftwareBundlePackage pkg : packages) {
            OsType packageOs = osTypeOf(pkg.getPackageManager());
            List<String> targets = currentMachineIds(bundle).stream()
                    .filter(machineId -> deviceOsTypes.get(machineId) == packageOs)
                    .toList();
            String executionId = scheduled
                    ? SoftwareExecutionId.forSchedule(bundle.getScheduleId(), pkg.getPackageManager(), pkg.getPackageName())
                    : SoftwareExecutionId.forBundle(bundle.getId(), pkg.getPackageManager(), pkg.getPackageName());
            results.add(SoftwareActionResult.builder()
                    .id(executionId)
                    .tenantId(bundle.getTenantId())
                    .executionId(executionId)
                    .action(bundle.getAction())
                    .packageManager(pkg.getPackageManager())
                    .packageName(pkg.getPackageName())
                    .version(pkg.getVersion())
                    .status(scheduled ? SoftwareActionStatus.SCHEDULED : SoftwareActionStatus.IN_PROGRESS)
                    .mode(bundle.getMode())
                    .machineIds(targets)
                    .totalMachineCount(targets.size())
                    .bundleId(scheduled ? null : bundle.getId())
                    .scheduleId(scheduled ? bundle.getScheduleId() : null)
                    .scheduledAt(scheduled ? bundle.getStartAt() : null)
                    .dispatchedAt(scheduled ? null : now)
                    .initiatedBy(actor)
                    .createdAt(now)
                    .build());
        }
        softwareActionResultRepository.saveAll(results);
        log.info("Wrote {} software action result(s) for bundle id={}", results.size(), bundle.getId());
    }

    private static void validatePackages(List<SoftwareBundlePackage> packages) {
        if (packages.isEmpty()) {
            throw new BadRequestException("Cannot submit software bundle: at least one package is required");
        }
        if (packages.size() > MAX_PACKAGES) {
            throw new BadRequestException("Cannot submit software bundle: at most " + MAX_PACKAGES
                    + " packages (got " + packages.size() + ")");
        }
        List<String> brewMissingType = packages.stream()
                .filter(p -> p.getPackageManager() == PackageManagerType.BREW && p.getBrewPackageType() == null)
                .map(SoftwareBundlePackage::getPackageName)
                .toList();
        if (!brewMissingType.isEmpty()) {
            throw new BadRequestException("brewPackageType (CASK or FORMULA) is required for brew packages: "
                    + brewMissingType);
        }
    }

    private void rejectDevicesWithoutCompatiblePackage(List<String> machineIds, List<SoftwareBundlePackage> packages,
                                                       Map<String, OsType> deviceOsTypes) {
        Set<OsType> packageOsTypes = packages.stream()
                .map(p -> osTypeOf(p.getPackageManager()))
                .collect(Collectors.toSet());
        List<String> incompatible = machineIds.stream()
                .filter(machineId -> {
                    OsType os = deviceOsTypes.get(machineId);
                    return os != null && !packageOsTypes.contains(os);
                })
                .toList();
        if (!incompatible.isEmpty()) {
            throw new BadRequestException("These devices have no package compatible with their OS: " + incompatible
                    + ". Add a matching package or remove the devices.");
        }
    }

    private static List<String> executionIds(SoftwareBundle bundle) {
        return bundle.getPackages().stream()
                .map(p -> SoftwareExecutionId.forBundle(bundle.getId(), p.getPackageManager(), p.getPackageName()))
                .toList();
    }

    private static OsType osTypeOf(PackageManagerType packageManager) {
        return packageManager == PackageManagerType.BREW ? OsType.MAC_OS : OsType.WINDOWS;
    }

    private void submitScheduled(SoftwareBundle bundle, SoftwareBundleScheduleInput sched, String actor) {
        CreateSoftwareScheduleInput input = new CreateSoftwareScheduleInput();
        input.setName(sched.getName() != null ? sched.getName() : scheduleName(bundle));
        input.setDescription(sched.getDescription());
        input.setAction(bundle.getAction());
        input.setPackages(toSchedulePackages(bundle.getPackages()));
        input.setTimeReference(sched.getTimeReference() != null ? sched.getTimeReference() : ScheduleTimeReference.SERVER);
        input.setOfflineBehavior(sched.getOfflineBehavior() != null ? sched.getOfflineBehavior() : ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        input.setReconnectWindowSeconds(sched.getReconnectWindowSeconds() != null
                ? sched.getReconnectWindowSeconds() : scheduleReconnectWindowSeconds);
        input.setStartAt(sched.getStartAt());
        input.setRepeat(sched.getRepeat());
        input.setMachineIds(bundle.getMachineIds());

        SoftwareScheduleResponse schedule = softwareScheduleService.create(input, actor);
        bundle.setScheduleId(schedule.getId());
        log.info("Submitted SCHEDULED software bundle id={} → schedule id={} startAt={}",
                bundle.getId(), schedule.getId(), bundle.getStartAt());
    }

    private static List<String> currentMachineIds(SoftwareBundle entity) {
        return entity.getMachineIds() == null ? List.of() : entity.getMachineIds();
    }

    private SoftwareBundleResponse saveTouched(SoftwareBundle entity, String actor) {
        Instant now = Instant.now();
        entity.setUpdatedAt(now);
        entity.setExpireAt(now.plus(pendingTtl));
        SoftwareBundle saved = bundleRepository.save(entity);
        log.debug("Touched software bundle id={} devices={} actor={}",
                saved.getId(), currentMachineIds(saved).size(), actor);
        return toResponse(saved);
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
                        .version(p.getVersion())
                        .build())
                .toList();
    }

    private static SoftwareBundleResponse toResponse(SoftwareBundle b) {
        return SoftwareBundleResponse.builder()
                .id(b.getId())
                .action(b.getAction())
                .mode(b.getMode())
                .status(b.getStatus())
                .machineIds(b.getMachineIds() == null ? List.of() : b.getMachineIds())
                .packages(b.getPackages() == null ? List.of() : b.getPackages())
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
