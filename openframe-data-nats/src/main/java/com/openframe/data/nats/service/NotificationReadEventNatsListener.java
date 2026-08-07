package com.openframe.data.nats.service;

import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.nats.model.NotificationEventType;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.service.notification.NotificationReadEvent;
import com.openframe.data.service.notification.NotificationReadEventListener;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Relays persisted read/dismiss transitions to the recipient's NATS subject so every open web
 * tab/device updates live. Default OFF: a web client that predates the READ/DELETED event types
 * treats them as CREATED and resurrects the card — flip the flag only after the frontend handler
 * ships.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.notifications.read-events.enabled", havingValue = "true")
public class NotificationReadEventNatsListener implements NotificationReadEventListener {

    private final Optional<NotificationNatsPublisher> natsPublisher;

    @Override
    public void onReadStateChanged(NotificationReadEvent event) {
        if (event.recipientType() != RecipientType.USER) {
            return;
        }
        natsPublisher.ifPresent(publisher -> publisher.publishReadStateToUser(
                event.recipientId(), event.notificationIds(), eventType(event)));
    }

    private static NotificationEventType eventType(NotificationReadEvent event) {
        return event.transition() == NotificationReadEvent.Transition.DELETED
                ? NotificationEventType.DELETED
                : NotificationEventType.READ;
    }
}
