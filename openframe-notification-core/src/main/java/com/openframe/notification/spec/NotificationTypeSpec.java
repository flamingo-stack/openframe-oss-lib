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

    // The single I/O method: resolves the seed's ids into the full attribute snapshot.
    // Everything below runs on its result and must stay pure.
    Attrs enrich(S seed);

    Optional<NotificationSettingGroup> getSettingsGroup();

    NotificationCategory getCategory();

    NotificationSeverity getSeverity();

    Audience audience(Attrs attrs);

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
