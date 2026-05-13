package com.openframe.data.service.notification;

import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.Recipient;
import com.openframe.data.document.notification.UserRecipient;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import com.openframe.data.repository.notification.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationReadStateService {

    private final NotificationRepository notificationRepository;
    private final NotificationReadStateRepository repository;

    @Value("${openframe.notifications.unread-scan-window:1000}")
    private int unreadScanWindow;

    public boolean hasUnread(String recipientUserId) {
        if (isBlank(recipientUserId)) {
            return false;
        }
        List<String> recentIds = notificationRepository.findRecentIdsForUser(recipientUserId, unreadScanWindow);
        if (recentIds.isEmpty()) {
            return false;
        }
        Set<String> readIds = repository.findReadIds(recipientUserId, recentIds);
        return readIds.size() < recentIds.size();
    }

    public boolean markRead(String userId, String notificationId) {
        Optional<Notification> existing = notificationRepository.findById(notificationId);
        if (existing.isEmpty()) {
            log.warn("markRead skipped — notification {} does not exist", notificationId);
            return false;
        }
        if (!canMark(userId, existing.get().getRecipient())) {
            log.warn("markRead skipped — user {} cannot mark notification {} (recipient={})",
                    userId, notificationId, existing.get().getRecipient());
            return false;
        }
        return repository.markRead(userId, notificationId);
    }

    public Set<String> findReadIds(String userId, Collection<String> notificationIds) {
        return repository.findReadIds(userId, notificationIds);
    }

    private static boolean canMark(String userId, Recipient recipient) {
        return switch (recipient) {
            case UserRecipient(String uid) -> userId.equals(uid);
            case BroadcastRecipient ignored -> true;
            case MachineRecipient ignored -> false;
            case null -> false;
        };
    }
}
