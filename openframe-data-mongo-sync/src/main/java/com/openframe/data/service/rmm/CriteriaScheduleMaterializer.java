package com.openframe.data.service.rmm;

import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.rmm.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Persists CRITERIA-schedule membership as {@link ScriptScheduleMachineAssigned} join rows, so the
 * whole engine (dispatch, DEVICE_ONLINE trigger, assignedDevices list, deviceCount) can read the
 * same join rows for every schedule regardless of mode — no per-fire criteria query. Membership is
 * (re)materialised at two points:
 *
 * <ul>
 *   <li>{@link #materialize} — when a schedule's criteria are saved: reconcile its rows to exactly
 *       the devices the rule currently matches.</li>
 *   <li>{@link #materializeForDevice} — when a device (re)registers: add it to every ACTIVE CRITERIA
 *       schedule whose rule it matches.</li>
 * </ul>
 *
 * <p>Criteria OS is intersected with the schedule's {@code supportedPlatforms}; osType matching is
 * case-insensitive (osType is stored lowercase, platform names are upper).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CriteriaScheduleMaterializer {

    private final MachineRepository machineRepository;
    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScriptScheduleRepository scheduleRepository;

    /**
     * Reconcile a CRITERIA schedule's join rows to exactly the devices its rule matches (adds new
     * matches, removes rows that no longer match). No-op for a SPECIFIC schedule.
     */
    @Transactional
    public void materialize(ScriptSchedule schedule, String actorUserId) {
        if (schedule.getSelectionMode() != ScheduleDeviceSelectionMode.CRITERIA) {
            return;
        }
        String tenantId = schedule.getTenantId();
        String scheduleId = schedule.getId();

        Set<String> desired = new LinkedHashSet<>(resolveCriteriaMachineIds(schedule));
        Set<String> current = assignedRepository.findByTenantIdAndScriptScheduleId(tenantId, scheduleId).stream()
                .map(ScriptScheduleMachineAssigned::getMachineId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(HashSet::new));

        Set<String> toRemove = new HashSet<>(current);
        toRemove.removeAll(desired);
        Set<String> toAdd = new LinkedHashSet<>(desired);
        toAdd.removeAll(current);

        if (!toRemove.isEmpty()) {
            assignedRepository.deleteByTenantIdAndScriptScheduleIdAndMachineIdIn(tenantId, scheduleId, toRemove);
        }
        if (!toAdd.isEmpty()) {
            assignedRepository.saveAll(toAdd.stream()
                    .map(mid -> row(tenantId, scheduleId, mid, actorUserId))
                    .toList());
        }
        log.info("Materialised CRITERIA schedule id={} tenantId={}: {} target(s) (+{} -{})",
                scheduleId, tenantId, desired.size(), toAdd.size(), toRemove.size());
    }

    /**
     * Assign a (re)registered device to every ACTIVE CRITERIA schedule whose rule it matches.
     * Idempotent — a device already assigned to a schedule is skipped.
     */
    @Transactional
    public void materializeForDevice(Machine machine) {
        if (machine == null || machine.getTenantId() == null || machine.getMachineId() == null) {
            return;
        }
        String tenantId = machine.getTenantId();
        String machineId = machine.getMachineId();

        List<ScriptSchedule> criteriaSchedules = scheduleRepository.findByTenantIdAndSelectionModeAndStatus(
                tenantId, ScheduleDeviceSelectionMode.CRITERIA, ScriptStatus.ACTIVE);

        int added = 0;
        for (ScriptSchedule schedule : criteriaSchedules) {
            if (!matchesCriteria(schedule, machine)) {
                continue;
            }
            if (assignedRepository.existsByTenantIdAndScriptScheduleIdAndMachineId(tenantId, schedule.getId(), machineId)) {
                continue;
            }
            assignedRepository.save(row(tenantId, schedule.getId(), machineId, schedule.getCreatedBy()));
            added++;
        }
        if (added > 0) {
            log.info("Materialised device machineId={} tenantId={} into {} CRITERIA schedule(s)",
                    machineId, tenantId, added);
        }
    }

    /**
     * Does {@code machine} match this schedule's CRITERIA rule? Always {@code false} for a SPECIFIC
     * schedule. Used to decide whether a (re)registering device joins a criteria schedule.
     */
    public boolean matchesCriteria(ScriptSchedule schedule, Machine machine) {
        if (schedule.getSelectionMode() != ScheduleDeviceSelectionMode.CRITERIA || machine == null) {
            return false;
        }
        ScheduleDeviceCriteria criteria = schedule.getDeviceCriteria();
        List<String> organizationIds = criteria == null ? null : criteria.getOrganizationIds();
        List<DeviceType> deviceTypes = criteria == null ? null : criteria.getDeviceTypes();

        if (isNotEmpty(organizationIds) && !organizationIds.contains(machine.getOrganizationId())) {
            return false;
        }
        if (isNotEmpty(deviceTypes) && (machine.getType() == null || !deviceTypes.contains(machine.getType()))) {
            return false;
        }
        List<String> platformScope = platformScope(schedule);
        if (platformScope != null) {
            String osType = machine.getOsType();
            if (osType == null || platformScope.stream().noneMatch(osType::equalsIgnoreCase)) {
                return false;
            }
        }
        return true;
    }

    /** The machineIds a CRITERIA schedule currently matches (empty for a contradictory OS scope). */
    private List<String> resolveCriteriaMachineIds(ScriptSchedule schedule) {
        List<String> platformScope = platformScope(schedule);
        if (platformScope != null && platformScope.isEmpty()) {
            return List.of();
        }
        return machineRepository.findMachineIdsByCriteria(
                schedule.getTenantId(), buildCriteriaFilter(schedule.getDeviceCriteria()), platformScope);
    }

    private static MachineQueryFilter buildCriteriaFilter(ScheduleDeviceCriteria criteria) {
        MachineQueryFilter filter = new MachineQueryFilter();
        if (criteria != null) {
            filter.setOrganizationIds(emptyToNull(criteria.getOrganizationIds()));
            filter.setDeviceTypes(deviceTypeNames(criteria.getDeviceTypes()));
        }
        return filter;
    }

    /**
     * Effective OS names a target must match — criteria {@code osTypes} intersected with the
     * schedule's {@code supportedPlatforms}: {@code null} = unconstrained, empty = contradictory
     * (matches nothing), non-empty = one of these.
     */
    private List<String> platformScope(ScriptSchedule schedule) {
        ScheduleDeviceCriteria criteria = schedule.getDeviceCriteria();
        List<String> osTypes = criteria == null ? null : criteria.getOsTypes();
        List<String> supported = schedule.getSupportedPlatforms() == null ? List.of()
                : schedule.getSupportedPlatforms().stream().map(Enum::name).toList();

        boolean hasOs = isNotEmpty(osTypes);
        if (!hasOs && supported.isEmpty()) {
            return null;
        }
        if (!hasOs) {
            return supported;
        }
        if (supported.isEmpty()) {
            return osTypes;
        }
        Set<String> supportedUpper = supported.stream().map(String::toUpperCase).collect(Collectors.toSet());
        return osTypes.stream().filter(os -> supportedUpper.contains(os.toUpperCase())).toList();
    }

    private static ScriptScheduleMachineAssigned row(String tenantId, String scheduleId, String machineId, String actorUserId) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(tenantId)
                .scriptScheduleId(scheduleId)
                .machineId(machineId)
                .createdBy(actorUserId)
                .build();
    }

    private static List<String> deviceTypeNames(List<DeviceType> types) {
        return isNotEmpty(types) ? types.stream().map(Enum::name).toList() : null;
    }

    private static <T> List<T> emptyToNull(List<T> list) {
        return isNotEmpty(list) ? list : null;
    }

    private static boolean isNotEmpty(List<?> list) {
        return list != null && !list.isEmpty();
    }
}
