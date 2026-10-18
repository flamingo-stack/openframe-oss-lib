package com.openframe.data.nats.publisher;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ToolUpdateDeliverySeed;
import com.openframe.data.nats.mapper.ToolAgentUpdateMessageMapper;
import com.openframe.data.nats.model.ToolAgentUpdateMessage;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import static java.lang.String.format;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolAgentUpdateUpdatePublisher {

    private final static String TOPIC_NAME_TEMPLATE = "machine.all.tool.%s.update";

    private final NatsMessagePublisher natsMessagePublisher;
    private final ToolAgentUpdateMessageMapper messageMapper;
    private final IntegratedToolAgentService integratedToolAgentService;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryDispatcher deliveryDispatcher;

    public void publish(IntegratedToolAgent toolAgent) {
        String toolAgentId = toolAgent.getKey();
        String toolAgentVersion = toolAgent.getVersion();
        try {
            if (isToolUpdateDeliveryEnabled()) {
                handOverToEveryMachine(toolAgent);
            } else {
                send(toolAgent);
            }
        } catch (Exception e) {
            log.error("Publish failed for tool agent {}, will be retried by scheduler", toolAgentId, e);
            try {
                integratedToolAgentService.markAsNonPublished(toolAgent);
            } catch (OptimisticLockingFailureException ole) {
                log.warn("Concurrent writer for tool agent {} during failure-mark; skipping", toolAgentId);
            }
            return;
        }
        try {
            integratedToolAgentService.markAsPublished(toolAgent);
            log.info("Published tool update message for tool: {} version: {}", toolAgentId, toolAgentVersion);
        } catch (OptimisticLockingFailureException e) {
            log.warn("Concurrent writer for tool agent {} during publish; skipping mark-published", toolAgentId);
        }
    }

    public void send(IntegratedToolAgent toolAgent) {
        String toolAgentId = toolAgent.getKey();
        String topicName = buildTopicName(toolAgentId);
        ToolAgentUpdateMessage message = messageMapper.toMessage(toolAgent);
        natsMessagePublisher.publishPersistent(topicName, message);
    }

    private void handOverToEveryMachine(IntegratedToolAgent toolAgent) {
        deliveryDispatcher.dispatch(ToolUpdateDeliverySeed.forEveryMachine(toolAgent));
        log.info("Tool update handed to the delivery engine for every machine: toolAgentId={} version={}",
                toolAgent.getKey(), toolAgent.getVersion());
    }

    private boolean isToolUpdateDeliveryEnabled() {
        return deliveryProperties.isEnabled(DeliveryType.TOOL_UPDATE);
    }

    private String buildTopicName(String toolAgentId) {
        return format(TOPIC_NAME_TEMPLATE, toolAgentId);
    }
}
