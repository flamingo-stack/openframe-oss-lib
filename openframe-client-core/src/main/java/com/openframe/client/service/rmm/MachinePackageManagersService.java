package com.openframe.client.service.rmm;

import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;

import static com.openframe.data.service.machine.MachineFields.PACKAGE_MANAGERS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class MachinePackageManagersService {

    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;
    private final PackageManagerProperties packageManagerProperties;
    private final PackageManagerBootstrapService bootstrapService;

    public void apply(String machineId, Map<String, PackageManagerState> reported) {
        Optional<Machine> foundMachine = machineRepository.findByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.warn("Package-managers report for unknown machine {}, ignoring", machineId);
            return;
        }
        Machine machine = foundMachine.get();
        if (isGone(machine)) {
            log.debug("Ignoring package-managers report for machineId={} in status {}", machineId, machine.getStatus());
            return;
        }

        Map<PackageManagerType, PackageManagerState> states = toStates(machineId, reported);
        if (!states.equals(machine.getPackageManagers())) {
            machineWriter.update(machineId, machineUpdate().set(PACKAGE_MANAGERS, states));
            log.info("Updated package managers for machineId={}: {}", machineId, states);
        }
        states.forEach((manager, state) -> bootstrapIfMissing(machineId, manager, state));
    }

    private void bootstrapIfMissing(String machineId, PackageManagerType manager, PackageManagerState state) {
        if (state == PackageManagerState.MISSING && !packageManagerProperties.isDisabled(manager)) {
            bootstrapService.dispatchInstall(machineId, manager);
        }
    }

    private static boolean isGone(Machine machine) {
        DeviceStatus status = machine.getStatus();
        return status == DeviceStatus.PENDING_DELETION || status == DeviceStatus.DELETED;
    }

    private static Map<PackageManagerType, PackageManagerState> toStates(String machineId,
                                                                          Map<String, PackageManagerState> reported) {
        Map<PackageManagerType, PackageManagerState> states = new EnumMap<>(PackageManagerType.class);
        reported.forEach((name, state) -> record(states, machineId, name, state));
        return states;
    }

    private static void record(Map<PackageManagerType, PackageManagerState> states, String machineId,
                               String name, PackageManagerState state) {
        Optional<PackageManagerType> manager = managerNamed(name);
        if (state == null || manager.isEmpty()) {
            log.warn("Skipping package-managers entry {}={} from machineId={}", name, state, machineId);
            return;
        }
        manager.ifPresent(known -> states.put(known, state));
    }

    private static Optional<PackageManagerType> managerNamed(String name) {
        return Arrays.stream(PackageManagerType.values())
                .filter(manager -> manager.name().equals(name))
                .findFirst();
    }
}
