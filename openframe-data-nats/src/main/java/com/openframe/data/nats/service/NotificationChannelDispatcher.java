package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.nats.channel.NotificationChannel;
import com.openframe.data.nats.config.NotificationChannelExecutorConfig;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

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

    public NotificationChannelDispatcher(List<NotificationChannel> channels,
                                         Optional<NotificationSettingsRepository> settingsRepository) {
        this.channels = channels;
        this.settingsRepository = settingsRepository;
        log.info("Notification out-of-band channels active: {}",
                channels.stream().map(NotificationChannel::name).toList());
    }

    @Async(NotificationChannelExecutorConfig.CHANNEL_EXECUTOR)
    public void dispatch(Set<String> userIds, Notification notification, NotificationCategory category) {
        if (channels.isEmpty()) {
            return;
        }
        Set<String> recipients = withoutMuted(userIds);
        channels.forEach(channel ->
                recipients.forEach(userId -> deliverSafely(channel, userId, notification, category)));
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
