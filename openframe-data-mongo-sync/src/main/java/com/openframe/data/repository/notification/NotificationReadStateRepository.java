package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationReadState;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationReadStateRepository
        extends MongoRepository<NotificationReadState, String>, CustomNotificationReadStateRepository {
}
