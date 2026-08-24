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

    // Pure seed → stored-attributes mapping. No I/O in specs: the seed arrives self-contained,
    // and a fetch here would re-read what the producer already held at the emitting moment.
    Attrs attrs(S seed);

    Optional<NotificationSettingGroup> getSettingsGroup();

    NotificationCategory getCategory();

    NotificationSeverity getSeverity();

    Audience audience(S seed);

    NotificationText compose(Attrs attrs);

    default NotificationText composeForMachine(Attrs attrs) {
        return compose(attrs);
    }

    default Set<AttrKey> getPushActionKeys() {
        return Set.of();
    }

    // Transitional — deleted together with the legacy context classes; do not build on it.
    NotificationContext buildLegacyContext(Attrs attrs);
}
