package com.openframe.data.service.rmm;

import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.rmm.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
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
 * stored lowercase; {@link ScriptPlatform} names are upper).
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
            return machineRepository.findMachineIds(buildCriteriaQuery(schedule));
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
            String osType = machine.getOsType();
            if (osType == null || platformScope.stream().noneMatch(osType::equalsIgnoreCase)) {
                return false;
            }
        }
        return true;
    }

    /** Tenant-scoped machines query for the schedule's criteria (customer + type + effective OS scope). */
    private Query buildCriteriaQuery(ScriptSchedule schedule) {
        ScheduleDeviceCriteria criteria = schedule.getDeviceCriteria();

        MachineQueryFilter filter = new MachineQueryFilter();
        if (criteria != null) {
            filter.setOrganizationIds(emptyToNull(criteria.getOrganizationIds()));
            filter.setDeviceTypes(deviceTypeNames(criteria.getDeviceTypes()));
        }
        Query query = machineRepository.buildDeviceQuery(filter, null);
        query.addCriteria(Criteria.where("tenantId").is(schedule.getTenantId()));

        List<String> platformScope = platformScope(schedule);
        if (platformScope != null) {
            if (platformScope.isEmpty()) {
                query.addCriteria(Criteria.where("osType").exists(false));   // contradictory OS scope → no match
            } else {
                // Keyed "$or" (not keyless orOperator): buildDeviceQuery already added a keyless "$and",
                // and Query rejects a second null-keyed criteria (InvalidMongoDbApiUsage).
                List<Document> perPlatform = platformScope.stream()
                        .map(name -> Criteria.where("osType").regex("^" + name + "$", "i").getCriteriaObject())
                        .toList();
                query.addCriteria(Criteria.where("$or").is(perPlatform));
            }
        }
        return query;
    }

    private List<String> platformScope(ScriptSchedule schedule) {
        ScheduleDeviceCriteria criteria = schedule.getDeviceCriteria();
        List<String> osTypes = criteria == null ? null : criteria.getOsTypes();
        List<String> supported = schedule.getSupportedPlatforms() == null ? List.of()
                : schedule.getSupportedPlatforms().stream().map(Enum::name).toList();

        boolean hasOs = isNotEmpty(osTypes);
        if (!hasOs && supported.isEmpty()) {
            return null;                                    // unconstrained
        }
        if (!hasOs) {
            return supported;                               // schedule platforms only
        }
        if (supported.isEmpty()) {
            return osTypes;                                 // criteria OS only
        }
        Set<String> supportedUpper = supported.stream().map(String::toUpperCase).collect(Collectors.toSet());
        return osTypes.stream()
                .filter(os -> supportedUpper.contains(os.toUpperCase()))
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
}
