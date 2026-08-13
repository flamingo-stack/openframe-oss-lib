package com.openframe.data.nats.listener;

import com.openframe.core.exception.NatsException;
import io.nats.client.*;
import io.nats.client.api.AckPolicy;
import io.nats.client.api.ConsumerConfiguration;
import io.nats.client.api.ConsumerInfo;
import io.nats.client.api.DeliverPolicy;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;

import java.io.IOException;
import java.time.Duration;

/**
 * Base for durable JetStream push consumers: creates/updates the durable consumer
 * on startup, dispatches messages to {@link #handleMessage(Message)} and cleans up
 * the subscription on shutdown. Subclasses supply the consumer coordinates and the
 * message handling (including ack semantics).
 */
@Slf4j
public abstract class AbstractJetStreamPushListener {

    protected static final int DEFAULT_MAX_DELIVER = 50;
    protected static final Duration DEFAULT_ACK_WAIT = Duration.ofSeconds(30);

    protected final Connection natsConnection;

    private Dispatcher dispatcher;
    private JetStreamSubscription subscription;

    protected AbstractJetStreamPushListener(Connection natsConnection) {
        this.natsConnection = natsConnection;
    }

    protected abstract String getStreamName();

    protected abstract String getSubject();

    protected abstract String getConsumerName();

    protected abstract String getDeliveryGroup();

    protected abstract String getDeliverySubject();

    protected int getMaxDeliver() {
        return DEFAULT_MAX_DELIVER;
    }

    protected Duration getAckWait() {
        return DEFAULT_ACK_WAIT;
    }

    protected abstract void handleMessage(Message message);

    @EventListener(ApplicationReadyEvent.class)
    public void subscribe() {
        try {
            JetStream js = natsConnection.jetStream();

            // NATS Dispatcher manages threads internally
            dispatcher = natsConnection.createDispatcher();

            ConsumerConfiguration consumerConfig = buildConsumerConfig();

            PushSubscribeOptions pushOptions = PushSubscribeOptions.builder()
                    .stream(getStreamName())
                    .configuration(consumerConfig)
                    .build();

            subscription = js.subscribe(getSubject(), dispatcher, this::handleMessage, false, pushOptions);

            log.info("Subscribed to JetStream with Dispatcher: subject={} consumer={} (maxDeliver={}, ackWait={})",
                    getSubject(), getConsumerName(), getMaxDeliver(), getAckWait());

        } catch (Exception e) {
            log.error("Failed to subscribe to JetStream", e);
            throw new RuntimeException("Failed to subscribe to JetStream", e);
        }
    }

    protected boolean isLastAttempt(long deliveredCount) {
        return deliveredCount == getMaxDeliver();
    }

    private ConsumerConfiguration buildConsumerConfig() throws IOException, JetStreamApiException {
        JetStreamManagement jsm = natsConnection.jetStreamManagement();

        try {
            ConsumerInfo existingConsumer = jsm.getConsumerInfo(getStreamName(), getConsumerName());

            log.debug("Existing consumer config: {}", existingConsumer.getConsumerConfiguration());

            ConsumerConfiguration consumerConfig = buildConsumerConfiguration();

            log.debug("New consumer config: {}", consumerConfig);

            jsm.addOrUpdateConsumer(getStreamName(), consumerConfig);

            return consumerConfig;
        } catch (JetStreamApiException e) {
            if (e.getErrorCode() == 404) {
                log.debug("Consumer {} {} doesn't exist", getStreamName(), getConsumerName());
                ConsumerConfiguration consumerConfig = buildConsumerConfiguration();

                jsm.createConsumer(getStreamName(), consumerConfig);

                return consumerConfig;
            }
            throw new NatsException("Api error during consumer " + getStreamName() + " retrieve", e);
        }
    }

    private ConsumerConfiguration buildConsumerConfiguration() {
        return ConsumerConfiguration.builder()
                .durable(getConsumerName())
                .ackPolicy(AckPolicy.Explicit)
                .deliverPolicy(DeliverPolicy.All)
                .ackWait(getAckWait())
                .maxDeliver(getMaxDeliver())
                .filterSubject(getSubject())
                .deliverGroup(getDeliveryGroup())
                .deliverSubject(getDeliverySubject())
                .build();
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
