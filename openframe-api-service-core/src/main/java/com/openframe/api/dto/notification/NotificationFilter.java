package com.openframe.api.dto.notification;

public record NotificationFilter(Boolean read) {

    public boolean hasReadFilter() {
        return read != null;
    }
}
