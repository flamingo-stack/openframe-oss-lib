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
        return object(NOTIFICATIONS, "notifications", variables, NotificationConnection.class);
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
        NotificationConnection page = object(NOTIFICATIONS, "notifications", variables, NotificationConnection.class);
        return page.nodes().stream().filter(n -> id.equals(n.getId())).findFirst().orElse(null);
    }

    public static boolean hasUnread() {
        return flag(HAS_UNREAD_NOTIFICATIONS, "hasUnreadNotifications", Map.of());
    }

    public static List<UnreadCategoryCount> unreadCounts() {
        return list(UNREAD_COUNTS_BY_CATEGORY, "unreadCountsByCategory", Map.of(), UnreadCategoryCount.class);
    }

    public static int totalUnread() {
        return unreadCounts().stream().mapToInt(c -> c.getCount() == null ? 0 : c.getCount()).sum();
    }

    public static boolean markRead(String id) {
        return flag(MARK_NOTIFICATION_AS_READ, "markNotificationAsRead", Map.of("notificationId", id));
    }

    /** Marks the whole inbox read; returns how many notifications changed. */
    public static long markAllRead() {
        return count(MARK_ALL_NOTIFICATIONS_AS_READ, "markAllNotificationsAsRead", Map.of());
    }

    public static boolean delete(String id) {
        return flag(DELETE_NOTIFICATION, "deleteNotification", Map.of("notificationId", id));
    }

    /** Deletes every read notification; returns how many were removed. Irreversible. */
    public static long deleteAllRead() {
        return count(DELETE_ALL_READ_NOTIFICATIONS, "deleteAllReadNotifications", Map.of());
    }

    /** {@code entityType} is TICKET or DIALOG; {@code entityId} the entity's own id. Returns how many changed. */
    public static long markReadForEntity(String entityType, String entityId) {
        return count(MARK_NOTIFICATIONS_READ_FOR_ENTITY, "markNotificationsReadForEntity",
                Map.of("entityType", entityType, "entityId", entityId));
    }

    // ---- plumbing ----
    //
    // Each of these holds the response in a named local before reading a field out of it, so a
    // failure says which step produced nothing rather than pointing at one long chain.

    /** Reads one object out of a document's answer. */
    private static <T> T object(String document, String field, Map<String, Object> variables, Class<T> type) {
        JsonPath response = query(document, variables);
        return response.getObject("data." + field, type);
    }

    /** Reads a list out of a document's answer. */
    private static <T> List<T> list(String document, String field, Map<String, Object> variables, Class<T> type) {
        JsonPath response = query(document, variables);
        return response.getList("data." + field, type);
    }

    /** A mutation that answers a bare Boolean; a null answer counts as false. */
    private static boolean flag(String document, String field, Map<String, Object> variables) {
        JsonPath response = query(document, variables);
        Boolean answered = response.getObject("data." + field, Boolean.class);
        return Boolean.TRUE.equals(answered);
    }

    /** A bulk mutation that answers how many notifications it changed. */
    private static long count(String document, String field, Map<String, Object> variables) {
        JsonPath response = query(document, variables);
        return response.getLong("data." + field);
    }

    private static JsonPath query(String document, Map<String, Object> variables) {
        Map<String, Object> body = Map.of("query", document, "variables", variables);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath();
    }
}
