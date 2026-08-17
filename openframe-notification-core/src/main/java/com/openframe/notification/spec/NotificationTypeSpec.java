package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;

import java.util.Optional;
import java.util.Set;

/**
 * One notification type, whole: producers hand the {@link Notifier} a type name plus seed facts
 * (ids and event-only values); everything else — snapshot enrichment, text, recipients,
 * classification — is declared here. {@link #enrich} is the only method allowed to do I/O; the
 * rest must stay pure functions of the enriched attributes, which is what makes a spec testable
 * without mocks.
 */
public interface NotificationTypeSpec {

    String type();

    /** The producer contract: ids plus event-only facts that cannot be re-fetched later. */
    Set<AttrKey> seedKeys();

    /** Snapshot at emission: fetch the referenced entities once and lay their facts into the map. */
    Attrs enrich(Attrs seed);

    /** Empty = no settings checkbox = the type cannot be muted. */
    Optional<NotificationSettingGroup> checkbox();

    NotificationCategory category();

    NotificationSeverity severity(Attrs attrs);

    Audience audience(Attrs attrs);

    Composed compose(Attrs attrs);

    /** Machine-facing wording; the live machine payload picks this up once per-class routing lands. */
    default Composed composeForMachine(Attrs attrs) {
        return compose(attrs);
    }

    /** Attributes that ride as flat push-payload keys for deep links once FCM reads attributes. */
    default Set<AttrKey> actionKeys() {
        return Set.of();
    }

    /**
     * Builds the legacy typed context from the enriched attributes so documents and NATS payloads
     * keep their current shape during the migration. Removed together with the context classes.
     */
    NotificationContext legacyContext(Attrs attrs);
}
