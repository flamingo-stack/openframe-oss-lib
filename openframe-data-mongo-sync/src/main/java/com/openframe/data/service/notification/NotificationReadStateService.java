package com.openframe.data.service.notification;

import com.openframe.data.repository.notification.NotificationReadStateRepository;
import com.openframe.data.repository.notification.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
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
        return repository.markRead(userId, notificationId);
    }

    public Set<String> findReadIds(String userId, Collection<String> notificationIds) {
        return repository.findReadIds(userId, notificationIds);
    }
}
