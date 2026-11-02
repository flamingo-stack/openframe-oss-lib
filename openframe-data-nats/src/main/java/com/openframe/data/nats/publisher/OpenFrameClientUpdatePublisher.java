package com.openframe.data.nats.publisher;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class OpenFrameClientUpdatePublisher {

    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;
    private final DeliveryRouter deliveryRouter;

    public void publish(OpenFrameClientConfiguration configuration) {
        String configurationVersion = configuration.getVersion();
        try {
            sendToEveryMachine(configuration);
        } catch (Exception e) {
            log.error("Publish failed for client configuration version {}, will be retried by scheduler",
                    configurationVersion, e);
            try {
                openFrameClientConfigurationService.markAsNonPublished(configuration);
            } catch (OptimisticLockingFailureException ole) {
                log.warn("Concurrent writer for client configuration during failure-mark; skipping");
            }
            return;
        }
        try {
            openFrameClientConfigurationService.markAsPublished(configuration);
            log.info("Published client update message for all machines with version: {}", configurationVersion);
        } catch (OptimisticLockingFailureException e) {
            log.warn("Concurrent writer for client configuration during publish; skipping mark-published");
        }
    }

    private void sendToEveryMachine(OpenFrameClientConfiguration configuration) {
        ClientUpdateDeliverySeed seed = ClientUpdateDeliverySeed.forEveryMachine(configuration);
        boolean carried = deliveryRouter.dispatch(seed);
        if (!carried) {
            throw new IllegalStateException("No delivery route carries the client update to every machine");
        }
    }
}
