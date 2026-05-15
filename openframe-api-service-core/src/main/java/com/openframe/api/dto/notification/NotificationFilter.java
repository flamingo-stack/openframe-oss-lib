package com.openframe.api.dto.notification;

public record NotificationFilter(Boolean read, String search) {

    public static final NotificationFilter EMPTY = new NotificationFilter(null, null);
}
