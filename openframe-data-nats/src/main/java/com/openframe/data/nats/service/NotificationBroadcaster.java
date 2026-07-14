package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContextDescriptorRegistry;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.nats.channel.NotificationChannel;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.service.notification.NotificationReadStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationBroadcaster {

    private final NotificationRepository notificationRepository;
    private final NotificationReadStateService readStateService;
    private final NotificationContextDescriptorRegistry descriptorRegistry;
    private final Optional<NotificationNatsPublisher> natsPublisher;
    private final List<NotificationChannel> channels;

    @Value("${openframe.features.notifications.enabled:false}")
    private boolean notificationsEnabled;

    public Notification broadcast(NotificationCommand command) {
        if (!notificationsEnabled) {
            log.debug("Notifications feature disabled — broadcast skipped (no persistence, no NATS publish)");
            return null;
        }

        NotificationCategory category = descriptorRegistry.categoryOf(command.getContext());
        Notification notification = Notification.builder()
                .severity(command.getSeverity())
                .category(category)
                .title(command.getTitle())
                .description(command.getDescription())
                .context(command.getContext())
                .correlationId(command.getCorrelationId())
                .build();
        Notification saved = notificationRepository.save(notification);
        log.debug("Persisted notification {} (admins={}, machines={})",
                saved.getId(), command.getAdminAudience().size(), command.getMachineAudience().size());

        Set<String> admins = command.getAdminAudience();
        Set<String> machines = command.getMachineAudience();
        String title = command.getTitle();
        try {
            if (!admins.isEmpty()) {
                readStateService.createForAudience(
                        saved.getId(), category, title, RecipientType.USER, admins);
            }
            if (!machines.isEmpty()) {
                readStateService.createForAudience(
                        saved.getId(), category, title, RecipientType.MACHINE, machines);
            }
        } catch (RuntimeException ex) {
            log.error("createForAudience failed for notification {} (admins={}, machines={}); "
                            + "deleting orphaned notification doc to keep storage consistent — caller must retry",
                    saved.getId(), admins.size(), machines.size(), ex);
            try {
                notificationRepository.deleteById(saved.getId());
            } catch (RuntimeException cleanupEx) {
                log.error("orphan cleanup of notification {} ALSO failed — manual intervention required",
                        saved.getId(), cleanupEx);
            }
            throw ex;
        }

        natsPublisher.ifPresentOrElse(publisher -> {
            for (String userId : admins) {
                publishSafely(() -> publisher.publishToUser(userId, saved, category), saved.getId(), "user", userId);
            }
            for (String machineId : machines) {
                publishSafely(() -> publisher.publishToMachine(machineId, saved, category), saved.getId(), "machine", machineId);
            }
        }, () -> log.debug("NATS publisher disabled — notification {} persisted only; clients reconcile via GraphQL catch-up", saved.getId()));

        // Admins only — machines are agents, not phones or Slack accounts.
        channels.forEach(channel ->
                admins.forEach(userId -> deliverSafely(channel, userId, saved, category)));

        return saved;
    }

    /**
     * Persists an in-place change to an already-broadcast notification and re-publishes it (UPDATED)
     * to its original recipients so live clients upsert the existing card by id. Read-state rows are
     * left untouched — only the notification content changes.
     */
    public void update(Notification updated) {
        if (!notificationsEnabled) {
            log.debug("Notifications feature disabled — update skipped");
            return;
        }

        Notification saved = notificationRepository.save(updated);
        NotificationCategory category = saved.getCategory();

        natsPublisher.ifPresentOrElse(
                publisher -> republishToRecipients(publisher, saved, category),
                () -> log.debug("NATS publisher disabled — notification {} updated in DB only", saved.getId()));
    }

    private void republishToRecipients(NotificationNatsPublisher publisher, Notification saved, NotificationCategory category) {
        List<NotificationReadState> recipients = readStateService.findRecipients(saved.getId());
        for (NotificationReadState recipient : recipients) {
            publishUpdateSafely(publisher, saved, category, recipient);
        }
    }

    private void publishUpdateSafely(NotificationNatsPublisher publisher, Notification saved,
                                     NotificationCategory category, NotificationReadState recipient) {
        String recipientId = recipient.getRecipientId();
        if (recipient.getRecipientType() == RecipientType.MACHINE) {
            publishSafely(() -> publisher.publishUpdateToMachine(recipientId, saved, category),
                    saved.getId(), "machine", recipientId);
        } else {
            publishSafely(() -> publisher.publishUpdateToUser(recipientId, saved, category),
                    saved.getId(), "user", recipientId);
        }
    }

    private void publishSafely(Runnable publish, String notificationId, String recipientKind, String recipientId) {
        try {
            publish.run();
        } catch (RuntimeException ex) {
            log.warn("NATS publish to {}={} for notification {} failed; recipient will catch up via GraphQL: {}",
                    recipientKind, recipientId, notificationId, ex.getMessage());
        }
    }

    private void deliverSafely(NotificationChannel channel, String userId, Notification saved,
                               NotificationCategory category) {
        try {
            channel.deliver(userId, saved, category);
        } catch (RuntimeException ex) {
            log.warn("Channel {} failed for user={} on notification {} — swallowed, in-app delivery is unaffected: {}",
                    channel.name(), userId, saved.getId(), ex.getMessage());
        }
    }
}
