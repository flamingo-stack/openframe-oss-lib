package com.openframe.notification.service;

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
import com.openframe.notification.spec.AudienceResolver;
import com.openframe.notification.spec.NotificationEntityRef;
import com.openframe.notification.spec.NotificationType;
import com.openframe.notification.spec.Recipients;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import com.openframe.notification.readstate.NotificationReadStateService;
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
    private final AudienceResolver audienceResolver;
    private final NotificationSettingsRepository settingsRepository;

    @Value("${openframe.features.notifications.enabled:false}")
    private boolean notificationsEnabled;

    public Notification broadcast(NotificationCommand command) {
        if (!notificationsEnabled) {
            log.debug("Notifications feature disabled — broadcast skipped (no persistence, no NATS publish)");
            return null;
        }

        NotificationCategory category = categoryOf(command);
        Recipients recipients = audienceResolver.resolve(command.getAudience());
        Set<String> adminAudience = recipients.getUsers();
        NotificationContext context = command.getContext();
        Set<String> admins = withoutOptedOut(adminAudience, command);
        Set<String> machines = recipients.getMachines();
        if (admins.isEmpty() && machines.isEmpty()) {
            log.info("No recipients left after settings filtering — nothing persisted for '{}'", command.getTitle());
            return null;
        }

        NotificationType commandType = command.getType();
        String typeName = commandType == null ? null : commandType.name();
        Notification notification = Notification.builder()
                .severity(command.getSeverity())
                .category(category)
                .title(command.getTitle())
                .description(command.getDescription())
                .type(typeName)
                .attributes(command.getAttributes())
                .applePushCategory(command.getApplePushCategory())
                .context(command.getContext())
                .correlationId(command.getCorrelationId())
                .build();
        Notification saved = notificationRepository.save(notification);
        log.debug("Persisted notification {} (admins={}, machines={})",
                saved.getId(), admins.size(), machines.size());

        String title = command.getTitle();
        try {
            NotificationEntityRef entity = command.getEntity();
            if (!admins.isEmpty()) {
                readStateService.createForAudience(
                        saved.getId(), category, title, entity, RecipientType.USER, admins);
            }
            if (!machines.isEmpty()) {
                readStateService.createForAudience(
                        saved.getId(), category, title, entity, RecipientType.MACHINE, machines);
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

    /**
     * The spec decides; the context descriptor is only the fallback for legacy dispatchers that build
     * a command by hand. Both must agree while the two paths coexist — a parity test in the tenant
     * catalog pins that, because a silent divergence here changes who receives what.
     */
    private NotificationCategory categoryOf(NotificationCommand command) {
        NotificationCategory category = command.getCategory();
        return category != null ? category : descriptorRegistry.categoryOf(command.getContext());
    }

    private NotificationSettingGroup settingsGroupOf(NotificationCommand command) {
        NotificationSettingGroup group = command.getSettingsGroup();
        return group != null ? group : descriptorRegistry.settingsGroupOf(command.getContext()).orElse(null);
    }

    /** Settings bite at the audience: an opted-out admin gets no row/card/NATS/push and nothing arrives retroactively. Absent settings deliver; a failed lookup drops every admin — like every other Mongo failure in broadcast, it must not deliver against unknown preferences. */
    private Set<String> withoutOptedOut(Set<String> admins, NotificationCommand command) {
        if (admins.isEmpty()) {
            return admins;
        }
        try {
            NotificationSettingGroup group = settingsGroupOf(command);
            List<NotificationSettings> rows = settingsRepository.findByUserIdIn(admins);
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
            log.error("Notification settings resolution failed — dropping all {} admin(s) from this dispatch", admins.size(), ex);
            return Set.of();
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
