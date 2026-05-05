package com.openframe.data.nats.publisher;

import com.openframe.core.exception.NatsException;
import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.RecipientScope;
import com.openframe.data.nats.model.NotificationMessage;
import com.openframe.data.repository.notification.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static java.lang.String.format;

/**
 * Best-effort NATS publish — failures are swallowed because the notification is
 * already persisted and will be retried by {@code NotificationNatsPublishFallbackScheduler}.
 * The returned notification carries the resulting {@link PublishState}; inspect
 * {@code getPublishState().isPublished()} to check synchronously.
 */
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

        return updatePublishState(notification, PublishState.published(notification.getPublishState()));
    }

    /**
     * Targeted {@code $set} so a concurrent writer doesn't clobber unrelated
     * fields under last-write-wins.
     */
    private Notification updatePublishState(Notification notification, PublishState next) {
        notificationRepository.updatePublishState(notification.getId(), next);
        notification.setPublishState(next);
        return notification;
    }

    private NotificationMessage buildMessage(Notification notification) {
        return NotificationMessage.builder()
                .id(notification.getId())
                .recipientScope(notification.getRecipientScope())
                .recipientUserId(notification.getRecipientUserId())
                .recipientMachineId(notification.getRecipientMachineId())
                .severity(notification.getSeverity())
                .title(notification.getTitle())
                .createdAt(notification.getCreatedAt())
                .context(notification.getContext())
                .build();
    }

    private String buildTopic(Notification notification) {
        RecipientScope scope = notification.getRecipientScope();
        if (scope == null) {
            scope = RecipientScope.USER;
        }
        return switch (scope) {
            case USER -> format(USER_TOPIC_TEMPLATE, requireId(notification.getRecipientUserId(), "USER", "recipientUserId"));
            case MACHINE -> format(MACHINE_TOPIC_TEMPLATE, requireId(notification.getRecipientMachineId(), "MACHINE", "recipientMachineId"));
            case ALL -> BROADCAST_TOPIC;
        };
    }

    private static String requireId(String value, String scopeName, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    "Notification with scope=" + scopeName + " requires non-blank " + fieldName);
        }
        return value;
    }
}
