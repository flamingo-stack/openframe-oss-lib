package com.openframe.data.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

import static org.apache.zookeeper.common.StringUtils.isEmpty;

@Service
@RequiredArgsConstructor
@Slf4j
public class ToolInstallationService {

    private final IntegratedToolService integratedToolService;
    private final ToolCommandParamsResolver toolCommandParamsResolver;
    private final ToolInstallationNatsPublisher toolInstallationNatsPublisher;

    public void process(String machineId, IntegratedToolAgent toolAgent) {
        String toolId = toolAgent.getToolId();
        try {
            IntegratedTool tool = getIntegratedToolData(toolId);

            // process params for installation command args
            List<String> installationCommandArgs = toolAgent.getInstallationCommandArgs();
            toolAgent.setInstallationCommandArgs(toolCommandParamsResolver.process(toolId, installationCommandArgs));

            // TODO: avoid double tool calls for registration secret(tactical, fleet)
            // TODO: cache fleet secret(always same) to avoid additional fleet calls.
            // process params for run command args
            List<String> runCommandArgs = toolAgent.getRunCommandArgs();
            toolAgent.setRunCommandArgs(toolCommandParamsResolver.process(toolId, runCommandArgs));

            toolInstallationNatsPublisher.publish(machineId, toolAgent, tool);
            log.info("Published {} agent installation message for machine {}", toolId, machineId);
        } catch (Exception e) {
            // TODO: add fallback mechanism
            log.error("Failed to publish {} agent installation message for machine {}", toolId, machineId, e);
        }
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
            return integratedToolService.getToolById(toolId)
                    .orElseThrow(() -> new IllegalStateException("No tool found:" + toolId));
        }
    }

}
