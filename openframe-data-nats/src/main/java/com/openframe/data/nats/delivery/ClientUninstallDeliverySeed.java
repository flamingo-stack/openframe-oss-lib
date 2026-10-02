package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ClientUninstallDeliverySeed implements DeliverySeed {

    private final String machineId;

    @Override
    public DeliveryType getType() {
        return DeliveryType.CLIENT_UNINSTALL;
    }
}
