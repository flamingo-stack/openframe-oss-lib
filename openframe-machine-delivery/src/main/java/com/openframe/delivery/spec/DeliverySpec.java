package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;

import java.util.EnumSet;
import java.util.Set;

public interface DeliverySpec<S extends DeliverySeed, P extends DeliveryPayload> {

    DeliveryType getType();

    Class<P> getPayloadClass();

    DeliveryRequest<P> request(S seed);

    String subject(String machineId);

    // a machine that never connected is still waiting for its first commands; one that is gone or leaving gets none
    default Set<DeviceStatus> getDeliverableStatuses() {
        return EnumSet.of(DeviceStatus.ONLINE, DeviceStatus.OFFLINE, DeviceStatus.PENDING);
    }
}
