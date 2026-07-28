package com.openframe.api.service.rmm;

import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
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
    private final TenantIdProvider tenantIdProvider;

    @Transactional
    public void setDevices(String scheduleId, List<String> machineIds, String actorUserId) {
        String tenantId = tenantIdProvider.getTenantId();
        ScriptSchedule schedule = requireVisibleSchedule(tenantId, scheduleId);   // throws NotFound if missing / DELETED

        Set<String> requested = machineIds == null ? Set.of()
                : new LinkedHashSet<>(machineIds);

        validateDevicePlatforms(schedule.getSupportedPlatforms(), requested);

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
        validateDevicePlatforms(schedule.getSupportedPlatforms(), requested);

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

    /** Raw machineIds assigned to a single schedule (empty if none / schedule missing). */
    public List<String> getMachineIds(String scheduleId) {
        return getMachineIdsByScheduleIds(List.of(scheduleId)).getOrDefault(scheduleId, List.of());
    }

    public Map<String, List<String>> getMachineIdsByScheduleIds(Collection<String> scheduleIds) {
        if (scheduleIds == null || scheduleIds.isEmpty()) {
            return Map.of();
        }
        String tenantId = tenantIdProvider.getTenantId();
        List<ScriptScheduleMachineAssigned> rows =
                assignedRepository.findByTenantIdAndScriptScheduleIdIn(tenantId, scheduleIds);

        Map<String, List<String>> result = new HashMap<>();
        for (ScriptScheduleMachineAssigned row : rows) {
            String sid = row.getScriptScheduleId();
            String mid = row.getMachineId();
            if (sid == null || mid == null) {
                continue;
            }
            result.computeIfAbsent(sid, k -> new java.util.ArrayList<>()).add(mid);
        }
        return result;
    }

    /**
     * Every assigned device must run one of the schedule's platforms: {@code Machine.osType}
     * (e.g. "windows"/"macos") must match one of the schedule's {@code supportedPlatforms}
     * (case-insensitive — osType is lowercase, {@link ScriptPlatform} names are upper). A device
     * with no known osType is allowed (can't determine). No-op when the schedule declares no
     * platforms or nothing is being assigned. Prevents e.g. assigning a Windows device to a
     * macOS schedule.
     */
    private void validateDevicePlatforms(List<ScriptPlatform> schedulePlatforms, Set<String> machineIds) {
        if (schedulePlatforms == null || schedulePlatforms.isEmpty() || machineIds.isEmpty()) {
            return;
        }
        Set<String> allowed = schedulePlatforms.stream()
                .map(p -> p.name().toUpperCase())
                .collect(java.util.stream.Collectors.toSet());

        List<String> incompatible = machineRepository.findByMachineIdIn(machineIds).stream()
                .filter(m -> {
                    String os = m.getOsType();
                    return os != null && !os.isBlank() && !allowed.contains(os.trim().toUpperCase());
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
