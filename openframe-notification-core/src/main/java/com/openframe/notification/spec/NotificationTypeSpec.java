package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;

import java.util.Optional;

public interface NotificationTypeSpec<S extends NotificationSeed> {

    NotificationType getType();

    Class<S> getSeedClass();

    // Pure seed → stored-attributes projection: the only place deciding what clients see.
    Attrs attrs(S seed);

    Optional<NotificationSettingGroup> getSettingsGroup();

    NotificationCategory category(S seed);

    // Abstract on purpose — a default would let a spec ship with no entity and nobody would notice.
    Optional<NotificationEntityRef> entity(S seed);

    NotificationSeverity severity(S seed);

    Audience audience(S seed);

    String composeTitle(S seed);

    String composeDescription(S seed);

    // iOS action-button set, delivered as aps.category; empty = plain banner.
    Optional<String> getApplePushCategory();
}
