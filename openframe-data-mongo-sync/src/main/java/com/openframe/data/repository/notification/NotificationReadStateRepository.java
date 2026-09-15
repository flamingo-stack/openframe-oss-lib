package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationEntityType;
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

import java.util.Collection;
import java.util.List;

@Repository
@TenantAwareRepository
public interface NotificationReadStateRepository
        extends MongoRepository<NotificationReadState, String>, CustomNotificationReadStateRepository {

    // ARCHIVED is not yet read: any mark-read turns it into READ.
    String UNREAD_OR_ARCHIVED = "['UNREAD', 'ARCHIVED']";

    boolean existsByRecipientIdAndRecipientTypeAndStatus(String recipientId,
                                                         RecipientType recipientType,
                                                         ReadStatus status);

    List<NotificationReadState> findByNotificationId(String notificationId);

    List<NotificationReadState> findByRecipientIdAndRecipientTypeAndStatus(String recipientId,
                                                                           RecipientType recipientType,
                                                                           ReadStatus status);

    List<NotificationReadState> findByRecipientIdAndRecipientTypeAndStatusIn(String recipientId,
                                                                             RecipientType recipientType,
                                                                             Collection<ReadStatus> statuses);

    @Query("{ 'recipientId': ?0, 'recipientType': ?1, 'notificationId': ?2, 'status': { '$in': " + UNREAD_OR_ARCHIVED + " } }")
    @Update(pipeline = "{ '$set': { 'status': 'READ', 'readAt': '$$NOW' } }")
    long markAsRead(String recipientId, RecipientType recipientType, String notificationId);

    @Query("{ 'recipientId': ?0, 'recipientType': ?1, 'status': { '$in': " + UNREAD_OR_ARCHIVED + " } }")
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

    @Query("{ 'tenantId': ?0, 'recipientId': ?1, 'recipientType': ?2, 'notificationId': { '$in': ?3 }, 'status': 'READ' }")
    @Update("{ '$set': { 'status': 'DELETED' } }")
    long softDeleteByIds(String tenantId,
                         String recipientId,
                         RecipientType recipientType,
                         Collection<String> notificationIds);

    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?2, 'recipientId': ?0, 'recipientType': ?1, 'status': 'UNREAD' } }",
            "{ '$group': { '_id': '$category', 'count': { '$sum': 1 } } }"
    })
    List<CategoryCount> unreadCountsByCategory(@Param("recipientId") String recipientId,
                                               @Param("recipientType") RecipientType recipientType,
                                               @Param("tenantId") String tenantId);

    // tenantId must stay explicit — aggregations and @Update bypass tenant scoping.
    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?3, 'recipientId': ?0, 'recipientType': ?1, 'entityType': ?2, "
                    + "'status': 'UNREAD', 'entityId': { '$exists': true, '$ne': null } } }",
            "{ '$group': { '_id': '$entityId', 'count': { '$sum': 1 } } }"
    })
    List<EntityCount> unreadCountsByEntity(@Param("recipientId") String recipientId,
                                           @Param("recipientType") RecipientType recipientType,
                                           @Param("entityType") NotificationEntityType entityType,
                                           @Param("tenantId") String tenantId);

    @Aggregation(pipeline = {
            "{ '$match': { 'tenantId': ?4, 'recipientId': ?0, 'recipientType': ?1, 'entityType': ?2, "
                    + "'status': 'UNREAD', 'entityId': { '$in': ?3 } } }",
            "{ '$group': { '_id': '$entityId', 'count': { '$sum': 1 } } }"
    })
    List<EntityCount> unreadCountsByEntityIds(@Param("recipientId") String recipientId,
                                              @Param("recipientType") RecipientType recipientType,
                                              @Param("entityType") NotificationEntityType entityType,
                                              @Param("entityIds") Collection<String> entityIds,
                                              @Param("tenantId") String tenantId);

    @Query("{ 'tenantId': ?2, 'entityType': ?0, 'entityId': ?1, 'status': 'UNREAD' }")
    List<NotificationReadState> findUnreadByEntity(NotificationEntityType entityType, String entityId, String tenantId);

    @Query("{ 'tenantId': ?2, 'entityType': ?0, 'entityId': ?1, 'status': 'UNREAD' }")
    @Update(pipeline = "{ '$set': { 'status': 'ARCHIVED', 'readAt': '$$NOW' } }")
    long archiveUnreadByEntity(NotificationEntityType entityType, String entityId, String tenantId);

    @Query("{ 'tenantId': ?5, 'recipientId': ?0, 'recipientType': ?1, 'entityType': ?2, 'entityId': ?3, 'status': { '$in': ?4 } }")
    List<NotificationReadState> findByRecipientIdAndRecipientTypeAndEntity(String recipientId,
                                                                          RecipientType recipientType,
                                                                          NotificationEntityType entityType,
                                                                          String entityId,
                                                                          Collection<ReadStatus> statuses,
                                                                          String tenantId);

    // Flips exactly the ids the caller snapshotted, never "everything still unread on that entity":
    // a notification arriving mid-call would otherwise turn read without anyone retracting its push.
    @Query("{ 'tenantId': ?0, 'recipientId': ?1, 'recipientType': ?2, 'notificationId': { '$in': ?3 }, 'status': { '$in': " + UNREAD_OR_ARCHIVED + " } }")
    @Update(pipeline = "{ '$set': { 'status': 'READ', 'readAt': '$$NOW' } }")
    long markAsReadByIds(String tenantId,
                         String recipientId,
                         RecipientType recipientType,
                         Collection<String> notificationIds);
}
