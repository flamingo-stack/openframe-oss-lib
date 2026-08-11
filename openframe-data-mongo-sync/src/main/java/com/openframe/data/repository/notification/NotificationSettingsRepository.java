package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Bare {@link Repository}, not {@code MongoRepository}: inherited {@code count()} and {@code deleteAll()} are not tenant-scoped ({@code deleteAll()} would wipe every tenant's rows). */
@TenantAwareRepository
public interface NotificationSettingsRepository
        extends Repository<NotificationSettings, String>, CustomNotificationSettingsRepository {

    Optional<NotificationSettings> findByUserId(String userId);

    /** Only users with a document come back — everyone else is on defaults (everything enabled). */
    List<NotificationSettings> findByUserIdIn(Collection<String> userIds);
}
