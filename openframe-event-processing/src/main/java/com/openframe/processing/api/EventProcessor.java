package com.openframe.processing.api;

import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedEvent;
import com.openframe.publishing.api.PublishedRecord;

// One cascade: what an event of its aggregate type changes elsewhere. The runner, the registry and the mode know only this.
public interface EventProcessor<E extends PublishedEvent> {

    // Unique: the key of its mode under openframe.events.processing.processors, its metrics tag, and its name in DLT messages.
    String name();

    PublishedAggregateType getType();

    // Never a delete; the version is for its guard. Returns the rows it wrote, for its metrics.
    long process(PublishedRecord<E> record);
}
