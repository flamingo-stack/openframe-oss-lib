package com.openframe.data.repository.notification;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.notification.Notification;

import java.util.List;

public interface CustomNotificationRepository {

    /**
     * Direct rows for the user plus tenant-wide broadcasts.
     * Request {@code pageSize + 1} to detect {@code hasNextPage} without a count query.
     */
    List<Notification> findPageForUser(String userId, String cursor, boolean backward, int limit);

    /** Machine analogue of {@link #findPageForUser} — direct rows plus broadcasts. */
    List<Notification> findPageForMachine(String machineId, String cursor, boolean backward, int limit);

    List<Notification> findRetryablePublishCandidates(int maxAttempts, int limit);

    /**
     * Newest-first id projection used by the bell badge — paired with
     * {@code findReadIds} this expresses "any unread" as two indexed lookups.
     * {@code limit} is the scan window: fully-read backlogs older than this
     * stay dark on the bell (matches "anything new" semantics).
     */
    List<String> findRecentIdsForUser(String userId, int limit);

    /**
     * Targeted {@code $set} on {@code publishState} so a concurrent writer
     * doesn't clobber unrelated fields under last-write-wins.
     */
    void updatePublishState(String id, PublishState publishState);
}
