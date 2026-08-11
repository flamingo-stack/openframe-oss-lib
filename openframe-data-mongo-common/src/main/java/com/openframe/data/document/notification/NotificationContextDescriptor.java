package com.openframe.data.document.notification;

import java.util.Optional;

public interface NotificationContextDescriptor {

    String type();

    Class<? extends NotificationContext> contextClass();

    default String graphqlTypeName() {
        return contextClass().getSimpleName();
    }

    default NotificationCategory category() {
        return NotificationCategory.GENERIC;
    }

    /**
     * Context-aware category resolution. Defaults to the static {@link #category()} so existing
     * descriptors keep their per-type category unchanged; descriptors whose category depends on the
     * notification instance (e.g. an approval that may reference a ticket) override this instead.
     */
    default NotificationCategory category(NotificationContext context) {
        return category();
    }

    /** Empty = no checkbox = cannot be muted — a type whose descriptor forgot the mapping loses mutability, never delivery. */
    default Optional<NotificationSettingGroup> settingsGroup() {
        return Optional.empty();
    }

    /** Mirrors the category pair: static mapping lives in {@link #settingsGroup()}; only payload-dependent descriptors override this. */
    default Optional<NotificationSettingGroup> settingsGroup(NotificationContext context) {
        return settingsGroup();
    }
}
