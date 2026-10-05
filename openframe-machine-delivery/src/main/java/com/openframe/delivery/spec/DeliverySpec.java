package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

public interface DeliverySpec<S extends DeliverySeed, P extends DeliveryPayload> {

    DeliveryType getType();

    Class<P> getPayloadClass();

    DeliveryRequest<P> request(S seed);

    String subject(String machineId);

    // a machine that is gone or on its way out gets no new commands; a type that must reach such a machine overrides this
    Set<DeviceStatus> IN_SERVICE = Collections.unmodifiableSet(EnumSet.complementOf(EnumSet.of(
            DeviceStatus.DELETED, DeviceStatus.ARCHIVED, DeviceStatus.DECOMMISSIONED, DeviceStatus.PENDING_DELETION)));

    default Set<DeviceStatus> getDeliverableStatuses() {
        return IN_SERVICE;
    }
}
