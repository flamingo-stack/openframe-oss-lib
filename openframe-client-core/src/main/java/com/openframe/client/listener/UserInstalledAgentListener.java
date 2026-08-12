package com.openframe.client.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.NatsTopicUserIdExtractor;
import com.openframe.client.service.UserInstalledAgentService;
import com.openframe.core.exception.NatsException;
import com.openframe.data.nats.model.UserInstalledAgentMessage;
import io.nats.client.*;
import io.nats.client.api.AckPolicy;
import io.nats.client.api.ConsumerConfiguration;
import io.nats.client.api.ConsumerInfo;
import io.nats.client.api.DeliverPolicy;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserInstalledAgentListener {

    private final Connection natsConnection;
    private final ObjectMapper objectMapper;
    private final UserInstalledAgentService userInstalledAgentService;
    private final NatsTopicUserIdExtractor userIdExtractor;

    private static final String STREAM_NAME = "INSTALLED_AGENTS";
    private static final String SUBJECT = "user.*.installed-agent";
    private static final String CONSUMER_NAME = "user-installed-agent-processor-v1";
    private static final String DELIVERY_GROUP = "user-installed-agent";
    private static final String DELIVERY_SUBJECT = "user.installed-agent.delivery";
    private static final int MAX_DELIVER = 50;
    private static final Duration ACK_WAIT = Duration.ofSeconds(30);

    private Dispatcher dispatcher;
    private JetStreamSubscription subscription;

    @EventListener(ApplicationReadyEvent.class)
    public void subscribeToUserInstalledAgents() {
        try {
            JetStream js = natsConnection.jetStream();

            // NATS Dispatcher manages threads internally
            dispatcher = natsConnection.createDispatcher();

            ConsumerConfiguration consumerConfig = buildConsumerConfig();

            PushSubscribeOptions pushOptions = PushSubscribeOptions.builder()
                    .stream(STREAM_NAME)
                    .configuration(consumerConfig)
                    .build();

            subscription = js.subscribe(SUBJECT, dispatcher, this::handleMessage, false, pushOptions);

            log.info("Subscribed to JetStream with Dispatcher: subject={} consumer={} (maxDeliver={}, ackWait={})",
                    SUBJECT, CONSUMER_NAME, MAX_DELIVER, ACK_WAIT);

        } catch (Exception e) {
            log.error("Failed to subscribe to JetStream", e);
            throw new RuntimeException("Failed to subscribe to JetStream", e);
        }
    }

    private ConsumerConfiguration buildConsumerConfig() throws IOException, JetStreamApiException {
        JetStreamManagement jsm = natsConnection.jetStreamManagement();

        try {
            ConsumerInfo existingConsumer = jsm.getConsumerInfo(STREAM_NAME, CONSUMER_NAME);

            log.info("Existing consumer config: {}", existingConsumer.getConsumerConfiguration());

            ConsumerConfiguration consumerConfig = buildConsumerConfiguration();

            log.info("New consumer config: {}", consumerConfig);

            jsm.addOrUpdateConsumer(STREAM_NAME, consumerConfig);

            return consumerConfig;
        } catch (JetStreamApiException e) {
            if (e.getErrorCode() == 404) {
                log.info("Consumer {} {} doesn't exist", STREAM_NAME, CONSUMER_NAME);
                ConsumerConfiguration consumerConfig = buildConsumerConfiguration();

                jsm.createConsumer(STREAM_NAME, consumerConfig);

                return consumerConfig;
            }
            throw new NatsException("Api error during consumer " + STREAM_NAME + " retrieve", e);
        }
    }

    private ConsumerConfiguration buildConsumerConfiguration() {
        return ConsumerConfiguration.builder()
                .durable(CONSUMER_NAME)
                .ackPolicy(AckPolicy.Explicit)
                .deliverPolicy(DeliverPolicy.All)
                .ackWait(ACK_WAIT)
                .maxDeliver(MAX_DELIVER)
                .filterSubject(SUBJECT)
                .deliverGroup(DELIVERY_GROUP)
                .deliverSubject(DELIVERY_SUBJECT)
                .build();
    }

    private void handleMessage(Message message) {
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

    @PreDestroy
    public void cleanup() {
        if (subscription != null) {
            try {
                subscription.unsubscribe();
                log.info("Unsubscribed from JetStream");
            } catch (Exception e) {
                log.error("Error unsubscribing from JetStream", e);
            }
        }

        if (dispatcher != null) {
            try {
                dispatcher.drain(Duration.ofSeconds(5));
                log.info("Dispatcher drained successfully");
            } catch (Exception e) {
                log.error("Error draining dispatcher", e);
            }
        }
    }
}
