package com.openframe.data.document.notification;

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

    /**
     * Which "Notify about" checkbox governs this notification. Null (the default) means no checkbox:
     * the type cannot be muted and is always delivered — deliberately fail-open, so a type whose
     * descriptor forgot to map a group loses mutability, never delivery.
     */
    default NotificationSettingGroup settingsGroup(NotificationContext context) {
        return null;
    }
}
