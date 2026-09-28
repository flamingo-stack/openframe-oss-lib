package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryType;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TestSeed implements DeliverySeed {

    private final String machineId;

    @Override
    public DeliveryType type() {
        return DeliveryType.TOOL_INSTALLATION;
    }
}
