package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

/** Bare {@link Repository}, not {@code MongoRepository}: the inherited {@code count()} is not tenant-scoped. */
@TenantAwareRepository
public interface NotificationSettingsRepository
        extends Repository<NotificationSettings, String>, CustomNotificationSettingsRepository {
}
