package com.openframe.data.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static java.util.stream.Collectors.toSet;
import static org.springframework.util.CollectionUtils.isEmpty;

@Slf4j
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
        if (isEmpty(reported)) {
            return true;
        }
        return enabledManagers().stream()
                .map(reported::get)
                .anyMatch(PackageManagerState.MANAGEABLE::contains);
    }

    // a manager updates a program only on a device where it runs; a device that never reported its managers counts as
    // having it, as everywhere else in Software Management
    public static boolean isPresentOn(Machine machine, PackageManagerType manager) {
        Map<PackageManagerType, PackageManagerState> reported = machine.getPackageManagers();
        return reported == null || reported.get(manager) == PackageManagerState.PRESENT;
    }

    // a program can be adopted into a manager the device has or can still get
    public boolean isAdoptableOn(Machine machine, PackageManagerType manager) {
        if (!isEnabled(manager)) {
            return false;
        }
        Map<PackageManagerType, PackageManagerState> reported = machine.getPackageManagers();
        return isEmpty(reported) || PackageManagerState.MANAGEABLE.contains(reported.get(manager));
    }

    // an order of a manager the device cannot run would only fail there; MISSING and UNKNOWN change over time
    public static boolean isSupportedOn(Machine machine, PackageManagerType manager) {
        Map<PackageManagerType, PackageManagerState> reported = machine.getPackageManagers();
        return reported == null || reported.get(manager) != PackageManagerState.UNSUPPORTED;
    }

    // in the order of machineIds; a machine that is not found is left out
    public List<String> supporting(Collection<String> machineIds, PackageManagerType manager) {
        Set<String> supporting = machines(machineIds).stream()
                .filter(machine -> isSupportedOn(machine, manager))
                .map(Machine::getMachineId)
                .collect(toSet());
        return machineIds.stream().filter(supporting::contains).toList();
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
        List<String> unsupporting = machines.stream()
                .filter(machine -> supportsNone(machine, packageManagers))
                .map(Machine::getMachineId)
                .toList();
        if (!unsupporting.isEmpty()) {
            throw new BadRequestException("These devices support none of the requested package managers: " + unsupporting
                    + ". Remove the devices.");
        }
        List<String> notYetUsable = machines.stream()
                .flatMap(machine -> notYetUsable(machine, packageManagers))
                .toList();
        // A MISSING or UNKNOWN state changes over time (user logs in, bootstrap finishes),
        // so one such device must not block the whole request.
        if (!notYetUsable.isEmpty()) {
            log.info("Package manager not yet usable on these devices, accepting anyway: {}", notYetUsable);
        }
    }

    private static boolean supportsNone(Machine machine, Collection<PackageManagerType> packageManagers) {
        return !isEmpty(packageManagers)
                && packageManagers.stream().noneMatch(manager -> isSupportedOn(machine, manager));
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

    public boolean isEnabled(PackageManagerType manager) {
        return !packageManagerProperties.isDisabled(manager);
    }
}
