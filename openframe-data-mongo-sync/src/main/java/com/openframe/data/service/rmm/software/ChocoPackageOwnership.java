package com.openframe.data.service.rmm.software;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.chocolatey.MachineChocolatey;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BooleanSupplier;

import static java.util.stream.Collectors.toSet;
import static org.springframework.util.CollectionUtils.isEmpty;

@Component
@RequiredArgsConstructor
public class ChocoPackageOwnership {

    private final MachineRepository machineRepository;
    private final TenantIdProvider tenantIdProvider;
    private final SoftwareSettingsService softwareSettingsService;

    public boolean owns(Machine machine, String packageId) {
        return owns(machine, packageId, softwareSettingsService::updatesExistingChocolateyPackages);
    }

    public List<String> owners(Collection<String> machineIds, String packageId) {
        if (isEmpty(machineIds)) {
            return List.of();
        }
        String tenantId = tenantIdProvider.getTenantId();
        boolean updatesExisting = softwareSettingsService.updatesExistingChocolateyPackages();
        List<Machine> machines = machineRepository.findByTenantIdAndMachineIdIn(tenantId, new HashSet<>(machineIds));
        Set<String> owners = machines.stream()
                .filter(machine -> owns(machine, packageId, () -> updatesExisting))
                .map(Machine::getMachineId)
                .collect(toSet());
        return machineIds.stream().filter(owners::contains).toList();
    }

    private static boolean owns(Machine machine, String packageId, BooleanSupplier updatesExisting) {
        if (!PackageManagerAvailability.hasManagedChocolatey(machine)) {
            return false;
        }
        MachineChocolatey chocolatey = machine.getChocolatey();
        return lists(chocolatey.getPackages(), packageId)
                || (lists(chocolatey.getExistingPackages(), packageId) && updatesExisting.getAsBoolean());
    }

    private static boolean lists(List<String> packageIds, String packageId) {
        return packageIds != null && packageId != null && packageIds.stream().anyMatch(packageId::equalsIgnoreCase);
    }
}
