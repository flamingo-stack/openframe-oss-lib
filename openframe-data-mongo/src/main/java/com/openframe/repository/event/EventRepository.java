package com.openframe.repository.event;

import com.openframe.document.event.Event;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EventRepository extends MongoRepository<Event, String>, CustomEventRepository {
}
