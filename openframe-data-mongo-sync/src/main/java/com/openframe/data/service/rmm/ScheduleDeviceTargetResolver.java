package com.openframe.data.service.rmm;

import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.rmm.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.OsType;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Single source of truth for "which machines does this schedule target right now". Shared by the
 * dispatch engine and the DEVICE_ONLINE trigger (client-service) and the read side (api). Two modes:
 *
 * <ul>
 *   <li>{@code SPECIFIC} (or legacy/null) — reads the {@link ScriptScheduleMachineAssigned} join rows.</li>
 *   <li>{@code CRITERIA} — resolves {@link ScheduleDeviceCriteria} against the machines collection at
 *       call time, so devices registered after the schedule was saved are included automatically.
 *       No join rows are consulted.</li>
 * </ul>
 *
 * <p>Criteria OS is always intersected with the schedule's {@code supportedPlatforms}, so a criteria
 * target is guaranteed platform-compatible. Matching on {@code osType} is case-insensitive (osType is
 * stored lowercase; {@link OsType} names are upper).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduleDeviceTargetResolver {

    private final MachineRepository machineRepository;
    private final ScriptScheduleMachineAssignedRepository assignedRepository;

    /** The schedule's current target machineIds (deduped), resolved per its selection mode. */
    public List<String> resolveTargetMachineIds(ScriptSchedule schedule) {
        if (schedule.getSelectionMode() == ScheduleDeviceSelectionMode.CRITERIA) {
            return resolveCriteriaMachineIds(schedule);
        }
        return assignedRepository
                .findByTenantIdAndScriptScheduleId(schedule.getTenantId(), schedule.getId()).stream()
                .map(ScriptScheduleMachineAssigned::getMachineId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    /**
     * Does {@code machine} match this schedule's CRITERIA rule? Always {@code false} for a
     * SPECIFIC schedule (those target an explicit set, matched via join rows instead). Used by the
     * DEVICE_ONLINE trigger to fire criteria schedules on a device that just came online.
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
        if (platformScope != null) {                       // an OS constraint applies
            OsType osType = machine.getOsType();
            // Direct enum match — no more raw-string classification, osType is typed now.
            if (osType == null || platformScope.stream().noneMatch(osType.name()::equalsIgnoreCase)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Resolve CRITERIA targets. The business decisions live here — building the {@link MachineQueryFilter}
     * and computing the effective OS scope (criteria ∩ supportedPlatforms); the actual Mongo query lives
     * in {@link MachineRepository#findMachineIdsByCriteria}. A contradictory OS scope (criteria OS disjoint
     * from the schedule's platforms) matches nothing, short-circuited without a query.
     */
    private List<String> resolveCriteriaMachineIds(ScriptSchedule schedule) {
        List<String> platformScope = platformScope(schedule);
        if (platformScope != null && platformScope.isEmpty()) {
            return List.of();   // contradictory OS scope → no device can match
        }
        return machineRepository.findMachineIdsByCriteria(
                schedule.getTenantId(), buildCriteriaFilter(schedule.getDeviceCriteria()), platformScope);
    }

    public long countCriteriaMachines(ScriptSchedule schedule) {
        List<String> platformScope = platformScope(schedule);
        if (platformScope != null && platformScope.isEmpty()) {
            return 0L;
        }
        return machineRepository.countMachinesByCriteria(
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

    private List<String> platformScope(ScriptSchedule schedule) {
        ScheduleDeviceCriteria criteria = schedule.getDeviceCriteria();
        List<String> osTypes = criteria == null ? null : criteria.getOsTypes();
        Set<OsType> supported = schedule.getSupportedPlatforms() == null
                ? Set.of()
                : schedule.getSupportedPlatforms().stream().collect(Collectors.toUnmodifiableSet());

        boolean hasOs = isNotEmpty(osTypes);
        if (!hasOs && supported.isEmpty()) {
            return null;                                    // unconstrained
        }
        if (!hasOs) {
            return supported.stream().map(Enum::name).toList();     // schedule platforms only
        }
        List<OsType> criteriaPlatforms = osTypes.stream()
                .map(ScheduleDeviceTargetResolver::parseOsTypeSafely)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (supported.isEmpty()) {
            return criteriaPlatforms.stream().map(Enum::name).toList();   // criteria OS only
        }
        return criteriaPlatforms.stream()
                .filter(supported::contains)
                .map(Enum::name)
                .toList();                                  // possibly empty → contradictory
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

    private static OsType parseOsTypeSafely(String value) {
        try {
            return OsType.valueOf(value);
        } catch (IllegalArgumentException | NullPointerException e) {
            return null;
        }
    }
}
