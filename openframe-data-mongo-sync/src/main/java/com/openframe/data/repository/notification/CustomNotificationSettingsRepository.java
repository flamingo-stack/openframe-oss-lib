package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationSettingGroup;

import java.util.Set;

public interface CustomNotificationSettingsRepository {

    void saveSettings(String userId, boolean enabled, Set<NotificationSettingGroup> mutedGroups);
}
