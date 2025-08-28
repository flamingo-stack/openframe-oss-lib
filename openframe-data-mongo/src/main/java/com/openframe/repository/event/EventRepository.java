package com.openframe.repository.event;

import com.openframe.documents.event.Event;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EventRepository extends MongoRepository<Event, String> {
}
