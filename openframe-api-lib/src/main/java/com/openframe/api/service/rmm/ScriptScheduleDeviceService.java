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
    private final TenantIdProvider tenantIdProvider;

    @Transactional
    public void setDevices(String scheduleId, List<String> machineIds, String actorUserId) {
        String tenantId = tenantIdProvider.getTenantId();
        requireVisibleSchedule(tenantId, scheduleId);   // existence check — throws NotFound if missing / DELETED

        Set<String> requested = machineIds == null ? Set.of()
                : new LinkedHashSet<>(machineIds);

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

    private ScriptSchedule requireVisibleSchedule(String tenantId, String scheduleId) {
        return scheduleRepository.findByTenantIdAndId(tenantId, scheduleId)
                .filter(schedule -> schedule.getStatus() != ScriptStatus.DELETED)
                .orElseThrow(() -> new NotFoundException("Script schedule not found: " + scheduleId));
    }
}
