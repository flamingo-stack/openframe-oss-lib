package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationSettingGroup;

import java.util.Map;

public interface CustomNotificationSettingsRepository {

    /**
     * Full-state upsert (the settings modal saves everything at once). {@code pushEnabled} is written
     * as a mirror of {@code enabled} so not-yet-redeployed readers keep honouring the master switch.
     */
    void saveSettings(String userId, boolean enabled, Map<NotificationSettingGroup, Boolean> typeSettings);
}
