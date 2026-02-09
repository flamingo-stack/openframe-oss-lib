package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.mapper.DownloadConfigurationMapper;
import com.openframe.data.model.nats.OpenFrameClientUpdateMessage;
import com.openframe.data.repository.nats.NatsMessagePublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

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
        if (!clientUpdateFeatureEnabled) {
            log.info("Client update publishing is disabled, skipping publish for version: {}", configuration.getVersion());
            return;
        }

        PublishState publishState = configuration.getPublishState();
        PublishState stateBefore = PublishState.nonPublished(publishState);
        configuration.setPublishState(stateBefore);
        openFrameClientConfigurationService.save(configuration);

        OpenFrameClientUpdateMessage message = buildMessage(configuration);
        natsMessagePublisher.publish(TOPIC_NAME, message);

        configuration.setPublishState(PublishState.published(stateBefore));
        openFrameClientConfigurationService.save(configuration);
        log.info("Published client update message for all machines with version: {}", configuration.getVersion());
    }

    private OpenFrameClientUpdateMessage buildMessage(OpenFrameClientConfiguration configuration) {
        OpenFrameClientUpdateMessage message = new OpenFrameClientUpdateMessage();
        message.setVersion(configuration.getVersion());
        message.setDownloadConfigurations(
                downloadConfigurationMapper.map(configuration.getDownloadConfiguration(), configuration.getVersion())
        );
        return message;
    }
}

