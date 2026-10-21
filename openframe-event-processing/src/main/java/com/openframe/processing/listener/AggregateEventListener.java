package com.openframe.processing.listener;

import com.openframe.publishing.api.PublishedAggregateType;

// One per topic; EventListenerStartupCheck refuses to start when a processor's type has no listener.
public interface AggregateEventListener {

    PublishedAggregateType getType();
}
