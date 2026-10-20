package com.openframe.publishing.api;

// One per published aggregate, like DeliverySpec and NotificationTypeSpec. toEvent decides what consumers see.
public interface PublishedAggregateSpec<D, E extends PublishedEvent> {

    PublishedAggregateType getType();

    E toEvent(D document);
}
