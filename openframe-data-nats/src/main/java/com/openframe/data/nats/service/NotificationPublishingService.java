package com.openframe.data.nats.service;

import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.Recipient;
import com.openframe.data.document.notification.UserRecipient;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.repository.notification.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationPublishingService {

    private final NotificationRepository notificationRepository;

    private final Optional<NotificationNatsPublisher> notificationPublisher;

    public Notification create(Notification notification) {
        validate(notification);

        Notification saved = notificationRepository.save(notification);
        log.debug("Persisted notification {} (recipient={})", saved.getId(), saved.getRecipient());

        return notificationPublisher
                .map(publisher -> publisher.publish(saved))
                .orElseGet(() -> {
                    log.debug("NATS publisher disabled — notification {} stays unpublished for fallback delivery", saved.getId());
                    return saved;
                });
    }

    private static void validate(Notification notification) {
        if (notification == null) {
            throw new IllegalArgumentException("notification must not be null");
        }
        if (notification.getSeverity() == null) {
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
        Recipient recipient = notification.getRecipient();
        if (recipient == null) {
            throw new IllegalArgumentException("notification.recipient must not be null");
        }
        switch (recipient) {
            case UserRecipient(String userId) -> {
                if (isBlank(userId)) {
                    throw new IllegalArgumentException("UserRecipient requires non-blank userId");
                }
            }
            case MachineRecipient(String machineId) -> {
                if (isBlank(machineId)) {
                    throw new IllegalArgumentException("MachineRecipient requires non-blank machineId");
                }
            }
            case BroadcastRecipient ignored -> {
            }
        }
    }
}
