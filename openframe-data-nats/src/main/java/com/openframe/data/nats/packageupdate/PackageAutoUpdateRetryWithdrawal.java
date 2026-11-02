package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.delivery.track.DeliveryTracker;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

// Withdraws the retry a policy names. A retry that already ran is a closed row, which a cancel leaves as it is.
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageAutoUpdateRetryWithdrawal {

    private final DeliveryTracker deliveryTracker;

    public void withdraw(PackageAutoUpdatePolicy policy, String reason) {
        String retryRequestId = policy.getRetryRequestId();
        if (retryRequestId != null) {
            deliveryTracker.cancel(DeliveryType.PACKAGE_UPDATE, retryRequestId, policy.getMachineId(), reason);
        }
    }
}
