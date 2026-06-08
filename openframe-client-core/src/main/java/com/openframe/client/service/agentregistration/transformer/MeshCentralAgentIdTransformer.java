package com.openframe.client.service.agentregistration.transformer;

import com.openframe.data.document.tool.ToolType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@Slf4j
public class MeshCentralAgentIdTransformer implements ToolAgentIdTransformer {

    private static final String LEGACY_NODE_PREFIX = "node//";

    @Value("${openframe.client.meshcentral.node-id:}")
    private String nodeId;
    @Value("${openframe.client.meshcentral.tenant-scoped-node-id:false}")
    private boolean tenantScopedNodeId;

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

        String transformedId;
        if (tenantScopedNodeId) {
            transformedId = "node/" + nodeId + "/" + agentToolId;
        } else {
            //TODO Legacy empty-domain form (kept as the default). delete after mesh release
            transformedId = LEGACY_NODE_PREFIX + agentToolId;
        }
        log.info("Transformed MeshCentral agent tool ID, machineId={}, agentToolId={}, transformedId={}", machineId, agentToolId, transformedId);

        return transformedId;
    }
}
