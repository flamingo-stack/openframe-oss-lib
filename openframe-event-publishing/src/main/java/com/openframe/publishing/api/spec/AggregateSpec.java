package com.openframe.publishing.api.spec;


import java.util.List;

/**
 * Describes one published aggregate (document type): what its event looks like and which projections of it
 * other collections keep. One per type, as a Spring bean.
 */
public interface AggregateSpec<D, E extends PublishedEvent> {

    /** The type's name, for example organizations: its topic suffix, its outbox aggregateType and its config key. Lower case, digits and dashes. */
    String getType();

    /** Turns a saved document into the event other services receive; only the fields they need. */
    E toEvent(D document);

    /**
     * The projections of this document in other collections that this module can name, for example the organization name
     * on tickets. A projection in another library is a {@code Projection} bean of this spec's event class instead; the
     * registry adds it.
     */
    List<Projection<E, ?>> projections();
}
