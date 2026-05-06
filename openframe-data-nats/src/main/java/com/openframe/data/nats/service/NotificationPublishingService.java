package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.RecipientScope;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.repository.notification.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Persist-then-publish so a broker outage can't lose data — the fallback
 * scheduler picks up rows where {@code publishState.published = false}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationPublishingService {

    private final NotificationRepository notificationRepository;

    /** Optional — only registered when {@code spring.cloud.stream.enabled=true}. */
    private final ObjectProvider<NotificationNatsPublisher> notificationPublisher;

    public Notification create(Notification notification) {
        validate(notification);

        Notification saved = notificationRepository.save(notification);
        log.debug("Persisted notification {} (scope={}, user={}, machine={})",
                saved.getId(), saved.getRecipientScope(),
                saved.getRecipientUserId(), saved.getRecipientMachineId());

        NotificationNatsPublisher publisher = notificationPublisher.getIfAvailable();
        if (publisher == null) {
            log.debug("NATS publisher disabled — notification {} stays unpublished for fallback delivery", saved.getId());
            return saved;
        }

        return publisher.publish(saved);
    }

    /** Single chokepoint for shape invariants — the repository doesn't validate. */
    private static void validate(Notification notification) {
        if (notification == null) {
            throw new IllegalArgumentException("notification must not be null");
        }
        if (notification.getSeverity() == null) {
            // Severity has @Builder.Default, so null means the producer bypassed
            // the builder via a setter path. Surface it rather than break the
            // GraphQL non-null contract on read.
            throw new IllegalArgumentException("notification.severity must not be null");
        }
        if (isBlank(notification.getTitle())) {
            throw new IllegalArgumentException("notification.title must not be blank");
        }
        if (notification.getContext() == null) {
            throw new IllegalArgumentException("notification.context must not be null");
        }
        if (isBlank(notification.getContext().getType())) {
            throw new IllegalArgumentException("notification.context.type must not be blank");
        }
        RecipientScope scope = notification.getRecipientScope();
        if (scope == null) {
            throw new IllegalArgumentException("notification.recipientScope must not be null");
        }
        switch (scope) {
            case USER -> {
                if (isBlank(notification.getRecipientUserId())) {
                    throw new IllegalArgumentException("USER-scope notification requires recipientUserId");
                }
                if (notification.getRecipientMachineId() != null) {
                    throw new IllegalArgumentException("USER-scope notification must not carry recipientMachineId");
                }
            }
            case MACHINE -> {
                if (isBlank(notification.getRecipientMachineId())) {
                    throw new IllegalArgumentException("MACHINE-scope notification requires recipientMachineId");
                }
                if (notification.getRecipientUserId() != null) {
                    throw new IllegalArgumentException("MACHINE-scope notification must not carry recipientUserId");
                }
            }
            case ALL -> {
                if (notification.getRecipientUserId() != null || notification.getRecipientMachineId() != null) {
                    throw new IllegalArgumentException("ALL-scope notification must not carry recipientUserId or recipientMachineId");
                }
            }
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
