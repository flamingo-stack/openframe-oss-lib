package com.openframe.api.datafetcher.notification;

import com.openframe.data.document.notification.NotificationContext;

public interface NotificationContextTypeResolver {

    String resolveTypeName(NotificationContext source);
}
