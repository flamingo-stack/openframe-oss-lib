package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.CreateSoftwareScheduleInput;
import com.openframe.api.dto.rmm.software.SoftwareSchedulePackageInput;
import com.openframe.api.dto.rmm.software.SoftwareScheduleResponse;
import com.openframe.api.dto.rmm.software.UpdateSoftwareScheduleInput;
import com.openframe.api.service.rmm.schedule.ScheduleDeviceChange;
import com.openframe.api.service.rmm.schedule.ScheduleGrid;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.Audited;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.ScheduleMutationTransaction;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;

import static com.openframe.data.document.audit.AuditAction.SOFTWARE_SCHEDULE_DEVICES_ADD;
import static com.openframe.data.document.audit.AuditAction.SOFTWARE_SCHEDULE_DEVICES_REMOVE;
import static com.openframe.data.document.audit.AuditAction.SOFTWARE_SCHEDULE_DEVICES_SET;
import static java.util.stream.Collectors.toSet;
import static org.springframework.util.CollectionUtils.isEmpty;

/** Manages when software schedules run, what they install or update, and which devices they target. */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
public class SoftwareScheduleService {

    private static final List<ScriptStatus> NAME_UNIQUE_STATUSES = List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);
    private static final List<ScriptStatus> VISIBLE_STATUSES = List.of(ScriptStatus.ACTIVE, ScriptStatus.ARCHIVED);

    private final SoftwareScheduleRepository scheduleRepository;
    private final SoftwareScheduleMachineAssignedRepository assignedRepository;
    private final SoftwareScheduleTargetResolver targetResolver;
    private final TenantIdProvider tenantIdProvider;
    private final PackageManagerAvailability packageManagerAvailability;
    private final SoftwarePackageSelectionResolver softwarePackageSelectionResolver;
    private final MachineRepository machineRepository;
    private final ScheduleMutationTransaction scheduleTransaction;
    private final AuditRecorder auditRecorder;

    public SoftwareScheduleResponse create(CreateSoftwareScheduleInput input, String createdBy) {
        String tenantId = tenantIdProvider.getTenantId();
        if (scheduleRepository.existsByTenantIdAndNameAndStatusIn(tenantId, input.getName(), NAME_UNIQUE_STATUSES)) {
            throw new ConflictException("Software schedule with name '" + input.getName() + "' already exists");
        }

        ScheduleTimeReference timeReference = defaultTimeReference(input.getTimeReference());
        validateTiming(input.getStartAt(), input.getRepeat());
        SoftwareBundleService.rejectAdopt(input.getAction());
        List<SoftwareSchedulePackage> packages = toPackages(input.getPackages());

        SoftwareSchedule entity = SoftwareSchedule.builder()
                .tenantId(tenantId)
                .name(input.getName())
                .description(input.getDescription())
                .action(input.getAction())
                .packages(packages)
                .updateSettings(PackageUpdateSettingsMapper.updateSettings(input.getAction(), input.getUpdateSettings()))
                .autoUpdate(PackageUpdateSettingsMapper.autoUpdate(input.getAction(), input.getAutoUpdate()))
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
        return withDeviceAssignments(input.getMachineIds(), () -> createSchedule(entity, input.getMachineIds()));
    }

    private SoftwareScheduleResponse createSchedule(SoftwareSchedule entity, List<String> machineIds) {
        String tenantId = entity.getTenantId();
        requireAssignableDevices(tenantId, machineIds, managersOf(entity.getPackages()));
        SoftwareSchedule saved = scheduleRepository.save(entity);
        replaceDevices(tenantId, saved.getId(), machineIds, saved.getCreatedBy());
        log.info("Created software schedule id={} name='{}' tenantId={}", saved.getId(), saved.getName(), tenantId);
        return toResponse(saved);
    }

    public SoftwareScheduleResponse update(UpdateSoftwareScheduleInput input, String updatedBy) {
        String tenantId = tenantIdProvider.getTenantId();
        loadVisibleOrThrow(tenantId, input.getId());
        if (scheduleRepository.existsByTenantIdAndNameAndIdNotAndStatusIn(
                tenantId, input.getName(), input.getId(), NAME_UNIQUE_STATUSES)) {
            throw new ConflictException("Software schedule with name '" + input.getName() + "' already exists");
        }

        ScheduleTimeReference timeReference = defaultTimeReference(input.getTimeReference());
        validateTiming(input.getStartAt(), input.getRepeat());
        SoftwareBundleService.rejectAdopt(input.getAction());
        List<SoftwareSchedulePackage> packages = toPackages(input.getPackages());
        return withDeviceAssignments(input.getMachineIds(), () -> updateSchedule(tenantId, input, updatedBy, timeReference, packages));
    }

    private SoftwareScheduleResponse updateSchedule(String tenantId, UpdateSoftwareScheduleInput input, String updatedBy,
                                                    ScheduleTimeReference timeReference, List<SoftwareSchedulePackage> packages) {
        SoftwareSchedule entity = loadVisibleOrThrow(tenantId, input.getId());
        requireAssignableDevices(tenantId, input.getMachineIds(), managersOf(packages));

        entity.setName(input.getName());
        entity.setDescription(input.getDescription());
        entity.setAction(input.getAction());
        entity.setPackages(packages);
        entity.setUpdateSettings(PackageUpdateSettingsMapper.updateSettings(input.getAction(), input.getUpdateSettings()));
        entity.setAutoUpdate(PackageUpdateSettingsMapper.autoUpdate(input.getAction(), input.getAutoUpdate()));
        entity.setTimeReference(timeReference);
        entity.setOfflineBehavior(input.getOfflineBehavior());
        entity.setReconnectWindowSeconds(input.getReconnectWindowSeconds());
        entity.setStartAt(input.getStartAt());
        entity.setRepeat(input.getRepeat());
        entity.setNextRunAt(seedNextRunAt(timeReference, input.getStartAt()));
        SoftwareSchedule saved = scheduleRepository.save(entity);
        if (input.getMachineIds() != null) {
            List<String> before = assignedMachineIds(tenantId, saved.getId());
            replaceDevices(tenantId, saved.getId(), input.getMachineIds(), updatedBy);
            recordDeviceChange(saved.getId(), ScheduleDeviceChange.between(before, input.getMachineIds(), false));
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

    public SoftwareScheduleResponse archive(String id) {
        return transitionTo(id, ScriptStatus.ARCHIVED);
    }

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

    @Audited(action = SOFTWARE_SCHEDULE_DEVICES_SET, targetId = "#scheduleId", compare = false,
            condition = "!#result.isEmpty()",
            details = {"added=#result.added()", "removed=#result.removed()",
                    "switchedFromCriteria=#result.switchedFromCriteria() ? true : null",
                    "machineIds=#result == null ? #machineIds : null"})
    public ScheduleDeviceChange setDevices(String scheduleId, List<String> machineIds, String actor) {
        return withDeviceAssignments(machineIds, () -> replaceAssignedDevices(scheduleId, machineIds, actor));
    }

    private ScheduleDeviceChange replaceAssignedDevices(String scheduleId, List<String> machineIds, String actor) {
        String tenantId = tenantIdProvider.getTenantId();
        SoftwareSchedule entity = loadVisibleOrThrow(tenantId, scheduleId);
        List<PackageManagerType> managers = managersOf(entity.getPackages());
        requireAssignableDevices(tenantId, machineIds, managers);
        boolean switchedFromCriteria = ensureSpecificMode(entity);
        List<String> before = assignedMachineIds(tenantId, scheduleId);
        replaceDevices(tenantId, scheduleId, machineIds, actor);
        List<String> after = Objects.requireNonNullElse(machineIds, List.of());
        return ScheduleDeviceChange.between(before, after, switchedFromCriteria);
    }

    @Audited(action = SOFTWARE_SCHEDULE_DEVICES_ADD, targetId = "#scheduleId", compare = false,
            condition = "!#result.isEmpty()",
            details = {"machineIds=#result == null ? #machineIds : #result.added()",
                    "switchedFromCriteria=#result.switchedFromCriteria() ? true : null"})
    public ScheduleDeviceChange addDevices(String scheduleId, List<String> machineIds, String actor) {
        if (isEmpty(machineIds)) {
            loadVisibleOrThrow(tenantIdProvider.getTenantId(), scheduleId);
            return new ScheduleDeviceChange(List.of(), List.of(), false);
        }
        try {
            return scheduleTransaction.run(() -> appendAssignedDevices(scheduleId, machineIds, actor));
        } catch (OptimisticLockingFailureException conflict) {
            throw assignmentConflict();
        }
    }

    private ScheduleDeviceChange appendAssignedDevices(String scheduleId, List<String> machineIds, String actor) {
        String tenantId = tenantIdProvider.getTenantId();
        SoftwareSchedule entity = loadVisibleOrThrow(tenantId, scheduleId);
        List<PackageManagerType> managers = managersOf(entity.getPackages());
        requireAssignableDevices(tenantId, machineIds, managers);
        boolean switchedFromCriteria = ensureSpecificMode(entity);
        Set<String> existing = new HashSet<>(assignedMachineIds(tenantId, scheduleId));
        List<SoftwareScheduleMachineAssigned> rows = machineIds.stream().distinct()
                .filter(id -> !existing.contains(id))
                .map(machineId -> SoftwareScheduleMachineAssigned.builder()
                        .tenantId(tenantId).softwareScheduleId(scheduleId).machineId(machineId).createdBy(actor).build())
                .toList();
        saveAssignments(rows);
        List<String> added = rows.stream().map(SoftwareScheduleMachineAssigned::getMachineId).toList();
        return new ScheduleDeviceChange(added, List.of(), switchedFromCriteria);
    }

    @Audited(action = SOFTWARE_SCHEDULE_DEVICES_REMOVE, targetId = "#scheduleId", compare = false,
            condition = "!#result.isEmpty()", details = "machineIds=#result == null ? #machineIds : #result")
    public List<String> removeDevices(String scheduleId, List<String> machineIds, String actor) {
        String tenantId = tenantIdProvider.getTenantId();
        loadVisibleOrThrow(tenantId, scheduleId);
        if (isEmpty(machineIds)) {
            return List.of();
        }
        Set<String> assigned = new HashSet<>(assignedMachineIds(tenantId, scheduleId));
        List<String> removed = machineIds.stream().distinct().filter(assigned::contains).toList();
        assignedRepository.deleteByTenantIdAndSoftwareScheduleIdAndMachineIdIn(tenantId, scheduleId, machineIds);
        return removed;
    }

    public SoftwareScheduleResponse setDeviceCriteria(String scheduleId, ScheduleDeviceCriteria criteria, String actor) {
        String tenantId = tenantIdProvider.getTenantId();
        SoftwareSchedule entity = loadVisibleOrThrow(tenantId, scheduleId);
        entity.setSelectionMode(ScheduleDeviceSelectionMode.CRITERIA);
        entity.setDeviceCriteria(criteria);
        SoftwareSchedule saved = scheduleRepository.save(entity);
        log.info("Applied device criteria to software schedule id={} tenantId={} by user={}: {}",
                scheduleId, tenantId, actor, criteria);
        return toResponse(saved);
    }

    public List<String> getMachineIds(String scheduleId) {
        return targetResolver.resolveMachineIds(loadVisibleOrThrow(tenantIdProvider.getTenantId(), scheduleId));
    }

    public int deviceCount(String scheduleId) {
        return getMachineIds(scheduleId).size();
    }

    private void recordDeviceChange(String scheduleId, ScheduleDeviceChange change) {
        if (change.isEmpty()) {
            return;
        }
        auditRecorder.record(AuditEntry.builder()
                .action(SOFTWARE_SCHEDULE_DEVICES_SET)
                .outcome(AuditOutcome.SUCCESS)
                .targetId(scheduleId)
                .details(Map.of("added", change.added(), "removed", change.removed()))
                .build());
    }

    private List<String> assignedMachineIds(String tenantId, String scheduleId) {
        return assignedRepository.findOnPrimaryByTenantIdAndSoftwareScheduleId(tenantId, scheduleId).stream()
                .map(SoftwareScheduleMachineAssigned::getMachineId).toList();
    }

    private static List<PackageManagerType> managersOf(List<SoftwareSchedulePackage> packages) {
        return packages.stream()
                .map(SoftwareSchedulePackage::getPackageManager)
                .distinct()
                .toList();
    }

    private boolean ensureSpecificMode(SoftwareSchedule schedule) {
        ScheduleDeviceSelectionMode mode = schedule.getSelectionMode();
        if (mode != ScheduleDeviceSelectionMode.SPECIFIC) {
            schedule.setSelectionMode(ScheduleDeviceSelectionMode.SPECIFIC);
            schedule.setDeviceCriteria(null);
            scheduleRepository.save(schedule);
        }
        return mode == ScheduleDeviceSelectionMode.CRITERIA;
    }

    private void replaceDevices(String tenantId, String scheduleId, List<String> machineIds, String actor) {
        assignedRepository.deleteByTenantIdAndSoftwareScheduleId(tenantId, scheduleId);
        if (isEmpty(machineIds)) {
            return;
        }
        List<SoftwareScheduleMachineAssigned> rows = machineIds.stream().distinct()
                .map(machineId -> SoftwareScheduleMachineAssigned.builder()
                        .tenantId(tenantId).softwareScheduleId(scheduleId).machineId(machineId).createdBy(actor).build())
                .toList();
        saveAssignments(rows);
    }

    private void saveAssignments(List<SoftwareScheduleMachineAssigned> rows) {
        if (!rows.isEmpty()) {
            assignedRepository.saveAll(rows);
        }
    }

    private <T> T withDeviceAssignments(List<String> machineIds, Supplier<T> change) {
        if (isEmpty(machineIds)) {
            return change.get();
        }
        try {
            return scheduleTransaction.run(change::get);
        } catch (OptimisticLockingFailureException conflict) {
            throw assignmentConflict();
        }
    }

    private void requireAssignableDevices(String tenantId, List<String> ids, List<PackageManagerType> managers) {
        packageManagerAvailability.requireSoftwareManageable(ids, managers);
        if (isEmpty(ids)) {
            return;
        }
        Set<String> distinctIds = new HashSet<>(ids);
        Set<String> managed = machineRepository.findOnPrimaryByTenantIdAndMachineIdIn(tenantId, distinctIds).stream()
                .filter(machine -> DeviceStatus.CONNECTED.contains(machine.getStatus()))
                .map(Machine::getMachineId)
                .collect(toSet());
        List<String> invalid = ids.stream().distinct().filter(id -> !managed.contains(id)).toList();
        if (!invalid.isEmpty()) {
            throw new BadRequestException("Devices must be managed by this tenant to be assigned to a software schedule: " + invalid);
        }
        if (machineRepository.reserveForSoftwareAssignments(tenantId, distinctIds, DeviceStatus.CONNECTED) != distinctIds.size()) {
            throw assignmentConflict();
        }
    }

    private static ConflictException assignmentConflict() {
        return new ConflictException("A device changed while updating software schedule assignments. Try again.");
    }

    private SoftwareSchedule loadVisibleOrThrow(String tenantId, String id) {
        return scheduleRepository.findByTenantIdAndId(tenantId, id)
                .filter(s -> s.getStatus() != ScriptStatus.DELETED)
                .orElseThrow(() -> new NotFoundException("Software schedule not found: " + id));
    }

    private static ScheduleTimeReference defaultTimeReference(ScheduleTimeReference timeReference) {
        return timeReference != null ? timeReference : ScheduleTimeReference.SERVER;
    }

    // DEVICE_LOCAL is timezone-driven → no seeded nextRunAt; SERVER runs off startAt.
    private static Instant seedNextRunAt(ScheduleTimeReference timeReference, Instant startAt) {
        return timeReference == ScheduleTimeReference.DEVICE_LOCAL ? null : startAt;
    }

    private static void validateTiming(Instant startAt, Long repeatSeconds) {
        if (startAt == null) {
            throw new BadRequestException("A software schedule requires a run date and time (startAt)");
        }
        ScheduleGrid.validateGrid(startAt, repeatSeconds);
    }

    private List<SoftwareSchedulePackage> toPackages(List<SoftwareSchedulePackageInput> packages) {
        softwarePackageSelectionResolver.resolve(packages);
        List<String> brewMissingType = packages.stream()
                .filter(p -> p.getPackageManager() == PackageManagerType.BREW && p.getBrewPackageType() == null)
                .map(SoftwareSchedulePackageInput::getPackageName)
                .toList();
        if (!brewMissingType.isEmpty()) {
            throw new BadRequestException("brewPackageType (CASK or FORMULA) is required for brew packages: "
                    + brewMissingType);
        }
        return packages.stream()
                .map(p -> SoftwareSchedulePackage.builder()
                        .packageManager(p.getPackageManager())
                        .packageName(p.getPackageName())
                        .brewPackageType(p.getBrewPackageType())
                        .softwareId(p.getSoftwareId())
                        .build())
                .toList();
    }

    private SoftwareScheduleResponse toResponse(SoftwareSchedule s) {
        return SoftwareScheduleResponse.builder()
                .id(s.getId()).name(s.getName()).description(s.getDescription())
                .action(s.getAction()).packages(s.getPackages())
                .updateSettings(s.getUpdateSettings()).autoUpdate(s.getAutoUpdate())
                .selectionMode(s.getSelectionMode()).deviceCriteria(s.getDeviceCriteria())
                .trigger(s.getTrigger()).timeReference(s.getTimeReference())
                .offlineBehavior(s.getOfflineBehavior()).reconnectWindowSeconds(s.getReconnectWindowSeconds())
                .startAt(s.getStartAt()).repeat(s.getRepeat())
                .nextRunAt(s.getNextRunAt()).lastRunAt(s.getLastRunAt())
                .status(s.getStatus()).createdBy(s.getCreatedBy())
                .createdAt(s.getCreatedAt()).updatedAt(s.getUpdatedAt())
                .build();
    }
}
