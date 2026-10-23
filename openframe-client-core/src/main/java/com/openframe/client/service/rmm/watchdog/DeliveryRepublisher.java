package com.openframe.client.service.rmm.watchdog;

import com.openframe.data.document.rmm.script.DeliveryChannel;

public interface DeliveryRepublisher {

    DeliveryChannel channel();

    void republish(String machineId, String messageJson);
}
