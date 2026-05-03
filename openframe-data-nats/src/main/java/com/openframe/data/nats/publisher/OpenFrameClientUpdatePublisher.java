package com.openframe.data.nats.publisher;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.nats.mapper.DownloadConfigurationMapper;
import com.openframe.data.nats.model.OpenFrameClientUpdateMessage;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class OpenFrameClientUpdatePublisher {

    private final static String TOPIC_NAME = "machine.all.client-update";

    @Value("${openframe.client.update.feature.enabled:false}")
    private boolean clientUpdateFeatureEnabled;

    private final NatsMessagePublisher natsMessagePublisher;
    private final DownloadConfigurationMapper downloadConfigurationMapper;
    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;

    public void publish(OpenFrameClientConfiguration configuration) {
        String configurationVersion = configuration.getVersion();

        if (!clientUpdateFeatureEnabled) {
            log.info("Client update publishing is disabled, skipping publish for version: {}", configurationVersion);
            return;
        }

        try {
            OpenFrameClientUpdateMessage message = buildMessage(configuration);
            natsMessagePublisher.publishPersistent(TOPIC_NAME, message);
        } catch (Exception e) {
            log.error("NATS publish failed for client configuration version {}, will be retried by scheduler",
                    configurationVersion, e);
            try {
                openFrameClientConfigurationService.markAsNonPublished();
            } catch (OptimisticLockingFailureException ole) {
                log.warn("Concurrent writer for client configuration during failure-mark; skipping");
            }
            return;
        }

        try {
            openFrameClientConfigurationService.markAsPublished();
            log.info("Published client update message for all machines with version: {}", configurationVersion);
        } catch (OptimisticLockingFailureException e) {
            log.warn("Concurrent writer for client configuration during publish; skipping mark-published");
        }
    }

    private OpenFrameClientUpdateMessage buildMessage(OpenFrameClientConfiguration configuration) {
        String configurationVersion = configuration.getVersion();
        List<DownloadConfiguration> downloadConfiguration = configuration.getDownloadConfiguration();

        OpenFrameClientUpdateMessage message = new OpenFrameClientUpdateMessage();
        message.setVersion(configurationVersion);
        message.setDownloadConfigurations(downloadConfigurationMapper.map(downloadConfiguration, configurationVersion));
        return message;
    }
}
