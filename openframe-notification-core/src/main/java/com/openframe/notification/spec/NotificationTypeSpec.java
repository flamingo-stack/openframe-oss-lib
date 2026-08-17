package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;

import java.util.Optional;
import java.util.Set;

// One notification type, whole: enrich() is the only method allowed to do I/O; the rest stay pure
// functions of the enriched attributes — that is what makes a spec testable without mocks.
public interface NotificationTypeSpec {

    String type();

    // The producer contract: ids plus event-only facts that cannot be re-fetched later.
    Set<AttrKey> seedKeys();

    Attrs enrich(Attrs seed);

    // Empty = no settings checkbox = the type cannot be muted (same contract as the legacy descriptors).
    Optional<NotificationSettingGroup> checkbox();

    NotificationCategory category();

    NotificationSeverity severity(Attrs attrs);

    Audience audience(Attrs attrs);

    Composed compose(Attrs attrs);

    // Machine-facing wording; picked up by the live machine payload once per-class routing lands.
    default Composed composeForMachine(Attrs attrs) {
        return compose(attrs);
    }

    // Attributes that ride as flat push-payload keys for deep links once FCM reads attributes.
    default Set<AttrKey> actionKeys() {
        return Set.of();
    }

    // Keeps documents/NATS in their current shape during the migration; deleted with the context classes.
    NotificationContext legacyContext(Attrs attrs);
}
