package com.openframe.data.repository.event;

import com.openframe.data.document.event.Event;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EventRepository extends MongoRepository<Event, String>, CustomEventRepository {
}
