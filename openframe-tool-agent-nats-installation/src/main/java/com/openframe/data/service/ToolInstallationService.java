package com.openframe.data.service;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ToolInstallationDeliverySeed;
import com.openframe.data.nats.delivery.route.DeviceCommandSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.DEVICE_TOOL_AGENT_INSTALL;
import static com.openframe.data.document.audit.AuditAction.DEVICE_TOOL_AGENT_REINSTALL;
import static org.apache.commons.lang3.StringUtils.isEmpty;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolInstallationService {

    private final IntegratedToolService integratedToolService;
    private final ToolCommandParamsResolver toolCommandParamsResolver;
    private final DeviceCommandSender deviceCommandSender;

    public boolean process(String machineId, IntegratedToolAgent toolAgent) {
        return process(machineId, toolAgent, false);
    }

    public boolean process(String machineId, IntegratedToolAgent toolAgent, boolean reinstall) {
        String toolId = toolAgent.getToolId();
        AuditAction action = reinstall ? DEVICE_TOOL_AGENT_REINSTALL : DEVICE_TOOL_AGENT_INSTALL;
        try {
            Map<String, Object> details = Map.of("toolAgentIds", List.of(toolAgent.getKey()));
            boolean sent = deviceCommandSender.send(action, machineId, details,
                    () -> seedOf(machineId, toolAgent, reinstall));
            if (sent) {
                log.info("Published {} agent installation message for machine {}", toolId, machineId);
            }
            return sent;
        } catch (Exception e) {
            log.error("Failed to publish {} agent installation message for machine {}", toolId, machineId, e);
            return false;
        }
    }

    private ToolInstallationDeliverySeed seedOf(String machineId, IntegratedToolAgent toolAgent, boolean reinstall) {
        String toolId = toolAgent.getToolId();
        IntegratedTool tool = getIntegratedToolData(toolId);

        // process params for installation command args
        List<String> installationCommandArgs = toolAgent.getInstallationCommandArgs();
        toolAgent.setInstallationCommandArgs(toolCommandParamsResolver.process(toolId, installationCommandArgs));

        // TODO: avoid double tool calls for registration secret(fleet)
        // TODO: cache fleet secret(always same) to avoid additional fleet calls.
        // process params for run command args
        List<String> runCommandArgs = toolAgent.getRunCommandArgs();
        toolAgent.setRunCommandArgs(toolCommandParamsResolver.process(toolId, runCommandArgs));

        return new ToolInstallationDeliverySeed(machineId, toolAgent, tool, reinstall);
    }

    // TODO: need have boolean field at agent configuration like "hasToolServer"
    //  if no tool server then we don't publish integrated_tool information and client shouldn't try to process this data.
    //  for now just publish empty tool data
    private IntegratedTool getIntegratedToolData(String toolId) {
        if (isEmpty(toolId)) {
            IntegratedTool tool = new IntegratedTool();
            tool.setId("");
            tool.setType("");
            return tool;
        } else {
            return integratedToolService.getToolByKey(toolId)
                    .orElseThrow(() -> new IllegalStateException("No tool found:" + toolId));
        }
    }
}
