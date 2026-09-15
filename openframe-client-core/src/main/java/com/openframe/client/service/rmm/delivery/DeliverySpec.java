package com.openframe.client.service.rmm.delivery;

import com.openframe.data.document.rmm.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.MachineDelivery;

public interface DeliverySpec<P> {

    DeliveryKind getKind();

    Class<P> getPayloadClass();

    void publish(String machineId, P payload);

    void onFailed(MachineDelivery delivery, DeliveryFailure failure);
}
