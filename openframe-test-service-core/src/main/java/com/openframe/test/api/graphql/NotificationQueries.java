package com.openframe.test.api.graphql;

/**
 * GraphQL documents for the in-app notification API (openframe-api-service-core
 * {@code notification.graphqls}), served on {@code api/graphql}. Everything acts on the caller's own
 * inbox; notification ids are Relay global ids. The Relay {@code node} field does not resolve the
 * Notification type ("Unknown Node type: Notification"), so a single notification is found through the
 * list with a title search.
 */
public class NotificationQueries {

    private static final String NOTIFICATION_FIELDS = """
            fragment notificationFields on Notification {
                id
                severity
                title
                description
                createdAt
                read
                category
                type
                attributes
            }
            """;

    public static final String NOTIFICATIONS = """
            query Notifications($filter: NotificationFilterInput, $search: String, $first: Int, $after: String) {
                notifications(filter: $filter, search: $search, first: $first, after: $after) {
                    edges {
                        node { ...notificationFields }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """ + NOTIFICATION_FIELDS;

    public static final String HAS_UNREAD_NOTIFICATIONS = """
            query HasUnreadNotifications {
                hasUnreadNotifications
            }
            """;

    public static final String UNREAD_COUNTS_BY_CATEGORY = """
            query UnreadCountsByCategory {
                unreadCountsByCategory { category count }
            }
            """;

    public static final String MARK_NOTIFICATION_AS_READ = """
            mutation MarkNotificationAsRead($notificationId: ID!) {
                markNotificationAsRead(notificationId: $notificationId)
            }
            """;

    /** Returns how many notifications were marked. */
    public static final String MARK_ALL_NOTIFICATIONS_AS_READ = """
            mutation MarkAllNotificationsAsRead {
                markAllNotificationsAsRead
            }
            """;

    public static final String DELETE_NOTIFICATION = """
            mutation DeleteNotification($notificationId: ID!) {
                deleteNotification(notificationId: $notificationId)
            }
            """;

    /** Returns how many read notifications were deleted. */
    public static final String DELETE_ALL_READ_NOTIFICATIONS = """
            mutation DeleteAllReadNotifications {
                deleteAllReadNotifications
            }
            """;

    /**
     * Marks every notification about one entity (TICKET or DIALOG) read. The schema warns that cards
     * stay listed as read, only the counts drop, and that the returned number spans categories — refetch
     * the counts rather than subtracting it.
     */
    public static final String MARK_NOTIFICATIONS_READ_FOR_ENTITY = """
            mutation MarkNotificationsReadForEntity($entityType: NotificationEntityType!, $entityId: ID!) {
                markNotificationsReadForEntity(entityType: $entityType, entityId: $entityId)
            }
            """;
}
