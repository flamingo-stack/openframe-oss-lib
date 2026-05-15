package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
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
        if (!admins.isEmpty()) {
            readStateService.createForAudience(
                    saved.getId(), command.getContext().getType(), RecipientType.USER, admins);
        }
        Set<String> machines = command.getMachineAudience();
        if (!machines.isEmpty()) {
            readStateService.createForAudience(
                    saved.getId(), command.getContext().getType(), RecipientType.MACHINE, machines);
        }

        natsPublisher.ifPresentOrElse(publisher -> {
            for (String userId : admins) {
                publisher.publishToUser(userId, saved);
            }
            for (String machineId : machines) {
                publisher.publishToMachine(machineId, saved);
            }
        }, () -> log.debug("NATS publisher disabled — notification {} persisted only; clients reconcile via GraphQL catch-up", saved.getId()));

        return saved;
    }
}
