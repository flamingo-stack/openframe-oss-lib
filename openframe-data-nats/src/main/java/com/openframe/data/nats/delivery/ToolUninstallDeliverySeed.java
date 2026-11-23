package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ToolUninstallDeliverySeed implements DeliverySeed {

    private final String machineId;
    private final String toolAgentId;
    private final String toolType;

    @Override
    public DeliveryType getType() {
        return DeliveryType.TOOL_UNINSTALL;
    }

    @Override
    public String getTargetId() {
        return toolAgentId;
    }
}
