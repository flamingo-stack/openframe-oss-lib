package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryType;

public interface DeliverySeed {

    DeliveryType getType();

    String getTargetId();

    String getMachineId();

    // the one machine by default; a seed for every machine the type delivers to carries no machine
    default DeliveryAudience getAudience() {
        return DeliveryAudience.MACHINE;
    }
}
