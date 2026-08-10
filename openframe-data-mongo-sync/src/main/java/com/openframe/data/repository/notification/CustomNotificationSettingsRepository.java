package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationSettingGroup;

import java.util.Map;

public interface CustomNotificationSettingsRepository {

    void saveSettings(String userId, boolean enabled, Map<NotificationSettingGroup, Boolean> typeSettings);
}
