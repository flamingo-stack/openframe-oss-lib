package com.openframe.data.nats.publisher;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.nats.mapper.OpenFrameClientUpdateMessageMapper;
import com.openframe.data.nats.model.OpenFrameClientUpdateMessage;
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

    private final static String TOPIC_NAME = "machine.all.client-update";

    private final NatsMessagePublisher natsMessagePublisher;
    private final OpenFrameClientUpdateMessageMapper messageMapper;
    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;

    public void publish(OpenFrameClientConfiguration configuration) {
        String configurationVersion = configuration.getVersion();

        try {
            send(configuration);
        } catch (Exception e) {
            log.error("NATS publish failed for client configuration version {}, will be retried by scheduler",
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

}
