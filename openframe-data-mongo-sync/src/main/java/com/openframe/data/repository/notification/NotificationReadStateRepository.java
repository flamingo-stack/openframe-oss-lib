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
     * Flips every recipient's non-DELETED row for the given notification to DELETED in one bulk
     * update — moving it out of the active list into history for ALL recipients at once. Used on a
     * shared lifecycle-resolve event (e.g. an approval resolved by one admin completes it for
     * everyone). DELETED is what actually removes it from the active list: that list filters
     * {@code status != DELETED}, so a READ row would still show. Already-DELETED rows are untouched.
     */
    @Query("{ 'notificationId': ?0, 'status': { '$ne': 'DELETED' } }")
    @Update("{ '$set': { 'status': 'DELETED' } }")
    long softDeleteAllRecipients(String notificationId);

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
