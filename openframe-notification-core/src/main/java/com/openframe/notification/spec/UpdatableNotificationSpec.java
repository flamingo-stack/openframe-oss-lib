package com.openframe.notification.spec;

// Opt-in for types whose card keeps changing after it was sent; one-shot types implement
// NotificationTypeSpec alone.
public interface UpdatableNotificationSpec<S extends NotificationSeed> extends NotificationTypeSpec<S> {

    // Must be a key attrs() actually emits: the update path finds the stored row by it, and a
    // lookup key clients cannot see is exactly the hidden pointer this replaced.
    AttrKey sourceIdAttr();
}
