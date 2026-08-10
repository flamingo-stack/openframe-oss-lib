package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationSettingGroup;

import java.util.Map;

public interface CustomNotificationSettingsRepository {

    /** pushEnabled is written as a mirror of enabled so a rolled-back reader keeps honouring the switch. */
    void saveSettings(String userId, boolean enabled, Map<NotificationSettingGroup, Boolean> typeSettings);
}
