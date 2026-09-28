package com.openframe.data.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import static org.springframework.util.CollectionUtils.isEmpty;

@Component
@RequiredArgsConstructor
public class PackageManagerAvailability {

    private final PackageManagerProperties packageManagerProperties;
    private final MachineRepository machineRepository;
    private final TenantIdProvider tenantIdProvider;

    public List<PackageManagerType> enabledManagers() {
        return Arrays.stream(PackageManagerType.values())
                .filter(this::isEnabled)
                .toList();
    }

    public boolean isSoftwareManageable(Machine machine) {
        Map<PackageManagerType, PackageManagerState> reported = machine.getPackageManagers();
        if (reported == null) {
            return true;
        }
        return enabledManagers().stream()
                .map(reported::get)
                .anyMatch(PackageManagerState.MANAGEABLE::contains);
    }

    public void requireSoftwareManageable(Collection<String> machineIds) {
        List<String> unmanageable = unmanageableMachineIds(machineIds);
        if (!unmanageable.isEmpty()) {
            throw new BadRequestException("These devices have no supported package manager: " + unmanageable
                    + ". Remove the devices.");
        }
    }

    public List<String> unmanageableMachineIds(Collection<String> machineIds) {
        if (isEmpty(machineIds)) {
            return List.of();
        }
        String tenantId = tenantIdProvider.getTenantId();
        List<Machine> machines = machineRepository.findByTenantIdAndMachineIdIn(tenantId, new HashSet<>(machineIds));
        return machines.stream()
                .filter(machine -> !isSoftwareManageable(machine))
                .map(Machine::getMachineId)
                .toList();
    }

    private boolean isEnabled(PackageManagerType manager) {
        return !packageManagerProperties.isDisabled(manager);
    }
}
