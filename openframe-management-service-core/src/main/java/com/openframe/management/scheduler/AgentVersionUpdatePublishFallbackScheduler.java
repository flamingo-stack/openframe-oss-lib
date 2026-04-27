package com.openframe.management.scheduler;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.publisher.OpenFrameClientUpdatePublisher;
import com.openframe.data.nats.publisher.ToolAgentUpdateUpdatePublisher;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(value = "openframe.agent-version-update-publish-fallback.enabled", havingValue = "true")
public class AgentVersionUpdatePublishFallbackScheduler {

    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;
    private final OpenFrameClientUpdatePublisher openFrameClientUpdatePublisher;
    private final IntegratedToolAgentService integratedToolAgentService;
    private final ToolAgentUpdateUpdatePublisher toolAgentUpdateUpdatePublisher;

    @Value("${openframe.agent-version-update-publish-fallback.max-attempts:5}")
    private int maxPublishAttempts;

    @Scheduled(fixedDelayString = "${openframe.agent-version-update-publish-fallback.interval:30000}")
    @SchedulerLock(
            name = "agentVersionUpdatePublishFallback",
            lockAtMostFor = "${openframe.agent-version-update-publish-fallback.lock-at-most-for:5m}",
            lockAtLeastFor = "${openframe.agent-version-update-publish-fallback.lock-at-least-for:10s}"
    )
    public void publishUnpublishedEntities() {
        try {
            processOpenframeClient();
            processToolAgents();
        } catch (Exception e) {
            log.error("Agent version update publishing failed", e);
        }
    }

    private void processOpenframeClient() {
        OpenFrameClientConfiguration config = openFrameClientConfigurationService.get();
        if (shouldRetryPublish(config.getPublishState())) {
            openFrameClientUpdatePublisher.publish(config);
        }
    }

    private void processToolAgents() {
        List<IntegratedToolAgent> enabled = integratedToolAgentService.getAllEnabled();
        for (IntegratedToolAgent agent : enabled) {
            if (shouldRetryPublish(agent.getPublishState())) {
                toolAgentUpdateUpdatePublisher.publish(agent);
            }
        }
    }

    private boolean shouldRetryPublish(PublishState publishState) {
        if (publishState == null) {
            return true;
        }
        if (publishState.isPublished()) {
            return false;
        }
        return publishState.getAttempts() < maxPublishAttempts;
    }
}
