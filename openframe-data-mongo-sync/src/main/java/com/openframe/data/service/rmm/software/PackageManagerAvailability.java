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
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static org.springframework.util.CollectionUtils.isEmpty;

@Component
@RequiredArgsConstructor
public class PackageManagerAvailability {

    private static final Set<PackageManagerState> NOT_YET_USABLE =
            EnumSet.of(PackageManagerState.MISSING, PackageManagerState.UNKNOWN);

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

    public void requireSoftwareManageable(Collection<String> machineIds, Collection<PackageManagerType> packageManagers) {
        List<Machine> machines = machines(machineIds);
        List<String> unmanageable = machines.stream()
                .filter(machine -> !isSoftwareManageable(machine))
                .map(Machine::getMachineId)
                .toList();
        if (!unmanageable.isEmpty()) {
            throw new BadRequestException("These devices have no supported package manager: " + unmanageable
                    + ". Remove the devices.");
        }
        List<String> notYetUsable = machines.stream()
                .flatMap(machine -> notYetUsable(machine, packageManagers))
                .toList();
        if (!notYetUsable.isEmpty()) {
            throw new BadRequestException("Package manager not yet usable on these devices: " + notYetUsable
                    + ". Wait for the bootstrap to finish or remove the devices.");
        }
    }

    private static Stream<String> notYetUsable(Machine machine, Collection<PackageManagerType> packageManagers) {
        Map<PackageManagerType, PackageManagerState> reported = machine.getPackageManagers();
        if (reported == null) {
            return Stream.empty();
        }
        return packageManagers.stream()
                .filter(manager -> NOT_YET_USABLE.contains(reported.get(manager)))
                .map(manager -> machine.getMachineId() + " " + manager + "=" + reported.get(manager));
    }

    private List<Machine> machines(Collection<String> machineIds) {
        if (isEmpty(machineIds)) {
            return List.of();
        }
        String tenantId = tenantIdProvider.getTenantId();
        return machineRepository.findByTenantIdAndMachineIdIn(tenantId, new HashSet<>(machineIds));
    }

    private boolean isEnabled(PackageManagerType manager) {
        return !packageManagerProperties.isDisabled(manager);
    }
}
