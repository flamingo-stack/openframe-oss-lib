package com.openframe.management.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.nats.model.DeviceOnlineEvent;
import com.openframe.management.service.DeviceOnlineScheduleTriggerService;
import io.nats.client.Connection;
import io.nats.client.Dispatcher;
import io.nats.client.Message;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Subscribes over <b>core NATS</b> to device offline→online events
 * ({@link DeviceOnlineEvent#SUBJECT}, relayed by the client service) and fires the machine's
 * ACTIVE, DEVICE_ONLINE-triggered schedules on that machine — see
 * {@link DeviceOnlineScheduleTriggerService}. Mirrors the client-side result listeners (raw
 * {@code Connection} dispatcher, no Spring Cloud Stream binding). Active only where the NATS
 * stack is enabled.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class DeviceOnlineNatsSubscriber {

    private final Connection natsConnection;
    private final ObjectMapper objectMapper;
    private final DeviceOnlineScheduleTriggerService triggerService;

    /** Queue group so exactly ONE management replica handles each event (no duplicate dispatch). */
    private static final String QUEUE_GROUP = "management-device-online";

    private Dispatcher dispatcher;

    @EventListener(ApplicationReadyEvent.class)
    public void subscribe() {
        try {
            dispatcher = natsConnection.createDispatcher();
            dispatcher.subscribe(DeviceOnlineEvent.SUBJECT, QUEUE_GROUP, this::handleMessage);
            log.info("Subscribed to device-online events: subject={} queue={}", DeviceOnlineEvent.SUBJECT, QUEUE_GROUP);
        } catch (Exception e) {
            log.error("Failed to subscribe to device-online events", e);
            throw new RuntimeException("Failed to subscribe to device-online events", e);
        }
    }

    private void handleMessage(Message message) {
        try {
            DeviceOnlineEvent event = objectMapper.readValue(message.getData(), DeviceOnlineEvent.class);
            triggerService.onDeviceOnline(event.getTenantId(), event.getMachineId());
        } catch (Exception e) {
            log.error("Failed to process device-online event from subject {}", message.getSubject(), e);
        }
    }

    @PreDestroy
    public void cleanup() {
        if (dispatcher != null) {
            try {
                dispatcher.drain(Duration.ofSeconds(5));
                log.info("Device-online dispatcher drained successfully");
            } catch (Exception e) {
                log.error("Error draining device-online dispatcher", e);
            }
        }
    }
}
