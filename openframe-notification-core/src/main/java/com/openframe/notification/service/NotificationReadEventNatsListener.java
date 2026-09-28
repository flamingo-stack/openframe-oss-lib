package com.openframe.notification.service;

import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.nats.model.NotificationEventType;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.notification.readstate.NotificationReadEvent;
import com.openframe.notification.readstate.NotificationReadEventListener;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Relays persisted read/dismiss transitions to the recipient's NATS subject so every open web
 * tab/device updates live. Deliberately id-less at the top level (only notificationIds): a web
 * client that predates READ/DELETED drops such payloads at its missing-id guard instead of
 * rendering them — do not add a top-level id without checking that guard.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class NotificationReadEventNatsListener implements NotificationReadEventListener {

    private final NotificationNatsPublisher natsPublisher;

    @Override
    public void onReadStateChanged(NotificationReadEvent event) {
        if (event.recipientType() != RecipientType.USER) {
            return;
        }
        natsPublisher.publishReadStateToUser(event.recipientId(), event.notificationIds(), eventType(event));
    }

    private static NotificationEventType eventType(NotificationReadEvent event) {
        return event.transition() == NotificationReadEvent.Transition.DELETED
                ? NotificationEventType.DELETED
                : NotificationEventType.READ;
    }
}
