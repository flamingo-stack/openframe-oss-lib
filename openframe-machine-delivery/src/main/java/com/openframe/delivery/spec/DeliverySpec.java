package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;

public interface DeliverySpec<S extends DeliverySeed, P extends DeliveryPayload> {

    DeliveryType getType();

    Class<P> getPayloadClass();

    DeliveryRequest<P> request(S seed);

    String subject(String machineId);

    void onFailed(MachineDelivery delivery, DeliveryFailure failure);
}
