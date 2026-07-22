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

/**
 * Manages the machines assigned to a {@link ScriptSchedule} — backs the
 * "Edit Devices" / "Assigned Devices" UI. Assignments live in the
 * {@code script_schedules_machines_assigned} collection as
 * <strong>one document per schedule</strong> ({@code scriptScheduleId = scheduleId}),
 * a shape enforced by the collection's unique {@code (tenantId, scriptScheduleId)}
 * index, which keeps per-schedule replace/read a single-document operation.
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
                .findByTenantIdAndScriptScheduleId(tenantId, scheduleId)
                .orElseGet(() -> ScriptScheduleMachineAssigned.builder()
                        .tenantId(tenantId)
                        .scriptScheduleId(scheduleId)
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
                assignedRepository.findByTenantIdAndScriptScheduleIdIn(tenantId, scheduleIds);

        // One document per schedule (unique index), so a plain map suffices.
        Map<String, List<String>> result = new HashMap<>();
        for (ScriptScheduleMachineAssigned doc : docs) {
            String sid = doc.getScriptScheduleId();
            if (sid == null || doc.getMachineIds() == null) {
                continue;
            }
            result.put(sid, List.copyOf(doc.getMachineIds()));
        }
        return result;
    }

    private ScriptSchedule requireVisibleSchedule(String tenantId, String scheduleId) {
        return scheduleRepository.findByTenantIdAndId(tenantId, scheduleId)
                .filter(schedule -> schedule.getStatus() != ScriptStatus.DELETED)
                .orElseThrow(() -> new NotFoundException("Script schedule not found: " + scheduleId));
    }
}
