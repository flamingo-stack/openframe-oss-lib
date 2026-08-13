package com.openframe.client.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.NatsTopicUserIdExtractor;
import com.openframe.client.service.UserInstalledAgentService;
import com.openframe.data.nats.listener.AbstractJetStreamPushListener;
import com.openframe.data.nats.model.UserInstalledAgentMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
@Slf4j
public class UserInstalledAgentListener extends AbstractJetStreamPushListener {

    private final ObjectMapper objectMapper;
    private final UserInstalledAgentService userInstalledAgentService;
    private final NatsTopicUserIdExtractor userIdExtractor;

    public UserInstalledAgentListener(
            Connection natsConnection,
            ObjectMapper objectMapper,
            UserInstalledAgentService userInstalledAgentService,
            NatsTopicUserIdExtractor userIdExtractor
    ) {
        super(natsConnection);
        this.objectMapper = objectMapper;
        this.userInstalledAgentService = userInstalledAgentService;
        this.userIdExtractor = userIdExtractor;
    }

    @Override
    protected String getStreamName() {
        return "INSTALLED_AGENTS";
    }

    @Override
    protected String getSubject() {
        return "user.*.installed-agent";
    }

    @Override
    protected String getConsumerName() {
        return "user-installed-agent-processor-v1";
    }

    @Override
    protected String getDeliveryGroup() {
        return "user-installed-agent";
    }

    @Override
    protected String getDeliverySubject() {
        return "user.installed-agent.delivery";
    }

    @Override
    protected void handleMessage(Message message) {
        String messagePayload = new String(message.getData(), StandardCharsets.UTF_8);
        String subject = message.getSubject();

        try {
            String userId = userIdExtractor.extract(subject);
            UserInstalledAgentMessage installedAgentMessage = objectMapper.readValue(messagePayload, UserInstalledAgentMessage.class);

            String agentType = installedAgentMessage.getAgentType();
            String version = installedAgentMessage.getVersion();
            long deliveredCount = message.metaData().deliveredCount();

            log.info("Processing user installed agent: userId={} agentType={} version={} (delivery={})",
                    userId, agentType, version, deliveredCount);

            userInstalledAgentService.upsertInstalledAgent(userId, agentType, version);

            message.ack();
            log.info("User installed agent processed successfully and acked");
        } catch (Exception e) {
            log.error("Unexpected error processing user installed agent: {}", messagePayload, e);
            // Don't ack the message and let it be redelivered
            log.info("Leaving message unacked for potential redelivery: user installed agent");
        }
    }
}
