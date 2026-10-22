package com.openframe.publishing.api.spec;

import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult;

import java.util.List;

/**
 * A projection of a document in another collection, for example the organization name kept on every ticket.
 */
public interface Projection<E extends PublishedEvent, T> {

    /** A unique name for this projection; it switches the projection on in config and labels its job and metrics. */
    String name();

    /** Updates this projection when the source document changes, for example the organization name on its tickets. */
    void apply(PublishedRecord<E> record);

    /** Counts the items this event would change, stopping at limit; at the limit the update runs in batches instead of apply. */
    long countChanges(PublishedRecord<E> record, int limit);

    /** Changes up to batchSize items after lastId (null for the first batch), in _id order; returns the last _id changed, or null when none is left. */
    String applyBatch(PublishedRecord<E> record, String lastId, int batchSize);

    /** The documents that hold this projection, for example Ticket.class; the reconciliation job reads their collection in batches. */
    Class<?> projectedClass();

    /** Only the fields reconcile needs, for example a ticket's id, tenant and organization; the job reads just these. */
    Class<T> projectedViewClass();

    /** Returns the projected items that no longer match their source, for example tickets with an old name. */
    ReconciliationResult reconcile(List<T> projectedItems);
}
