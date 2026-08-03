package com.openframe.api.service.rmm;

import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import com.openframe.data.util.MachineOsClassifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScriptScheduleDeviceService {

    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScriptScheduleRepository scheduleRepository;
    private final MachineRepository machineRepository;
    private final ScheduleDeviceTargetResolver targetResolver;
    private final TenantIdProvider tenantIdProvider;

    @Transactional
    public void setDevices(String scheduleId, List<String> machineIds, String actorUserId) {
        String tenantId = tenantIdProvider.getTenantId();
        ScriptSchedule schedule = requireVisibleSchedule(tenantId, scheduleId);   // throws NotFound if missing / DELETED

        Set<String> requested = machineIds == null ? Set.of()
                : new LinkedHashSet<>(machineIds);

        validateDevices(tenantId, schedule.getSupportedPlatforms(), requested);
        ensureSpecificMode(schedule);

        Set<String> current = assignedRepository
                .findByTenantIdAndScriptScheduleId(tenantId, scheduleId).stream()
                .map(ScriptScheduleMachineAssigned::getMachineId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        Set<String> toAdd = new LinkedHashSet<>(requested);
        toAdd.removeAll(current);
        Set<String> toRemove = new HashSet<>(current);
        toRemove.removeAll(requested);

        if (!toRemove.isEmpty()) {
            assignedRepository.deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(tenantId, scheduleId, toRemove);
        }
        if (!toAdd.isEmpty()) {
            List<ScriptScheduleMachineAssigned> rows = toAdd.stream()
                    .map(mid -> ScriptScheduleMachineAssigned.builder()
                            .tenantId(tenantId)
                            .scriptScheduleId(scheduleId)
                            .machineId(mid)
                            .createdBy(actorUserId)
                            .build())
                    .toList();
            assignedRepository.saveAll(rows);
        }

        log.info("Set {} device(s) on script schedule id={} tenantId={} (+{} -{})",
                requested.size(), scheduleId, tenantId, toAdd.size(), toRemove.size());
    }

    /**
     * Incrementally assign devices to a schedule (idempotent — already-assigned ids are skipped).
     * Platform-validated: rejects devices whose OS doesn't match the schedule's supportedPlatforms.
     */
    @Transactional
    public void addDevices(String scheduleId, List<String> machineIds, String actorUserId) {
        String tenantId = tenantIdProvider.getTenantId();
        ScriptSchedule schedule = requireVisibleSchedule(tenantId, scheduleId);
        if (machineIds == null || machineIds.isEmpty()) {
            return;
        }
        Set<String> requested = new LinkedHashSet<>(machineIds);
        validateDevices(tenantId, schedule.getSupportedPlatforms(), requested);
        ensureSpecificMode(schedule);

        Set<String> current = assignedRepository.findByTenantIdAndScriptScheduleId(tenantId, scheduleId).stream()
                .map(ScriptScheduleMachineAssigned::getMachineId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        List<ScriptScheduleMachineAssigned> rows = requested.stream()
                .filter(mid -> !current.contains(mid))
                .map(mid -> ScriptScheduleMachineAssigned.builder()
                        .tenantId(tenantId)
                        .scriptScheduleId(scheduleId)
                        .machineId(mid)
                        .createdBy(actorUserId)
                        .build())
                .toList();
        if (!rows.isEmpty()) {
            assignedRepository.saveAll(rows);
        }
        log.info("Added {} device(s) to script schedule id={} tenantId={}", rows.size(), scheduleId, tenantId);
    }

    /** Incrementally unassign devices from a schedule (missing ids are simply no-ops). */
    @Transactional
    public void removeDevices(String scheduleId, List<String> machineIds, String actorUserId) {
        String tenantId = tenantIdProvider.getTenantId();
        requireVisibleSchedule(tenantId, scheduleId);
        if (machineIds == null || machineIds.isEmpty()) {
            return;
        }
        long removed = assignedRepository.deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(
                tenantId, scheduleId, new LinkedHashSet<>(machineIds));
        log.info("Removed {} device(s) from script schedule id={} tenantId={}", removed, scheduleId, tenantId);
    }

    public void removeDeviceFromAllSchedules(String tenantId, String machineId) {
        if (tenantId == null || machineId == null) {
            return;
        }
        long removed = assignedRepository.deleteByTenantIdAndMachineId(tenantId, machineId);
        if (removed > 0) {
            log.info("Removed deleted device {} from {} schedule assignment(s) tenantId={}",
                    machineId, removed, tenantId);
        }
    }

    /**
     * The current target machineIds for a single schedule (empty if none / schedule missing).
     * Mode-aware: SPECIFIC schedules read their join rows, CRITERIA schedules resolve dynamically.
     */
    public List<String> getMachineIds(String scheduleId) {
        return getMachineIdsByScheduleIds(List.of(scheduleId)).getOrDefault(scheduleId, List.of());
    }

    /**
     * Target machineIds per schedule, resolved by each schedule's selection mode. SPECIFIC schedules
     * are batched over their join rows in one query; CRITERIA schedules are resolved individually
     * against the machines collection (so newly-registered matching devices are included).
     */
    public Map<String, List<String>> getMachineIdsByScheduleIds(Collection<String> scheduleIds) {
        if (scheduleIds == null || scheduleIds.isEmpty()) {
            return Map.of();
        }
        String tenantId = tenantIdProvider.getTenantId();
        List<ScriptSchedule> schedules = scheduleRepository.findByTenantIdAndIdIn(tenantId, scheduleIds);

        List<String> specificIds = schedules.stream()
                .filter(s -> s.getSelectionMode() != ScheduleDeviceSelectionMode.CRITERIA)
                .map(ScriptSchedule::getId)
                .toList();

        Map<String, List<String>> result = new HashMap<>();
        if (!specificIds.isEmpty()) {
            for (ScriptScheduleMachineAssigned row :
                    assignedRepository.findByTenantIdAndScriptScheduleIdIn(tenantId, specificIds)) {
                String sid = row.getScriptScheduleId();
                String mid = row.getMachineId();
                if (sid == null || mid == null) {
                    continue;
                }
                result.computeIfAbsent(sid, k -> new java.util.ArrayList<>()).add(mid);
            }
        }
        schedules.stream()
                .filter(s -> s.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA)
                .forEach(s -> result.put(s.getId(), targetResolver.resolveTargetMachineIds(s)));
        return result;
    }

    /**
     * Target device count per schedule (the DEVICES column), resolved by mode without materialising the
     * device ids: SPECIFIC schedules are counted from their join rows in one batched query; CRITERIA
     * schedules use a count query each (no id list is fetched just to size it).
     */
    public Map<String, Integer> getMachineCountsByScheduleIds(Collection<String> scheduleIds) {
        if (scheduleIds == null || scheduleIds.isEmpty()) {
            return Map.of();
        }
        String tenantId = tenantIdProvider.getTenantId();
        List<ScriptSchedule> schedules = scheduleRepository.findByTenantIdAndIdIn(tenantId, scheduleIds);

        List<String> specificIds = schedules.stream()
                .filter(s -> s.getSelectionMode() != ScheduleDeviceSelectionMode.CRITERIA)
                .map(ScriptSchedule::getId)
                .toList();

        Map<String, Integer> result = new HashMap<>();
        if (!specificIds.isEmpty()) {
            Map<String, Integer> counts = new HashMap<>();
            for (ScriptScheduleMachineAssigned row :
                    assignedRepository.findByTenantIdAndScriptScheduleIdIn(tenantId, specificIds)) {
                if (row.getScriptScheduleId() != null && row.getMachineId() != null) {
                    counts.merge(row.getScriptScheduleId(), 1, Integer::sum);
                }
            }
            specificIds.forEach(id -> result.put(id, counts.getOrDefault(id, 0)));
        }
        schedules.stream()
                .filter(s -> s.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA)
                .forEach(s -> result.put(s.getId(), (int) targetResolver.countCriteriaMachines(s)));
        return result;
    }

    /**
     * Switch a schedule to CRITERIA selection and store its rule (the "Select Devices by Criteria"
     * save). The target set is then resolved dynamically at read/dispatch time; existing SPECIFIC
     * join rows are left untouched and simply ignored while in CRITERIA mode.
     */
    @Transactional
    public void applyCriteria(String scheduleId, ScheduleDeviceCriteria criteria, String actorUserId) {
        String tenantId = tenantIdProvider.getTenantId();
        ScriptSchedule schedule = requireVisibleSchedule(tenantId, scheduleId);
        schedule.setSelectionMode(ScheduleDeviceSelectionMode.CRITERIA);
        schedule.setDeviceCriteria(criteria);
        scheduleRepository.save(schedule);
        log.info("Applied device criteria to script schedule id={} tenantId={} by user={}: {}",
                scheduleId, tenantId, actorUserId, criteria);
    }

    /** Flip a schedule to SPECIFIC selection when devices are managed explicitly (idempotent). */
    private void ensureSpecificMode(ScriptSchedule schedule) {
        if (schedule.getSelectionMode() != ScheduleDeviceSelectionMode.SPECIFIC) {
            schedule.setSelectionMode(ScheduleDeviceSelectionMode.SPECIFIC);
            scheduleRepository.save(schedule);
        }
    }

    /**
     * Guards a device-assignment request. Two checks, in order:
     * <ol>
     *   <li><b>Existence + tenant scope</b> — every requested machineId must resolve to a device in
     *       the current tenant. {@code machineRepository.findByTenantIdAndMachineIdIn} only returns
     *       matching docs, so an unknown or cross-tenant id would otherwise be silently persisted as
     *       a {@link ScriptScheduleMachineAssigned} row; here it is rejected instead.</li>
     *   <li><b>Platform compatibility</b> (only when the schedule declares platforms) — each device's
     *       {@code Machine.osType} (e.g. "windows"/"macos") must match one of the schedule's
     *       {@code supportedPlatforms}, case-insensitively (osType is lowercase, {@link ScriptPlatform}
     *       names are upper). A device with no known osType is allowed (can't determine). Prevents e.g.
     *       assigning a Windows device to a macOS schedule.</li>
     * </ol>
     * No-op when nothing is being assigned.
     */
    private void validateDevices(String tenantId, List<ScriptPlatform> schedulePlatforms, Set<String> machineIds) {
        if (machineIds.isEmpty()) {
            return;
        }
        List<Machine> machines = machineRepository.findByTenantIdAndMachineIdIn(tenantId, machineIds);

        Set<String> resolved = machines.stream()
                .map(Machine::getMachineId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        List<String> unknown = machineIds.stream().filter(id -> !resolved.contains(id)).toList();
        if (!unknown.isEmpty()) {
            throw new BadRequestException(
                    "Unknown or inaccessible device(s) for this tenant: " + unknown);
        }

        if (schedulePlatforms == null || schedulePlatforms.isEmpty()) {
            return;
        }
        Set<ScriptPlatform> allowed = new HashSet<>(schedulePlatforms);

        List<String> incompatible = machines.stream()
                .filter(m -> {
                    String os = m.getOsType();
                    if (os == null || os.isBlank()) {
                        return false;
                    }
                    return MachineOsClassifier.classify(os)
                            .map(platform -> !allowed.contains(platform))
                            .orElse(true);
                })
                .map(m -> m.getHostname() != null ? m.getHostname() : m.getMachineId())
                .toList();

        if (!incompatible.isEmpty()) {
            throw new BadRequestException(
                    "Devices do not match the schedule's platform(s) " + allowed + ": " + incompatible);
        }
    }

    private ScriptSchedule requireVisibleSchedule(String tenantId, String scheduleId) {
        return scheduleRepository.findByTenantIdAndId(tenantId, scheduleId)
                .filter(schedule -> schedule.getStatus() != ScriptStatus.DELETED)
                .orElseThrow(() -> new NotFoundException("Script schedule not found: " + scheduleId));
    }
}
