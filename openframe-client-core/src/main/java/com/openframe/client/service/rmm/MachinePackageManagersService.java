package com.openframe.client.service.rmm;

import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerDependency;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.bootstrap.SystemScriptCode;
import com.openframe.data.nats.rmm.model.MachinePackageManagersMessage;
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
@ConditionalOnProperty(name = "openframe.rmm.package-manager-bootstrap.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class MachinePackageManagersService {

    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;
    private final PackageManagerProperties packageManagerProperties;
    private final PackageManagerBootstrapService bootstrapService;

    public void apply(String machineId, MachinePackageManagersMessage report) {
        Optional<Machine> foundMachine = machineRepository.findByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.warn("Package-managers report for unknown machine {}, ignoring", machineId);
            return;
        }
        Machine machine = foundMachine.get();
        if (isDeletionInProgress(machine)) {
            log.debug("Ignoring package-managers report for machineId={} in status {}", machineId, machine.getStatus());
            return;
        }

        Map<PackageManagerType, PackageManagerState> states = toStates(machineId, report.getPackageManagers());
        if (!states.equals(machine.getPackageManagers())) {
            machineWriter.update(machineId, machineUpdate().set(PACKAGE_MANAGERS, states));
            log.info("Updated package managers for machineId={}: {}", machineId, states);
        }
        states.forEach((manager, state) -> bootstrapIfMissing(machineId, manager, state));
        report.getDependencies().forEach(dependency -> bootstrapIfMissing(machineId, dependency));
    }

    private void bootstrapIfMissing(String machineId, PackageManagerType manager, PackageManagerState state) {
        if (state == PackageManagerState.MISSING && !packageManagerProperties.isDisabled(manager)) {
            bootstrapService.dispatchInstall(machineId, manager);
        }
    }

    private void bootstrapIfMissing(String machineId, MachinePackageManagersMessage.Dependency reported) {
        String name = reported.getName();
        Optional<PackageManagerDependency> found = dependencyNamed(name);
        if (found.isEmpty()) {
            log.warn("Skipping unknown package-manager dependency {} from machineId={}", name, machineId);
            return;
        }
        PackageManagerDependency dependency = found.get();
        PackageManagerType manager = dependency.getManager();
        if (reported.getState() == PackageManagerState.MISSING && !packageManagerProperties.isDisabled(manager)) {
            SystemScriptCode bootstrapScript = dependency.getBootstrapScript();
            bootstrapService.dispatchInstall(machineId, manager, bootstrapScript);
        }
    }

    private static boolean isDeletionInProgress(Machine machine) {
        return DeviceStatus.DELETING_OR_DELETED.contains(machine.getStatus());
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

    private static Optional<PackageManagerDependency> dependencyNamed(String name) {
        return Arrays.stream(PackageManagerDependency.values())
                .filter(dependency -> dependency.name().equals(name))
                .findFirst();
    }
}
