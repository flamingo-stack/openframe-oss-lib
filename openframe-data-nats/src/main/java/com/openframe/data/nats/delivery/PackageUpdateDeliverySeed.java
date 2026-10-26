package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.nats.packageupdate.UpdateSource;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PackageUpdateDeliverySeed implements DeliverySeed {

    private final String machineId;
    private final String requestId;
    private final UpdateSource source;
    private final PackageReference packageRef;
    private final PackageUpdateMode mode;
    private final Integer countdownSeconds;

    @Override
    public DeliveryType getType() {
        return DeliveryType.PACKAGE_UPDATE;
    }

    @Override
    public String getTargetId() {
        return requestId;
    }

    @Override
    public String getMachineId() {
        return machineId;
    }
}
