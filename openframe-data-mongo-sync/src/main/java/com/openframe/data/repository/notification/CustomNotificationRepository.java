package com.openframe.data.repository.notification;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.notification.Notification;

import java.util.List;

public interface CustomNotificationRepository {

    List<Notification> findPageForUser(String userId, String cursor, boolean backward, int limit);

    List<Notification> findPageForUser(String userId, Boolean readFilter, String cursor, boolean backward, int limit);

    List<Notification> findPageForMachine(String machineId, String cursor, boolean backward, int limit);

    List<Notification> findRetryablePublishCandidates(int maxAttempts, int limit);

    List<String> findRecentIdsForUser(String userId, int limit);

    void updatePublishState(String id, PublishState publishState);
}
