package com.openframe.data.repository.notification;

import java.util.Collection;
import java.util.Set;

public interface CustomNotificationReadStateRepository {

    boolean markRead(String userId, String notificationId);

    Set<String> findReadIds(String userId, Collection<String> notificationIds);
}
