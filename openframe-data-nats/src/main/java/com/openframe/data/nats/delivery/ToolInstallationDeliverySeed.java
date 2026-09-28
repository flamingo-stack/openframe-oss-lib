package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ToolInstallationDeliverySeed implements DeliverySeed {

    private final String machineId;
    private final IntegratedToolAgent toolAgent;
    private final IntegratedTool tool;
    private final boolean reinstall;

    @Override
    public DeliveryType type() {
        return DeliveryType.TOOL_INSTALLATION;
    }
}
