package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationReadStateRepository
        extends MongoRepository<NotificationReadState, String>, CustomNotificationReadStateRepository {

    boolean existsByRecipientIdAndRecipientTypeAndStatus(String recipientId,
                                                         RecipientType recipientType,
                                                         ReadStatus status);

    @Query("{ 'recipientId': ?0, 'recipientType': ?1, 'notificationId': ?2, 'status': 'UNREAD' }")
    @Update("{ '$set': { 'status': 'READ', 'readAt': '$$NOW' } }")
    long markAsRead(String recipientId, RecipientType recipientType, String notificationId);

    @Query("{ 'recipientId': ?0, 'recipientType': ?1, 'status': 'UNREAD' }")
    @Update("{ '$set': { 'status': 'READ', 'readAt': '$$NOW' } }")
    long markAllAsRead(String recipientId, RecipientType recipientType);

    @Query("{ 'recipientId': ?0, 'recipientType': ?1, 'notificationId': ?2, 'status': { '$ne': 'DELETED' } }")
    @Update("{ '$set': { 'status': 'DELETED' } }")
    long softDelete(String recipientId, RecipientType recipientType, String notificationId);

    @Query("{ 'recipientId': ?0, 'recipientType': ?1, 'status': 'READ' }")
    @Update("{ '$set': { 'status': 'DELETED' } }")
    long softDeleteAllRead(String recipientId, RecipientType recipientType);

    @Aggregation(pipeline = {
            "{ '$match': { 'recipientId': ?0, 'recipientType': ?1, 'status': 'UNREAD' } }",
            "{ '$group': { '_id': '$category', 'count': { '$sum': 1 } } }"
    })
    List<CategoryCount> unreadCountsByCategory(@Param("recipientId") String recipientId,
                                               @Param("recipientType") RecipientType recipientType);
}
