package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationReadState;

import java.util.List;

public interface CustomNotificationReadStateRepository {

    void bulkInsertUnordered(List<NotificationReadState> rows);
}
