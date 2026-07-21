package com.openframe.api.service.rmm;

import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Manages the machines assigned to a {@link ScriptSchedule} — backs the
 * "Edit Devices" / "Assigned Devices" UI. Assignments live in the
 * {@code script_schedules_machines_assigned} collection; this service stores
 * <strong>one document per schedule</strong> ({@code scriptScheduleIds = [scheduleId]}),
 * which keeps per-schedule replace/read simple while the document model stays
 * many-to-many.
 *
 * <p>Machine ids are the raw {@code Machine.machineId} (Relay decoding happens in
 * the resolver). Tenant scope is resolved internally via {@link TenantIdProvider}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScriptScheduleDeviceService {

    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScriptScheduleRepository scheduleRepository;
    private final TenantIdProvider tenantIdProvider;

    /**
     * Replace the full set of machines assigned to a schedule (PUT semantics —
     * backs "Edit Devices"). Idempotent; duplicates in the input are collapsed.
     *
     * @throws NotFoundException if the schedule does not exist or is soft-deleted in the tenant.
     */
    public void setDevices(String scheduleId, List<String> machineIds, String actorUserId) {
        String tenantId = tenantIdProvider.getTenantId();
        requireVisibleSchedule(tenantId, scheduleId);   // existence check — throws NotFound if missing / DELETED

        List<String> distinct = machineIds == null ? List.of()
                : new LinkedHashSet<>(machineIds).stream().toList();

        ScriptScheduleMachineAssigned doc = assignedRepository
                .findByTenantIdAndScriptScheduleIdsContaining(tenantId, scheduleId)
                .orElseGet(() -> ScriptScheduleMachineAssigned.builder()
                        .tenantId(tenantId)
                        .scriptScheduleIds(List.of(scheduleId))
                        .createdBy(actorUserId)
                        .build());

        doc.setMachineIds(distinct);
        assignedRepository.save(doc);

        log.info("Set {} device(s) on script schedule id={} tenantId={}", distinct.size(), scheduleId, tenantId);
    }

    /** Raw machineIds assigned to a single schedule (empty if none / schedule missing). */
    public List<String> getMachineIds(String scheduleId) {
        return getMachineIdsByScheduleIds(List.of(scheduleId)).getOrDefault(scheduleId, List.of());
    }

    /**
     * Batch: {@code scheduleId → assigned machineIds} for the given schedules, backing the
     * per-schedule assigned-devices / device-count data loader.
     */
    public Map<String, List<String>> getMachineIdsByScheduleIds(Collection<String> scheduleIds) {
        if (scheduleIds == null || scheduleIds.isEmpty()) {
            return Map.of();
        }
        String tenantId = tenantIdProvider.getTenantId();
        List<ScriptScheduleMachineAssigned> docs =
                assignedRepository.findByTenantIdAndScriptScheduleIdsIn(tenantId, scheduleIds);

        Set<String> requested = new LinkedHashSet<>(scheduleIds);
        Map<String, LinkedHashSet<String>> acc = new HashMap<>();
        for (ScriptScheduleMachineAssigned doc : docs) {
            if (doc.getScriptScheduleIds() == null || doc.getMachineIds() == null) {
                continue;
            }
            for (String sid : doc.getScriptScheduleIds()) {
                if (requested.contains(sid)) {
                    acc.computeIfAbsent(sid, k -> new LinkedHashSet<>()).addAll(doc.getMachineIds());
                }
            }
        }

        Map<String, List<String>> result = new HashMap<>();
        acc.forEach((sid, machines) -> result.put(sid, List.copyOf(machines)));
        return result;
    }

    private ScriptSchedule requireVisibleSchedule(String tenantId, String scheduleId) {
        return scheduleRepository.findByTenantIdAndId(tenantId, scheduleId)
                .filter(schedule -> schedule.getStatus() != ScriptStatus.DELETED)
                .orElseThrow(() -> new NotFoundException("Script schedule not found: " + scheduleId));
    }
}
