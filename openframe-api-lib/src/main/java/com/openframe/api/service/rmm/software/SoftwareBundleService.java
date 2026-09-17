package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.CreateSoftwareBundleInput;
import com.openframe.api.dto.rmm.software.SoftwareBundleResponse;
import com.openframe.api.dto.rmm.software.SoftwareDispatchResult;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.dto.rmm.software.UpdateSoftwareBundleInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareBundle;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareBundleStatus;
import com.openframe.data.repository.rmm.SoftwareBundleRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class SoftwareBundleService {

    private final SoftwareBundleRepository bundleRepository;
    private final SoftwareInstallUpdateManagementService installUpdateService;
    private final TenantIdProvider tenantIdProvider;

    /** TTL after which a still-PENDING bundle is considered abandoned; refreshed on every edit. */
    @Value("${openframe.rmm.software.bundle.pending-ttl:1h}")
    private Duration pendingTtl;

    public SoftwareBundleResponse create(CreateSoftwareBundleInput input, String createdBy) {
        String tenantId = tenantIdProvider.getTenantId();
        Instant now = Instant.now();
        SoftwareBundle entity = SoftwareBundle.builder()
                .tenantId(tenantId)
                .action(input.getAction())
                .status(SoftwareBundleStatus.PENDING)
                .machineIds(List.copyOf(input.getMachineIds()))
                .packages(toDomainPackages(input.getPackages()))
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
        entity.setMachineIds(List.copyOf(input.getMachineIds()));
        entity.setPackages(toDomainPackages(input.getPackages()));
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

    public SoftwareBundleResponse get(String id) {
        return toResponse(loadOrThrow(id));
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

    public List<SoftwareDispatchResult> run(String id, String actor) {
        SoftwareBundle entity = loadPendingOrThrow(id);
        if (entity.getPackages() == null || entity.getPackages().isEmpty()) {
            throw new BadRequestException("Cannot run software bundle " + id + ": no packages selected");
        }

        SoftwareManagementInput input = new SoftwareManagementInput();
        input.setMachineIds(entity.getMachineIds());
        input.setPackages(toInputPackages(entity.getPackages()));

        List<SoftwareDispatchResult> results = entity.getAction() == SoftwareAction.INSTALL
                ? installUpdateService.install(input, actor, ExecutionSource.MANUAL)
                : installUpdateService.update(input, actor, ExecutionSource.MANUAL);

        Instant now = Instant.now();
        entity.setStatus(SoftwareBundleStatus.COMPLETED);
        entity.setCompletedAt(now);
        entity.setUpdatedAt(now);
        entity.setExpireAt(null); // completed bundles are history — never reaped
        entity.setExecutionIds(results.stream().map(SoftwareDispatchResult::getExecutionId).toList());
        bundleRepository.save(entity);

        log.info("Ran software bundle id={} action={} dispatched={} actor={}",
                id, entity.getAction(), results.size(), actor);
        return results;
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

    private static List<SoftwarePackageInput> toInputPackages(List<SoftwareBundlePackage> packages) {
        return packages.stream()
                .map(p -> {
                    SoftwarePackageInput input = new SoftwarePackageInput();
                    input.setPackageManager(p.getPackageManager());
                    input.setPackageName(p.getPackageName());
                    input.setBrewPackageType(p.getBrewPackageType());
                    return input;
                })
                .toList();
    }

    private static SoftwareBundleResponse toResponse(SoftwareBundle b) {
        return SoftwareBundleResponse.builder()
                .id(b.getId())
                .action(b.getAction())
                .status(b.getStatus())
                .machineIds(b.getMachineIds())
                .packages(b.getPackages())
                .createdBy(b.getCreatedBy())
                .createdAt(b.getCreatedAt())
                .updatedAt(b.getUpdatedAt())
                .completedAt(b.getCompletedAt())
                .executionIds(b.getExecutionIds())
                .build();
    }
}
