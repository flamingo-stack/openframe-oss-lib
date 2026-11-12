package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Set;

import static java.util.stream.Collectors.toSet;

// which devices take an update as a package-update order and which run the update script: the ones a delivery route
// reaches for PACKAGE_UPDATE, so the type's switch and its agent-version floor decide, by the version the client
// reports after every update it applies
@Service
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateEligibilityService {

    private final DeliveryRouter deliveryRouter;
    private final MachineRepository machineRepository;

    public Set<String> eligibleMachines(SoftwareAction action, Collection<String> machineIds) {
        if (!ordersUpdate(action) || machineIds.isEmpty()) {
            return Set.of();
        }
        return deliveryRouter.reachable(DeliveryType.PACKAGE_UPDATE, machineIds);
    }

    public Set<String> eligibleConnectedMachines(SoftwareAction action, Collection<String> machineIds) {
        Set<String> reachable = eligibleMachines(action, machineIds);
        if (reachable.isEmpty()) {
            return reachable;
        }
        return machineRepository.findByMachineIdIn(reachable).stream()
                .filter(machine -> DeviceStatus.CONNECTED.contains(machine.getStatus()))
                .map(Machine::getMachineId)
                .collect(toSet());
    }

    public boolean isEligible(SoftwareAction action, Machine machine) {
        return ordersUpdate(action) && deliveryRouter.reaches(DeliveryType.PACKAGE_UPDATE, machine.getMachineId());
    }

    // the order only upgrades what is installed: an install always runs the script
    private static boolean ordersUpdate(SoftwareAction action) {
        return action == SoftwareAction.UPDATE;
    }
}
