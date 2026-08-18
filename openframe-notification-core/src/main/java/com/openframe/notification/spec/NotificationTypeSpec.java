package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;

import java.util.Optional;
import java.util.Set;

public interface NotificationTypeSpec {

    String type();

    Set<AttrKey> seedKeys();

    // Facts that may legitimately be absent (e.g. no acting user on system transitions).
    default Set<AttrKey> optionalSeedKeys() {
        return Set.of();
    }

    Attrs enrich(Attrs seed);

    // Empty = no settings checkbox = the type cannot be muted (same contract as the legacy descriptors).
    Optional<NotificationSettingGroup> checkbox();

    NotificationCategory category();

    NotificationSeverity severity(Attrs attrs);

    Audience audience(Attrs attrs);

    Composed compose(Attrs attrs);

    default Composed composeForMachine(Attrs attrs) {
        return compose(attrs);
    }

    default Set<AttrKey> actionKeys() {
        return Set.of();
    }

    // Transitional — deleted together with the context classes; do not build on it.
    NotificationContext legacyContext(Attrs attrs);
}
