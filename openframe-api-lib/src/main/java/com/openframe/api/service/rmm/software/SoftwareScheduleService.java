package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.CreateSoftwareScheduleInput;
import com.openframe.api.dto.rmm.software.SoftwareSchedulePackageInput;
import com.openframe.api.dto.rmm.software.SoftwareScheduleResponse;
import com.openframe.api.dto.rmm.software.UpdateSoftwareScheduleInput;
import com.openframe.api.service.rmm.schedule.ScheduleGrid;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class SoftwareScheduleService {

    private static final List<ScriptStatus> NAME_UNIQUE_STATUSES = List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);
    private static final List<ScriptStatus> VISIBLE_STATUSES = List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);

    private final SoftwareScheduleRepository scheduleRepository;
    private final SoftwareScheduleMachineAssignedRepository assignedRepository;
    private final SoftwareScheduleTargetResolver targetResolver;
    private final TenantIdProvider tenantIdProvider;

    public SoftwareScheduleResponse create(CreateSoftwareScheduleInput input, String createdBy) {
        String tenantId = tenantIdProvider.getTenantId();
        if (scheduleRepository.existsByTenantIdAndNameAndStatusIn(tenantId, input.getName(), NAME_UNIQUE_STATUSES)) {
            throw new ConflictException("Software schedule with name '" + input.getName() + "' already exists");
        }

        ScheduleTimeReference timeReference = defaultTimeReference(input.getTimeReference());
        validateTiming(input.getStartAt(), input.getRepeat());

        SoftwareSchedule entity = SoftwareSchedule.builder()
                .tenantId(tenantId)
                .name(input.getName())
                .description(input.getDescription())
                .action(input.getAction())
                .packages(toPackages(input.getPackages()))
                .trigger(ScheduleScriptTrigger.DATE_TIME)
                .timeReference(timeReference)
                .offlineBehavior(input.getOfflineBehavior())
                .reconnectWindowSeconds(input.getReconnectWindowSeconds())
                .startAt(input.getStartAt())
                .repeat(input.getRepeat())
                .nextRunAt(seedNextRunAt(timeReference, input.getStartAt()))
                .status(ScriptStatus.ACTIVE)
                .createdBy(createdBy)
                .build();
        SoftwareSchedule saved = scheduleRepository.save(entity);
        replaceDevices(tenantId, saved.getId(), input.getMachineIds(), createdBy);
        log.info("Created software schedule id={} name='{}' tenantId={}", saved.getId(), saved.getName(), tenantId);
        return toResponse(saved);
    }

    public SoftwareScheduleResponse update(UpdateSoftwareScheduleInput input, String updatedBy) {
        String tenantId = tenantIdProvider.getTenantId();
        SoftwareSchedule entity = loadVisibleOrThrow(tenantId, input.getId());
        if (scheduleRepository.existsByTenantIdAndNameAndIdNotAndStatusIn(
                tenantId, input.getName(), input.getId(), NAME_UNIQUE_STATUSES)) {
            throw new ConflictException("Software schedule with name '" + input.getName() + "' already exists");
        }

        ScheduleTimeReference timeReference = defaultTimeReference(input.getTimeReference());
        validateTiming(input.getStartAt(), input.getRepeat());

        entity.setName(input.getName());
        entity.setDescription(input.getDescription());
        entity.setAction(input.getAction());
        entity.setPackages(toPackages(input.getPackages()));
        entity.setTimeReference(timeReference);
        entity.setOfflineBehavior(input.getOfflineBehavior());
        entity.setReconnectWindowSeconds(input.getReconnectWindowSeconds());
        entity.setStartAt(input.getStartAt());
        entity.setRepeat(input.getRepeat());
        entity.setNextRunAt(seedNextRunAt(timeReference, input.getStartAt()));
        SoftwareSchedule saved = scheduleRepository.save(entity);
        if (input.getMachineIds() != null) {
            replaceDevices(tenantId, saved.getId(), input.getMachineIds(), updatedBy);
        }
        return toResponse(saved);
    }

    public SoftwareScheduleResponse get(String id) {
        return toResponse(loadVisibleOrThrow(tenantIdProvider.getTenantId(), id));
    }

    public Optional<SoftwareScheduleResponse> findById(String id) {
        return scheduleRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), id)
                .filter(s -> s.getStatus() != ScriptStatus.DELETED)
                .map(this::toResponse);
    }

    public List<SoftwareScheduleResponse> list() {
        return scheduleRepository
                .findByTenantIdAndStatusInOrderByIdDesc(tenantIdProvider.getTenantId(), VISIBLE_STATUSES)
                .stream().map(this::toResponse).toList();
    }

    /** Soft-delete (status DELETED). Idempotent; returns the id. */
    public String delete(String id) {
        String tenantId = tenantIdProvider.getTenantId();
        SoftwareSchedule entity = scheduleRepository.findByTenantIdAndId(tenantId, id)
                .orElseThrow(() -> new NotFoundException("Software schedule not found: " + id));
        if (entity.getStatus() != ScriptStatus.DELETED) {
            entity.setStatus(ScriptStatus.DELETED);
            entity.setStatusChangedAt(Instant.now());
            scheduleRepository.save(entity);
        }
        return id;
    }

    /** Archive a schedule (idempotent). */
    public SoftwareScheduleResponse archive(String id) {
        return transitionTo(id, ScriptStatus.ARCHIVED);
    }

    /** Restore an archived schedule back to ACTIVE (idempotent). */
    public SoftwareScheduleResponse unarchive(String id) {
        return transitionTo(id, ScriptStatus.ACTIVE);
    }

    private SoftwareScheduleResponse transitionTo(String id, ScriptStatus target) {
        String tenantId = tenantIdProvider.getTenantId();
        SoftwareSchedule entity = loadVisibleOrThrow(tenantId, id);
        if (entity.getStatus() != target) {
            entity.setStatus(target);
            entity.setStatusChangedAt(Instant.now());
            entity = scheduleRepository.save(entity);
        }
        return toResponse(entity);
    }

    /** Replace the full assigned device set (PUT — backs "Edit Devices"). */
    public SoftwareScheduleResponse setDevices(String scheduleId, List<String> machineIds, String actor) {
        String tenantId = tenantIdProvider.getTenantId();
        SoftwareSchedule entity = loadVisibleOrThrow(tenantId, scheduleId);
        replaceDevices(tenantId, scheduleId, machineIds, actor);
        return toResponse(entity);
    }

    /** Incrementally assign devices (idempotent — already-assigned ids are skipped). */
    public void addDevices(String scheduleId, List<String> machineIds, String actor) {
        String tenantId = tenantIdProvider.getTenantId();
        loadVisibleOrThrow(tenantId, scheduleId);
        if (machineIds == null || machineIds.isEmpty()) {
            return;
        }
        Set<String> existing = new HashSet<>(getMachineIds(scheduleId));
        List<SoftwareScheduleMachineAssigned> rows = machineIds.stream().distinct()
                .filter(id -> !existing.contains(id))
                .map(machineId -> SoftwareScheduleMachineAssigned.builder()
                        .tenantId(tenantId).softwareScheduleId(scheduleId).machineId(machineId).createdBy(actor).build())
                .toList();
        if (!rows.isEmpty()) {
            assignedRepository.saveAll(rows);
        }
    }

    public void removeDevices(String scheduleId, List<String> machineIds, String actor) {
        String tenantId = tenantIdProvider.getTenantId();
        loadVisibleOrThrow(tenantId, scheduleId);
        if (machineIds == null || machineIds.isEmpty()) {
            return;
        }
        assignedRepository.deleteByTenantIdAndSoftwareScheduleIdAndMachineIdIn(tenantId, scheduleId, machineIds);
    }

    public List<String> getMachineIds(String scheduleId) {
        return targetResolver.resolveMachineIds(tenantIdProvider.getTenantId(), scheduleId);
    }

    public int deviceCount(String scheduleId) {
        return (int) assignedRepository
                .countByTenantIdAndSoftwareScheduleId(tenantIdProvider.getTenantId(), scheduleId);
    }

    private void replaceDevices(String tenantId, String scheduleId, List<String> machineIds, String actor) {
        assignedRepository.deleteByTenantIdAndSoftwareScheduleId(tenantId, scheduleId);
        if (machineIds == null || machineIds.isEmpty()) {
            return;
        }
        List<SoftwareScheduleMachineAssigned> rows = machineIds.stream().distinct()
                .map(machineId -> SoftwareScheduleMachineAssigned.builder()
                        .tenantId(tenantId).softwareScheduleId(scheduleId).machineId(machineId).createdBy(actor).build())
                .toList();
        assignedRepository.saveAll(rows);
    }

    private SoftwareSchedule loadVisibleOrThrow(String tenantId, String id) {
        return scheduleRepository.findByTenantIdAndId(tenantId, id)
                .filter(s -> s.getStatus() != ScriptStatus.DELETED)
                .orElseThrow(() -> new NotFoundException("Software schedule not found: " + id));
    }

    private static ScheduleTimeReference defaultTimeReference(ScheduleTimeReference timeReference) {
        return timeReference != null ? timeReference : ScheduleTimeReference.SERVER;
    }

    /** SERVER runs off {@code nextRunAt}=startAt; DEVICE_LOCAL is timezone-driven, so its nextRunAt is null. */
    private static Instant seedNextRunAt(ScheduleTimeReference timeReference, Instant startAt) {
        return timeReference == ScheduleTimeReference.DEVICE_LOCAL ? null : startAt;
    }

    private static void validateTiming(Instant startAt, Long repeatSeconds) {
        if (startAt == null) {
            throw new BadRequestException("A software schedule requires a run date and time (startAt)");
        }
        ScheduleGrid.validateGrid(startAt, repeatSeconds);
    }

    private static List<SoftwareSchedulePackage> toPackages(List<SoftwareSchedulePackageInput> packages) {
        return packages.stream()
                .map(p -> SoftwareSchedulePackage.builder()
                        .packageManager(p.getPackageManager())
                        .packageName(p.getPackageName())
                        .brewPackageType(p.getBrewPackageType())
                        .build())
                .toList();
    }

    private SoftwareScheduleResponse toResponse(SoftwareSchedule s) {
        return SoftwareScheduleResponse.builder()
                .id(s.getId()).name(s.getName()).description(s.getDescription())
                .action(s.getAction()).packages(s.getPackages())
                .selectionMode(s.getSelectionMode()).trigger(s.getTrigger()).timeReference(s.getTimeReference())
                .offlineBehavior(s.getOfflineBehavior()).reconnectWindowSeconds(s.getReconnectWindowSeconds())
                .startAt(s.getStartAt()).repeat(s.getRepeat())
                .nextRunAt(s.getNextRunAt()).lastRunAt(s.getLastRunAt())
                .status(s.getStatus()).createdBy(s.getCreatedBy())
                .createdAt(s.getCreatedAt()).updatedAt(s.getUpdatedAt())
                .build();
    }
}
