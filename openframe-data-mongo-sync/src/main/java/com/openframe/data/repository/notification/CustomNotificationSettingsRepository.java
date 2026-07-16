package com.openframe.data.repository.notification;

public interface CustomNotificationSettingsRepository {

    void setPushEnabled(String userId, boolean enabled);
}
