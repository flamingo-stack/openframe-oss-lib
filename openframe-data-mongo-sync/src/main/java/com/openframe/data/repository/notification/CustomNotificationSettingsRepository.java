package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationSettings;

import java.util.Collection;
import java.util.Optional;
import java.util.Set;

public interface CustomNotificationSettingsRepository {

    void setPushEnabled(String userId, boolean enabled);

    Optional<NotificationSettings> findByUserId(String userId);

    /** Only explicitly disabled users are returned — a user without a settings document is enabled. */
    Set<String> findPushDisabledUserIds(Collection<String> userIds);
}
