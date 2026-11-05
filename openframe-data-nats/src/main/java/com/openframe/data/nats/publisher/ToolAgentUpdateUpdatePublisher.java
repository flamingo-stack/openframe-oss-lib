package com.openframe.data.nats.publisher;

import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ToolUpdateDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.service.IntegratedToolAgentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class ToolAgentUpdateUpdatePublisher {

    private final IntegratedToolAgentService integratedToolAgentService;
    private final DeliveryRouter deliveryRouter;

    public void publish(IntegratedToolAgent toolAgent) {
        String toolAgentId = toolAgent.getKey();
        String toolAgentVersion = toolAgent.getVersion();
        try {
            sendToEveryMachine(toolAgent);
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

    private void sendToEveryMachine(IntegratedToolAgent toolAgent) {
        ToolUpdateDeliverySeed seed = ToolUpdateDeliverySeed.forEveryMachine(toolAgent);
        boolean carried = deliveryRouter.dispatch(seed);
        if (!carried) {
            throw new IllegalStateException("No delivery route carries the tool update to every machine: " + toolAgent.getKey());
        }
    }
}
