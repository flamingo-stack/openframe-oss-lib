package com.openframe.delivery.track;

import com.openframe.data.document.delivery.DeliveryType;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

// published once a delivery is DONE, so the domain that sent it can close its own record
@Getter
@RequiredArgsConstructor
public class DeliveryDoneEvent {

    private final DeliveryType type;
    private final String targetId;
    private final String machineId;
}
