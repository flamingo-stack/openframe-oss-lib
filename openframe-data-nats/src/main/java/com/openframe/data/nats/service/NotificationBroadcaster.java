package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContextDescriptorRegistry;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.service.notification.NotificationReadStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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

    public Notification broadcast(NotificationCommand command) {
        Notification notification = Notification.builder()
                .severity(command.getSeverity())
                .title(command.getTitle())
                .description(command.getDescription())
                .context(command.getContext())
                .build();
        Notification saved = notificationRepository.save(notification);
        log.debug("Persisted notification {} (admins={}, machines={})",
                saved.getId(), command.getAdminAudience().size(), command.getMachineAudience().size());

        Set<String> admins = command.getAdminAudience();
        Set<String> machines = command.getMachineAudience();
        NotificationCategory category = descriptorRegistry.categoryOf(command.getContext().getType());
        try {
            if (!admins.isEmpty()) {
                readStateService.createForAudience(
                        saved.getId(), category, RecipientType.USER, admins);
            }
            if (!machines.isEmpty()) {
                readStateService.createForAudience(
                        saved.getId(), category, RecipientType.MACHINE, machines);
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
                publishSafely(() -> publisher.publishToUser(userId, saved), saved.getId(), "user", userId);
            }
            for (String machineId : machines) {
                publishSafely(() -> publisher.publishToMachine(machineId, saved), saved.getId(), "machine", machineId);
            }
        }, () -> log.debug("NATS publisher disabled — notification {} persisted only; clients reconcile via GraphQL catch-up", saved.getId()));

        return saved;
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
