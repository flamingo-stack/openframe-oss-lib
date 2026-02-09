package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.mapper.DownloadConfigurationMapper;
import com.openframe.data.model.nats.ToolAgentUpdateMessage;
import com.openframe.data.repository.nats.NatsMessagePublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import static java.lang.String.format;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolAgentUpdateUpdatePublisher {

    private final static String TOPIC_NAME_TEMPLATE = "machine.all.tool.%s.update";

    @Value("${openframe.tool-agent.update.feature.enabled:false}")
    private boolean toolAgentUpdateFeatureEnabled;

    private final NatsMessagePublisher natsMessagePublisher;
    private final DownloadConfigurationMapper downloadConfigurationMapper;
    private final IntegratedToolAgentService integratedToolAgentService;

    public void publish(IntegratedToolAgent toolAgent) {
        if (!toolAgentUpdateFeatureEnabled) {
            log.info("Tool agent update publishing is disabled, skipping publish for tool: {} version: {}", toolAgent.getId(), toolAgent.getVersion());
            return;
        }

        String toolAgentId = toolAgent.getId();
        markAsNonPublished(toolAgentId);

        String topicName = buildTopicName(toolAgent);
        ToolAgentUpdateMessage message = buildMessage(toolAgent);
        natsMessagePublisher.publishPersistent(topicName, message);

        markAsPublished(toolAgentId);

        log.info("Published tool update message for tool: {} version: {}", toolAgent.getId(), toolAgent.getVersion());
    }

    private void markAsNonPublished(String toolAgentId) {
        IntegratedToolAgent toolAgent = integratedToolAgentService.findById(toolAgentId)
                .orElseThrow();

        PublishState publishState = toolAgent.getPublishState();
        PublishState stateBefore = PublishState.nonPublished(publishState);
        toolAgent.setPublishState(stateBefore);

        integratedToolAgentService.save(toolAgent);
    }

    private String buildTopicName(IntegratedToolAgent toolAgent) {
        String toolAgentId = toolAgent.getId();
        return format(TOPIC_NAME_TEMPLATE, toolAgentId);
    }

    private ToolAgentUpdateMessage buildMessage(IntegratedToolAgent toolAgent) {
        ToolAgentUpdateMessage message = new ToolAgentUpdateMessage();
        message.setToolAgentId(toolAgent.getId());
        message.setVersion(toolAgent.getVersion());
        message.setSessionType(toolAgent.getSessionType());
        message.setDownloadConfigurations(
                downloadConfigurationMapper.map(toolAgent.getDownloadConfigurations(), toolAgent.getVersion())
        );
        return message;
    }

    private void markAsPublished(String toolAgentId) {
        IntegratedToolAgent toolAgent = integratedToolAgentService.findById(toolAgentId)
                .orElseThrow();

        PublishState publishState = toolAgent.getPublishState();
        toolAgent.setPublishState(PublishState.published(publishState));
        integratedToolAgentService.save(toolAgent);
    }
}

