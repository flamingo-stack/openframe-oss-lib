package com.openframe.test.api;

import com.openframe.test.data.dto.notification.Notification;
import com.openframe.test.data.dto.notification.NotificationConnection;
import com.openframe.test.data.dto.notification.NotificationFilterInput;
import com.openframe.test.data.dto.notification.UnreadCategoryCount;
import io.restassured.path.json.JsonPath;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.NotificationQueries.DELETE_ALL_READ_NOTIFICATIONS;
import static com.openframe.test.api.graphql.NotificationQueries.DELETE_NOTIFICATION;
import static com.openframe.test.api.graphql.NotificationQueries.HAS_UNREAD_NOTIFICATIONS;
import static com.openframe.test.api.graphql.NotificationQueries.MARK_ALL_NOTIFICATIONS_AS_READ;
import static com.openframe.test.api.graphql.NotificationQueries.MARK_NOTIFICATIONS_READ_FOR_ENTITY;
import static com.openframe.test.api.graphql.NotificationQueries.MARK_NOTIFICATION_AS_READ;
import static com.openframe.test.api.graphql.NotificationQueries.NOTIFICATIONS;
import static com.openframe.test.api.graphql.NotificationQueries.UNREAD_COUNTS_BY_CATEGORY;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

/** Client for the caller's in-app notification inbox on {@code api/graphql}. */
public class NotificationApi {

    /** First page of the inbox; {@code filter} null lists read and unread alike. Newest first. */
    public static NotificationConnection listNotifications(NotificationFilterInput filter, int first) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("first", first);
        if (filter != null) {
            variables.put("filter", filter);
        }
        return query(NOTIFICATIONS, variables).getObject("data.notifications", NotificationConnection.class);
    }

    public static NotificationConnection listUnread(int first) {
        return listNotifications(NotificationFilterInput.builder().read(false).build(), first);
    }

    public static NotificationConnection listRead(int first) {
        return listNotifications(NotificationFilterInput.builder().read(true).build(), first);
    }

    /**
     * One notification by id, or null when it is not in the inbox any more. The Relay {@code node}
     * field does not resolve notifications, so this searches the list by the notification's title
     * (search needs at least three characters; shorter titles fall back to the first page).
     */
    public static Notification find(String id, String title) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("first", 50);
        if (title != null && title.trim().length() >= 3) {
            variables.put("search", title.trim());
        }
        return query(NOTIFICATIONS, variables).getObject("data.notifications", NotificationConnection.class)
                .nodes().stream().filter(n -> id.equals(n.getId())).findFirst().orElse(null);
    }

    public static boolean hasUnread() {
        return Boolean.TRUE.equals(query(HAS_UNREAD_NOTIFICATIONS, Map.of()).getObject("data.hasUnreadNotifications", Boolean.class));
    }

    public static List<UnreadCategoryCount> unreadCounts() {
        return query(UNREAD_COUNTS_BY_CATEGORY, Map.of()).getList("data.unreadCountsByCategory", UnreadCategoryCount.class);
    }

    public static int totalUnread() {
        return unreadCounts().stream().mapToInt(c -> c.getCount() == null ? 0 : c.getCount()).sum();
    }

    public static boolean markRead(String id) {
        return Boolean.TRUE.equals(query(MARK_NOTIFICATION_AS_READ, Map.of("notificationId", id)).getObject("data.markNotificationAsRead", Boolean.class));
    }

    /** Marks the whole inbox read; returns how many notifications changed. */
    public static long markAllRead() {
        return query(MARK_ALL_NOTIFICATIONS_AS_READ, Map.of()).getLong("data.markAllNotificationsAsRead");
    }

    public static boolean delete(String id) {
        return Boolean.TRUE.equals(query(DELETE_NOTIFICATION, Map.of("notificationId", id)).getObject("data.deleteNotification", Boolean.class));
    }

    /** Deletes every read notification; returns how many were removed. Irreversible. */
    public static long deleteAllRead() {
        return query(DELETE_ALL_READ_NOTIFICATIONS, Map.of()).getLong("data.deleteAllReadNotifications");
    }

    /** {@code entityType} is TICKET or DIALOG; {@code entityId} the entity's own id. Returns how many changed. */
    public static long markReadForEntity(String entityType, String entityId) {
        return query(MARK_NOTIFICATIONS_READ_FOR_ENTITY, Map.of("entityType", entityType, "entityId", entityId))
                .getLong("data.markNotificationsReadForEntity");
    }

    private static JsonPath query(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
    }
}
