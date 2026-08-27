package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;

import java.util.Optional;

public interface NotificationTypeSpec<S extends NotificationSeed> {

    NotificationType getType();

    Class<S> getSeedClass();

    // Pure seed → stored-attributes projection: the only place deciding what clients see.
    Attrs attrs(S seed);

    Optional<NotificationSettingGroup> getSettingsGroup();

    NotificationCategory getCategory();

    /**
     * The entity this notification is about, or empty when it is about none. Deliberately abstract:
     * a default would let a spec ship without deciding, and the miss would surface much later as
     * "the badge on the ticket never lights up".
     */
    Optional<NotificationEntityRef> entity(S seed);

    NotificationSeverity getSeverity();

    Audience audience(S seed);

    String composeTitle(S seed);

    String composeDescription(S seed);

    // iOS action-button set, delivered as aps.category; empty = plain banner.
    Optional<String> getApplePushCategory();

    // Transitional — deleted together with the legacy context classes; do not build on it.
    NotificationContext buildLegacyContext(S seed);
}
