package com.openframe.data.nats.publisher;

import com.openframe.core.exception.NatsException;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.nats.model.NotificationEventType;
import com.openframe.data.nats.model.NotificationMessage;
import com.openframe.data.service.notification.NotificationContentRedactor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

import static java.lang.String.format;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class NotificationNatsPublisher {

    private static final String USER_TOPIC_TEMPLATE = "user.%s.notification";
    private static final String MACHINE_TOPIC_TEMPLATE = "machine.%s.notification";

    private final NatsMessagePublisher natsMessagePublisher;
    private final NotificationContentRedactor contentRedactor;

    public void publishToUser(String userId, Notification notification, NotificationCategory category,
                              boolean contentSuppressed) {
        publishToUser(userId, notification, category, NotificationEventType.CREATED, contentSuppressed);
    }

    public void publishToMachine(String machineId, Notification notification, NotificationCategory category,
                                 boolean contentSuppressed) {
        publishToMachine(machineId, notification, category, NotificationEventType.CREATED, contentSuppressed);
    }

    public void publishUpdateToUser(String userId, Notification notification, NotificationCategory category,
                                    boolean contentSuppressed) {
        publishToUser(userId, notification, category, NotificationEventType.UPDATED, contentSuppressed);
    }

    public void publishUpdateToMachine(String machineId, Notification notification, NotificationCategory category,
                                       boolean contentSuppressed) {
        publishToMachine(machineId, notification, category, NotificationEventType.UPDATED, contentSuppressed);
    }

    private void publishToUser(String userId, Notification notification, NotificationCategory category,
                               NotificationEventType eventType, boolean contentSuppressed) {
        if (isBlank(userId)) {
            throw new IllegalArgumentException("userId must not be blank when publishing to user subject");
        }
        String topic = format(USER_TOPIC_TEMPLATE, userId);
        publish(topic, notification, category, eventType, contentSuppressed);
    }

    private void publishToMachine(String machineId, Notification notification, NotificationCategory category,
                                  NotificationEventType eventType, boolean contentSuppressed) {
        if (isBlank(machineId)) {
            throw new IllegalArgumentException("machineId must not be blank when publishing to machine subject");
        }
        String topic = format(MACHINE_TOPIC_TEMPLATE, machineId);
        publish(topic, notification, category, eventType, contentSuppressed);
    }

    /**
     * READ/DELETED to the user's subject: ids only, no content — the client already holds the cards
     * and merely flips/removes them.
     */
    public void publishReadStateToUser(String userId, List<String> notificationIds,
                                       NotificationEventType eventType) {
        if (isBlank(userId)) {
            throw new IllegalArgumentException("userId must not be blank when publishing to user subject");
        }
        String topic = format(USER_TOPIC_TEMPLATE, userId);
        try {
            natsMessagePublisher.publish(topic, NotificationMessage.builder()
                    .eventType(eventType)
                    .notificationIds(List.copyOf(notificationIds))
                    .build());
        } catch (NatsException ex) {
            log.warn("NATS publish failed for {} read-state ids on {}: {}",
                    notificationIds.size(), topic, ex.getMessage());
        }
    }

    private void publish(String topic, Notification notification, NotificationCategory category,
                         NotificationEventType eventType, boolean contentSuppressed) {
        if (notification == null || notification.getId() == null) {
            throw new IllegalArgumentException("Notification must be persisted before publishing");
        }
        try {
            NotificationMessage message = buildMessage(notification, category, eventType, contentSuppressed);
            natsMessagePublisher.publish(topic, message);
        } catch (NatsException ex) {
            log.warn("NATS publish failed for notification {} on {}: {}",
                    notification.getId(), topic, ex.getMessage());
        }
    }

    private NotificationMessage buildMessage(Notification notification, NotificationCategory category,
                                             NotificationEventType eventType, boolean contentSuppressed) {
        return NotificationMessage.builder()
                .id(notification.getId())
                .severity(notification.getSeverity())
                .title(notification.getTitle())
                .description(contentRedactor.descriptionFor(notification, category, contentSuppressed))
                .createdAt(notification.getCreatedAt())
                .category(category)
                .context(notification.getContext())
                .eventType(eventType)
                .build();
    }
}
