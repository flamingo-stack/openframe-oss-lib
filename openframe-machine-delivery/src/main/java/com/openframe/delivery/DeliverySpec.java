package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;

public interface DeliverySpec<S extends DeliverySeed, P> {

    DeliveryType getType();

    Class<S> getSeedClass();

    Class<P> getPayloadClass();

    DeliveryRequest<P> request(S seed);

    void publish(String machineId, P payload);

    default boolean stillWanted(MachineDelivery delivery) {
        return true;
    }

    void onFailed(MachineDelivery delivery, DeliveryFailure failure);
}
