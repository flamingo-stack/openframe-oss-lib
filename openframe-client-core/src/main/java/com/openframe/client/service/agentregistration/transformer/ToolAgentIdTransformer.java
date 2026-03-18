package com.openframe.client.service.agentregistration.transformer;

import com.openframe.data.document.tool.ToolType;

public interface ToolAgentIdTransformer {

    ToolType getToolType();

    String transform(String machineId, String agentToolId, boolean lastAttempt);

}
