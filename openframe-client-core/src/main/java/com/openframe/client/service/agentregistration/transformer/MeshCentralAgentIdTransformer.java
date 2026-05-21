package com.openframe.client.service.agentregistration.transformer;

import com.openframe.data.document.tool.ToolType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@Slf4j
public class MeshCentralAgentIdTransformer implements ToolAgentIdTransformer {

    private final String tenantId;

    public MeshCentralAgentIdTransformer(@Value("${openframe.cluster-id:}") String tenantId) {
        this.tenantId = tenantId == null ? "" : tenantId;
    }

    @Override
    public ToolType getToolType() {
        return ToolType.MESHCENTRAL;
    }

    @Override
    public String transform(String machineId, String agentToolId, boolean __) {
        if (isBlank(agentToolId)) {
            log.warn("Agent tool ID is blank for MeshCentral, machineId={}", machineId);
            return agentToolId;
        }

        String transformedId = "node/" + tenantId + "/" + agentToolId;
        log.info("Transformed MeshCentral agent tool ID, machineId={}, agentToolId={}, transformedId={}", machineId, agentToolId, transformedId);

        return transformedId;
    }
}
