package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@TenantAwareRepository
public interface NotificationReadStateRepository
        extends MongoRepository<NotificationReadState, String>, CustomNotificationReadStateRepository {

    boolean existsByRecipientIdAndRecipientTypeAndStatus(String recipientId,
                                                         RecipientType recipientType,
                                                         ReadStatus status);

    List<NotificationReadState> findByNotificationId(String notificationId);

    @Query("{ 'recipientId': ?0, 'recipientType': ?1, 'notificationId': ?2, 'status': 'UNREAD' }")
    @Update(pipeline = "{ '$set': { 'status': 'READ', 'readAt': '$$NOW' } }")
    long markAsRead(String recipientId, RecipientType recipientType, String notificationId);

    @Query("{ 'recipientId': ?0, 'recipientType': ?1, 'status': 'UNREAD' }")
    @Update(pipeline = "{ '$set': { 'status': 'READ', 'readAt': '$$NOW' } }")
    long markAllAsRead(String recipientId, RecipientType recipientType);

    /**
     * Flips every recipient's UNREAD row for the given notification to READ in one bulk update.
     * Used to dismiss a notification from the active list for ALL recipients at once on a
     * lifecycle-resolve event, while it remains in history. Already-READ/DELETED rows are untouched.
     */
    @Query("{ 'notificationId': ?0, 'status': 'UNREAD' }")
    @Update(pipeline = "{ '$set': { 'status': 'READ', 'readAt': '$$NOW' } }")
    long markAllRecipientsRead(String notificationId);

    @Query("{ 'recipientId': ?0, 'recipientType': ?1, 'notificationId': ?2, 'status': { '$ne': 'DELETED' } }")
    @Update("{ '$set': { 'status': 'DELETED' } }")
    long softDelete(String recipientId, RecipientType recipientType, String notificationId);

    @Query("{ 'recipientId': ?0, 'recipientType': ?1, 'status': 'READ' }")
    @Update("{ '$set': { 'status': 'DELETED' } }")
    long softDeleteAllRead(String recipientId, RecipientType recipientType);

    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?2, 'recipientId': ?0, 'recipientType': ?1, 'status': 'UNREAD' } }",
            "{ '$group': { '_id': '$category', 'count': { '$sum': 1 } } }"
    })
    List<CategoryCount> unreadCountsByCategory(@Param("recipientId") String recipientId,
                                               @Param("recipientType") RecipientType recipientType,
                                               @Param("tenantId") String tenantId);
}
