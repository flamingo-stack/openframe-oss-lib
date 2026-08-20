package com.openframe.notification.spec;

// A seed carries ids + event-only facts (things only the emitting moment knows: the actor, the
// previous status). Snapshot facts (titles, names, …) are the spec's enrich() job — a snapshot
// field added here duplicates enrich and goes stale the moment the entity changes.
public interface NotificationSeed {

    NotificationType type();
}
