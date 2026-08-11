package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationContentPolicy;

import java.util.Optional;

public interface CustomNotificationContentPolicyRepository {

    Optional<NotificationContentPolicy> find();

    void setContentSuppressed(boolean suppressed);
}
