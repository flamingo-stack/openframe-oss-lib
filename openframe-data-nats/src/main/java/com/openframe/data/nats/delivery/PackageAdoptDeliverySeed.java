package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PackageAdoptDeliverySeed implements DeliverySeed {

    private final String machineId;
    private final String requestId;
    private final PackageReference packageRef;

    @Override
    public DeliveryType getType() {
        return DeliveryType.PACKAGE_ADOPT;
    }

    @Override
    public String getTargetId() {
        return requestId;
    }
}
