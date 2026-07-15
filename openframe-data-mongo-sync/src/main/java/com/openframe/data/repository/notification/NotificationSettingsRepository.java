package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/** Bare {@link Repository}, not {@code MongoRepository}: inherited {@code count()} and {@code deleteAll()} are not tenant-scoped ({@code deleteAll()} would wipe every tenant's rows). */
@TenantAwareRepository
public interface NotificationSettingsRepository
        extends Repository<NotificationSettings, String>, CustomNotificationSettingsRepository {

    Optional<NotificationSettings> findByUserId(String userId);

    List<NotificationSettings> findByUserIdInAndPushEnabledFalse(Collection<String> userIds);

    /** Only explicitly disabled users are returned — a user without a settings document is enabled. */
    default Set<String> findPushDisabledUserIds(Collection<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Set.of();
        }
        return findByUserIdInAndPushEnabledFalse(userIds).stream()
                .map(NotificationSettings::getUserId)
                .collect(Collectors.toSet());
    }
}
