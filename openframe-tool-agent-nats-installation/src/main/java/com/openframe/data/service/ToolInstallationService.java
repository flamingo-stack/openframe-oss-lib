package com.openframe.data.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ToolInstallationDeliverySeed;
import com.openframe.data.nats.publisher.ToolInstallationNatsPublisher;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;

import static org.apache.commons.lang3.StringUtils.isEmpty;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolInstallationService {

    private final IntegratedToolService integratedToolService;
    private final ToolCommandParamsResolver toolCommandParamsResolver;
    private final ToolInstallationNatsPublisher toolInstallationNatsPublisher;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryDispatcher deliveryDispatcher;

    public void process(String machineId, IntegratedToolAgent toolAgent) {
        process(machineId, toolAgent, false);
    }

    public void process(String machineId, IntegratedToolAgent toolAgent, boolean reinstall) {
        String toolId = toolAgent.getToolId();
        try {
            IntegratedTool tool = getIntegratedToolData(toolId);

            // process params for installation command args
            List<String> installationCommandArgs = toolAgent.getInstallationCommandArgs();
            toolAgent.setInstallationCommandArgs(toolCommandParamsResolver.process(toolId, installationCommandArgs));

            // TODO: avoid double tool calls for registration secret(fleet)
            // TODO: cache fleet secret(always same) to avoid additional fleet calls.
            // process params for run command args
            List<String> runCommandArgs = toolAgent.getRunCommandArgs();
            toolAgent.setRunCommandArgs(toolCommandParamsResolver.process(toolId, runCommandArgs));

            publish(machineId, toolAgent, tool, reinstall);
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
            return integratedToolService.getToolByKey(toolId)
                    .orElseThrow(() -> new IllegalStateException("No tool found:" + toolId));
        }
    }


    private void publish(String machineId, IntegratedToolAgent toolAgent, IntegratedTool tool, boolean reinstall) {
        if (deliveryProperties.isEnabled(DeliveryType.TOOL_INSTALLATION)) {
            ToolInstallationDeliverySeed seed = new ToolInstallationDeliverySeed(machineId, toolAgent, tool, reinstall);
            deliveryDispatcher.dispatch(seed);
            return;
        }
        toolInstallationNatsPublisher.publish(machineId, toolAgent, tool, reinstall);
    }
}
