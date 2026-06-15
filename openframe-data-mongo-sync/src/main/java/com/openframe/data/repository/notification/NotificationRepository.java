package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@TenantAwareRepository
public interface NotificationRepository extends MongoRepository<Notification, String>, CustomNotificationRepository {

    Optional<Notification> findByCorrelationId(String correlationId);
}
