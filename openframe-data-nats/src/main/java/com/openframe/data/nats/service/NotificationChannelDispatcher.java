package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.nats.channel.NotificationChannel;
import com.openframe.data.nats.config.NotificationChannelExecutorConfig;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import com.openframe.data.service.notification.NotificationReadStateService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * A separate bean, not a method on NotificationBroadcaster: @Async only fires through a Spring proxy,
 * so a self-invoked @Async method would run inline on the caller's thread — the very thing this moves
 * off it. A channel does blocking network I/O; the notification is already persisted and on the socket.
 */
@Service
@Slf4j
public class NotificationChannelDispatcher {

    private final List<NotificationChannel> channels;
    private final Optional<NotificationSettingsRepository> settingsRepository;
    private final NotificationReadStateService readStateService;

    /**
     * STOPGAP until real user presence lands: wait this long, then skip recipients whose read-state is
     * no longer UNREAD — a user active in the browser reads the socket notification within the window
     * and is spared the phone buzz. 0 disables it. A pod restart inside the window drops the push.
     */
    @Value("${openframe.push.web-grace-seconds:15}")
    private long webGraceSeconds;

    public NotificationChannelDispatcher(List<NotificationChannel> channels,
                                         Optional<NotificationSettingsRepository> settingsRepository,
                                         NotificationReadStateService readStateService) {
        this.channels = channels;
        this.settingsRepository = settingsRepository;
        this.readStateService = readStateService;
        log.info("Notification out-of-band channels active: {}",
                channels.stream().map(NotificationChannel::name).toList());
    }

    @Async(NotificationChannelExecutorConfig.CHANNEL_EXECUTOR)
    public void dispatch(Set<String> userIds, Notification notification, NotificationCategory category) {
        if (channels.isEmpty()) {
            return;
        }
        if (!awaitGrace()) {
            return;
        }
        Set<String> recipients = stillUnread(withoutMuted(userIds), notification);
        channels.forEach(channel ->
                recipients.forEach(userId -> deliverSafely(channel, userId, notification, category)));
    }

    /** One parked virtual thread per notification — cheap. False only on interrupt (shutdown): drop, don't half-send. */
    private boolean awaitGrace() {
        if (webGraceSeconds <= 0) {
            return true;
        }
        try {
            Thread.sleep(Duration.ofSeconds(webGraceSeconds));
            return true;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /** Absence of a settings document means enabled, so a failed lookup also defaults to enabled. */
    private Set<String> withoutMuted(Set<String> userIds) {
        if (settingsRepository.isEmpty()) {
            return userIds;
        }
        try {
            Set<String> disabled = settingsRepository.get().findPushDisabledUserIds(userIds);
            if (disabled.isEmpty()) {
                return userIds;
            }
            Set<String> kept = new HashSet<>(userIds);
            kept.removeAll(disabled);
            return kept;
        } catch (RuntimeException ex) {
            log.warn("Notification settings lookup failed — dispatching to all {} recipient(s): {}",
                    userIds.size(), ex.getMessage());
            return userIds;
        }
    }

    /** Fail-open: if the read-state lookup breaks, deliver to everyone rather than silently drop. */
    private Set<String> stillUnread(Set<String> userIds, Notification saved) {
        if (webGraceSeconds <= 0 || userIds.isEmpty()) {
            return userIds;
        }
        try {
            // Remove only recipients who EXPLICITLY read/dismissed it — a missing record keeps the push
            // (fail-open). retaining only UNREAD rows would silently drop anyone whose row lagged.
            Set<String> alreadyRead = readStateService.findRecipients(saved.getId()).stream()
                    .filter(r -> r.getRecipientType() == RecipientType.USER)
                    .filter(r -> r.getStatus() != ReadStatus.UNREAD)
                    .map(NotificationReadState::getRecipientId)
                    .collect(Collectors.toSet());
            Set<String> kept = new HashSet<>(userIds);
            kept.removeAll(alreadyRead);
            if (kept.size() < userIds.size()) {
                log.debug("Grace window: {} of {} recipient(s) already read notification {} — push skipped for them",
                        userIds.size() - kept.size(), userIds.size(), saved.getId());
            }
            return kept;
        } catch (RuntimeException ex) {
            log.warn("Read-state lookup failed after grace window — dispatching to all {} recipient(s): {}",
                    userIds.size(), ex.getMessage());
            return userIds;
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
