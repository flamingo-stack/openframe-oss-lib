package com.openframe.management.scheduler;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.data.service.OpenFrameClientUpdatePublisher;
import com.openframe.data.service.ToolAgentUpdateUpdatePublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(value = "openframe.nats-publish.enabled", havingValue = "true", matchIfMissing = true)
public class AgentVersionUpdatePublishFallbackScheduler {

    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;
    private final OpenFrameClientUpdatePublisher openFrameClientUpdatePublisher;
    private final IntegratedToolAgentService integratedToolAgentService;
    private final ToolAgentUpdateUpdatePublisher toolAgentUpdateUpdatePublisher;

    @Scheduled(fixedDelayString = "${openframe.agent-version-update-publish-fallback.interval:600000}")
    public void publishUnpublishedEntities() {
        try {
            OpenFrameClientConfiguration openFrameClientConfiguration = openFrameClientConfigurationService.get();
            processOpenframeClient(openFrameClientConfiguration);

            List<IntegratedToolAgent> toolAgents = integratedToolAgentService.getAllEnabled();
            toolAgents.forEach(this::processToolAgent);
        } catch (Exception e) {
            log.error("Agent version update publishing failed", e);
        }
    }

    private void processOpenframeClient(OpenFrameClientConfiguration openFrameClientConfiguration) {
        if (!openFrameClientConfiguration.isUpdateMessagePublished()) {
            openFrameClientUpdatePublisher.publish(openFrameClientConfiguration);
        }
    }

    private void processToolAgent(IntegratedToolAgent toolAgent) {
        if (!toolAgent.isUpdateMessagePublished()) {
            toolAgentUpdateUpdatePublisher.publish(toolAgent);
        }
    }
}
