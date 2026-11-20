package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

// an offline device is reachable: its order waits for it; off or an agent below the floor is not
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageAdoptReach {

    private final DeliveryRouter deliveryRouter;

    public boolean isReachable(String machineId) {
        return deliveryRouter.reaches(DeliveryType.PACKAGE_ADOPT, machineId);
    }

    // in the order of machineIds
    public List<String> filterReachable(List<String> machineIds) {
        Set<String> reachable = deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, machineIds);
        return machineIds.stream().filter(reachable::contains).toList();
    }
}
