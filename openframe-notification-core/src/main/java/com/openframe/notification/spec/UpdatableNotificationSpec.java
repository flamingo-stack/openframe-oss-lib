package com.openframe.notification.spec;

/**
 * Opt-in capability for notification types whose card keeps changing after it was sent — the only
 * types {@code NotificationEmitter.update} accepts. One-shot types implement
 * {@link NotificationTypeSpec} alone and are untouched by this.
 */
public interface UpdatableNotificationSpec<S extends NotificationSeed> extends NotificationTypeSpec<S> {

    /**
     * Attribute holding the id of the source document this notification mirrors; the update path
     * finds the stored row by it. Must be a key {@link #attrs} actually emits — the lookup key is a
     * value clients can see too, never a hidden server-side pointer.
     */
    AttrKey sourceIdAttr();
}
