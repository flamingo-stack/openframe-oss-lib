package com.openframe.data.nats.publisher;

import com.openframe.core.exception.NatsException;
import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.UserRecipient;
import com.openframe.data.nats.model.NotificationMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class NotificationNatsPublisher {

    private static final String USER_TOPIC_TEMPLATE = "user.%s.notification";
    private static final String MACHINE_TOPIC_TEMPLATE = "machine.%s.notification";
    private static final String BROADCAST_TOPIC = "notification.broadcast";

    private final NatsMessagePublisher natsMessagePublisher;

    public Notification publish(Notification notification) {
        if (notification == null || notification.getId() == null) {
            throw new IllegalArgumentException("Notification must be persisted before publishing");
        }

        try {
            natsMessagePublisher.publishPersistent(buildTopic(notification), buildMessage(notification));
        } catch (NatsException ex) {

            log.warn("JetStream publish failed for notification {}: {}", notification.getId(), ex.getMessage());
        }

        return notification;
    }

    private NotificationMessage buildMessage(Notification notification) {
        return NotificationMessage.builder()
                .id(notification.getId())
                .severity(notification.getSeverity())
                .title(notification.getTitle())
                .createdAt(notification.getCreatedAt())
                .context(notification.getContext())
                .build();
    }

    private String buildTopic(Notification notification) {
        return switch (notification.getRecipient()) {
            case UserRecipient(String userId) -> format(USER_TOPIC_TEMPLATE, userId);
            case MachineRecipient(String machineId) -> format(MACHINE_TOPIC_TEMPLATE, machineId);
            case BroadcastRecipient ignored -> BROADCAST_TOPIC;
        };
    }
}
