package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
public class ToolUpdateDeliverySeed implements DeliverySeed {

    private final DeliveryAudience audience;
    private final String machineId;
    private final IntegratedToolAgent toolAgent;

    public static ToolUpdateDeliverySeed forMachine(String machineId, IntegratedToolAgent toolAgent) {
        return new ToolUpdateDeliverySeed(DeliveryAudience.MACHINE, machineId, toolAgent);
    }

    public static ToolUpdateDeliverySeed forEveryMachine(IntegratedToolAgent toolAgent) {
        return new ToolUpdateDeliverySeed(DeliveryAudience.EVERY_MACHINE, null, toolAgent);
    }

    @Override
    public DeliveryType getType() {
        return DeliveryType.TOOL_UPDATE;
    }

    @Override
    public String getTargetId() {
        return toolAgent.getKey();
    }
}
