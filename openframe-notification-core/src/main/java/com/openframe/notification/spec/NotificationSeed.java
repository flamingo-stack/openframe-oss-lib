package com.openframe.notification.spec;

// A seed carries everything its notification needs — the seed class is the compile-checked
// contract, and the producer fills it from entities it already holds at the emitting moment.
public interface NotificationSeed {

    NotificationType type();
}
