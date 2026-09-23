package com.openframe.data.service.rmm;

import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceCriteria;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ScheduleCriteriaDeviceResolver {

    private final MachineRepository machineRepository;

    public List<String> resolveMachineIds(String tenantId, ScheduleDeviceCriteria criteria, Collection<OsType> supportedPlatforms) {
        List<OsType> scope = platformScope(criteria, supportedPlatforms);
        if (scope != null && scope.isEmpty()) {
            return List.of();
        }
        return machineRepository.findMachineIdsByCriteria(tenantId, buildFilter(criteria), scope);
    }

    public long count(String tenantId, ScheduleDeviceCriteria criteria, Collection<OsType> supportedPlatforms) {
        List<OsType> scope = platformScope(criteria, supportedPlatforms);
        if (scope != null && scope.isEmpty()) {
            return 0L;
        }
        return machineRepository.countMachinesByCriteria(tenantId, buildFilter(criteria), scope);
    }

    public boolean matches(Machine machine, ScheduleDeviceCriteria criteria, Collection<OsType> supportedPlatforms) {
        if (machine == null) {
            return false;
        }
        List<String> organizationIds = criteria == null ? null : criteria.getOrganizationIds();
        List<DeviceType> deviceTypes = criteria == null ? null : criteria.getDeviceTypes();

        if (isNotEmpty(organizationIds) && !organizationIds.contains(machine.getOrganizationId())) {
            return false;
        }
        if (isNotEmpty(deviceTypes) && (machine.getType() == null || !deviceTypes.contains(machine.getType()))) {
            return false;
        }
        List<OsType> scope = platformScope(criteria, supportedPlatforms);
        if (scope != null) {
            OsType osType = machine.getOsType();
            if (osType == null || scope.stream().noneMatch(ps -> ps.equals(osType))) {
                return false;
            }
        }
        return true;
    }

    private static MachineQueryFilter buildFilter(ScheduleDeviceCriteria criteria) {
        MachineQueryFilter filter = new MachineQueryFilter();
        if (criteria != null) {
            filter.setOrganizationIds(emptyToNull(criteria.getOrganizationIds()));
            filter.setDeviceTypes(deviceTypeNames(criteria.getDeviceTypes()));
        }
        return filter;
    }

    private static List<OsType> platformScope(ScheduleDeviceCriteria criteria, Collection<OsType> supportedPlatforms) {
        List<OsType> osTypes = criteria == null ? null : criteria.getOsTypes();
        Set<OsType> supported = supportedPlatforms == null ? Set.of()
                : supportedPlatforms.stream().filter(Objects::nonNull).collect(Collectors.toUnmodifiableSet());

        boolean hasOs = isNotEmpty(osTypes);
        if (!hasOs && supported.isEmpty()) {
            return null;
        }
        if (!hasOs) {
            return supported.stream().toList();
        }
        List<OsType> criteriaPlatforms = osTypes.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (supported.isEmpty()) {
            return criteriaPlatforms;
        }
        return criteriaPlatforms.stream()
                .filter(supported::contains)
                .toList();
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
