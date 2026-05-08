package com.openframe.data.nats.publisher;

import com.openframe.core.exception.NatsException;
import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.Recipient;
import com.openframe.data.document.notification.UserRecipient;
import com.openframe.data.nats.model.NotificationMessage;
import com.openframe.data.repository.notification.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class NotificationNatsPublisher {

    private static final String USER_TOPIC_TEMPLATE = "user.%s.notification";
    private static final String MACHINE_TOPIC_TEMPLATE = "machine.%s.notification";
    private static final String BROADCAST_TOPIC = "notification.broadcast";

    private final NatsMessagePublisher natsMessagePublisher;
    private final NotificationRepository notificationRepository;

    public Notification publish(Notification notification) {
        if (notification == null || notification.getId() == null) {
            throw new IllegalArgumentException("Notification must be persisted before publishing");
        }

        try {
            natsMessagePublisher.publish(buildTopic(notification), buildMessage(notification));
        } catch (NatsException ex) {
            log.warn("Failed to publish notification {} to NATS, will rely on fallback scheduler: {}",
                    notification.getId(), ex.getMessage());
            return updatePublishState(notification, PublishState.nonPublished(notification.getPublishState()));
        }

        return updatePublishState(notification, PublishState.published());
    }

    private Notification updatePublishState(Notification notification, PublishState next) {
        notificationRepository.updatePublishState(notification.getId(), next);
        notification.setPublishState(next);
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
        Recipient recipient = notification.getRecipient();
        if (recipient == null) {
            throw new IllegalStateException("Notification recipient must not be null");
        }
        return switch (recipient) {
            case UserRecipient(String userId) -> format(USER_TOPIC_TEMPLATE, requireId(userId, "UserRecipient", "userId"));
            case MachineRecipient(String machineId) -> format(MACHINE_TOPIC_TEMPLATE, requireId(machineId, "MachineRecipient", "machineId"));
            case BroadcastRecipient ignored -> BROADCAST_TOPIC;
        };
    }

    private static String requireId(String value, String typeName, String fieldName) {
        if (isBlank(value)) {
            throw new IllegalStateException(typeName + " requires non-blank " + fieldName);
        }
        return value;
    }
}
