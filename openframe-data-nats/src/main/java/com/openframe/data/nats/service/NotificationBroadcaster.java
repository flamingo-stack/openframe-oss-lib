package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationContextDescriptorRegistry;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import com.openframe.data.service.notification.NotificationReadStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static com.openframe.data.document.notification.NotificationSettingsPolicy.isEnabledFor;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationBroadcaster {

    private final NotificationRepository notificationRepository;
    private final NotificationReadStateService readStateService;
    private final NotificationContextDescriptorRegistry descriptorRegistry;
    private final Optional<NotificationNatsPublisher> natsPublisher;
    private final NotificationChannelDispatcher channelDispatcher;
    private final Optional<NotificationSettingsRepository> settingsRepository;

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

        Set<String> adminAudience = command.getAdminAudience();
        NotificationContext context = command.getContext();
        Set<String> admins = withoutOptedOut(adminAudience, context);
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

        if (!admins.isEmpty()) {
            channelDispatcher.dispatch(admins, saved, category);
        }

        return saved;
    }

    /** Settings bite at the audience: an opted-out admin gets no row/card/NATS/push and nothing arrives retroactively; absence and failures always deliver. */
    private Set<String> withoutOptedOut(Set<String> admins, NotificationContext context) {
        if (admins.isEmpty()) {
            return admins;
        }
        if (settingsRepository.isEmpty()) {
            return admins;
        }
        NotificationSettingGroup group = descriptorRegistry.settingsGroupOf(context);
        try {
            List<NotificationSettings> rows = settingsRepository.get().findByUserIdIn(admins);
            if (rows.isEmpty()) {
                return admins;
            }
            Set<String> kept = new HashSet<>(admins);
            for (NotificationSettings row : rows) {
                if (!isEnabledFor(row, group)) {
                    kept.remove(row.getUserId());
                }
            }
            return kept;
        } catch (RuntimeException ex) {
            log.warn("Notification settings lookup failed — delivering to all {} admin(s): {}",
                    admins.size(), ex.getMessage());
            return admins;
        }
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
            if (recipient.getStatus() == ReadStatus.DELETED) {
                // The recipient removed this card; re-publishing UPDATED would resurrect it on their client.
                continue;
            }
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
}
