package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;

public interface DeliverySpec<P> {

    DeliveryType getType();

    Class<P> getPayloadClass();

    void publish(String machineId, P payload);

    void onFailed(MachineDelivery delivery, DeliveryFailure failure);
}
