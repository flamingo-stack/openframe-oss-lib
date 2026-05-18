package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.Notification;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRepository extends MongoRepository<Notification, String>, CustomNotificationRepository {
}
