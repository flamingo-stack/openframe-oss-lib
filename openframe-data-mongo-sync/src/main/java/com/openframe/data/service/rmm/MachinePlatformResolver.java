package com.openframe.data.service.rmm;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class MachinePlatformResolver {

    private final MachineRepository machineRepository;
    private final TenantIdProvider tenantIdProvider;
    private final PackageManagerAvailability packageManagerAvailability;

    // Software-only resolver: a machine whose agent reported no usable package manager is dropped here,
    // so every caller treats it as OS-incompatible and never dispatches to it.
    public Map<String, OsType> osTypesByMachineId(Collection<String> machineIds) {
        if (machineIds == null || machineIds.isEmpty()) {
            return Map.of();
        }
        return machineRepository
                .findByTenantIdAndMachineIdIn(tenantIdProvider.getTenantId(), new HashSet<>(machineIds)).stream()
                .filter(m -> m.getOsType() != null)
                .filter(packageManagerAvailability::isSoftwareManageable)
                .collect(Collectors.toMap(Machine::getMachineId, Machine::getOsType, (a, b) -> a));
    }

    public List<String> compatible(List<String> machineIds, Map<String, OsType> osTypes,
                                   Collection<OsType> supportedPlatforms) {
        if (supportedPlatforms == null || supportedPlatforms.isEmpty()) {
            return List.of();
        }
        Set<OsType> platforms = new HashSet<>(supportedPlatforms);
        return machineIds.stream()
                .filter(id -> platforms.contains(osTypes.get(id)))
                .collect(Collectors.toList());
    }
}
