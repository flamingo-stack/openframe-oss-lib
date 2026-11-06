package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.nats.delivery.PackageUpdateDeliverySeed;
import com.openframe.delivery.track.DeliveryTracker;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

// Withdraws what the delivery engine still holds of a policy's last order: the order's row, which a re-run would send
// again, and the deadline force scheduled for it. A row that already closed is left as it is.
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageAutoUpdateWithdrawal {

    private final DeliveryTracker deliveryTracker;

    public void withdraw(PackageAutoUpdatePolicy policy, String reason) {
        String requestId = policy.getRequestId();
        if (requestId == null) {
            return;
        }
        String machineId = policy.getMachineId();
        deliveryTracker.cancel(DeliveryType.PACKAGE_UPDATE, requestId, machineId, reason);
        deliveryTracker.cancel(DeliveryType.PACKAGE_UPDATE, PackageUpdateDeliverySeed.deadlineTargetId(requestId), machineId, reason);
    }
}
