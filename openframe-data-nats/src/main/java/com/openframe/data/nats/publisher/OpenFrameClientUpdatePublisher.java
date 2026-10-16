package com.openframe.data.nats.publisher;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.mapper.OpenFrameClientUpdateMessageMapper;
import com.openframe.data.nats.model.OpenFrameClientUpdateMessage;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
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

    private final static String TOPIC_NAME = "machine.all.client-update";

    private final NatsMessagePublisher natsMessagePublisher;
    private final OpenFrameClientUpdateMessageMapper messageMapper;
    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryDispatcher deliveryDispatcher;

    public void publish(OpenFrameClientConfiguration configuration) {
        String configurationVersion = configuration.getVersion();
        try {
            if (isClientUpdateDeliveryEnabled()) {
                handOverToEveryMachine(configuration);
            } else {
                send(configuration);
            }
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

    public void send(OpenFrameClientConfiguration configuration) {
        OpenFrameClientUpdateMessage message = messageMapper.toMessage(configuration);
        natsMessagePublisher.publishPersistent(TOPIC_NAME, message);
    }

    private void handOverToEveryMachine(OpenFrameClientConfiguration configuration) {
        deliveryDispatcher.dispatch(ClientUpdateDeliverySeed.forEveryMachine(configuration));
        log.info("Client update handed to the delivery engine for every machine: version={}", configuration.getVersion());
    }

    private boolean isClientUpdateDeliveryEnabled() {
        return deliveryProperties.isEnabled(DeliveryType.CLIENT_UPDATE);
    }
}
