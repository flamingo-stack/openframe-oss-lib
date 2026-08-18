package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;

import java.util.Optional;
import java.util.Set;

public interface NotificationTypeSpec {

    NotificationType getType();

    Set<AttrKey> getRequiredKeys();

    // Facts that may legitimately be absent (e.g. no acting user on system transitions).
    default Set<AttrKey> getOptionalKeys() {
        return Set.of();
    }

    // Empty = no settings checkbox = the type cannot be muted (same contract as the legacy descriptors).
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

    // Transitional — deleted together with the context classes; do not build on it.
    NotificationContext buildLegacyContext(Attrs attrs);
}
