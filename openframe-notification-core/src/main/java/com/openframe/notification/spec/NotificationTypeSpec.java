package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;

import java.util.Optional;
import java.util.Set;

public interface NotificationTypeSpec<S extends NotificationSeed> {

    NotificationType getType();

    Class<S> getSeedClass();

    // Pure seed → stored-attributes projection: the only place deciding what clients see.
    Attrs attrs(S seed);

    Optional<NotificationSettingGroup> getSettingsGroup();

    NotificationCategory getCategory();

    NotificationSeverity getSeverity();

    Audience audience(S seed);

    String composeTitle(S seed);

    String composeDescription(S seed);

    default Set<AttrKey> getPushActionKeys() {
        return Set.of();
    }

    // iOS action-button set, delivered as aps.category; empty = plain banner.
    default Optional<String> getPushCategory() {
        return Optional.empty();
    }

    // Transitional — deleted together with the legacy context classes; do not build on it.
    NotificationContext buildLegacyContext(S seed);
}
