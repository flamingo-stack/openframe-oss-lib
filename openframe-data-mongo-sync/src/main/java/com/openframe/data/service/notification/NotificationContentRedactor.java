package com.openframe.data.service.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContentPolicy;
import com.openframe.data.repository.notification.NotificationContentPolicyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationContentRedactor {

    private static final Map<NotificationCategory, String> SUPPRESSED_BY_CATEGORY = Map.of(
            NotificationCategory.TICKETS, "New activity on this ticket",
            NotificationCategory.MINGO, "New message",
            NotificationCategory.DEVICES, "New device activity",
            NotificationCategory.MONITORING, "New monitoring alert");

    private static final String SUPPRESSED_DEFAULT = "New notification";

    private final NotificationContentPolicyRepository policyRepository;

    public boolean contentSuppressed() {
        try {
            return policyRepository.find()
                    .map(NotificationContentPolicy::isContentSuppressed)
                    .orElse(false);
        } catch (RuntimeException ex) {
            log.warn("Notification policy lookup failed — treating content as not suppressed: {}", ex.getMessage());
            return false;
        }
    }

    public String descriptionFor(Notification notification, NotificationCategory category, boolean contentSuppressed) {
        if (notification == null) {
            return null;
        }
        if (!contentSuppressed) {
            return notification.getDescription();
        }
        return SUPPRESSED_BY_CATEGORY.getOrDefault(resolveCategory(notification, category), SUPPRESSED_DEFAULT);
    }

    public String descriptionFor(Notification notification, NotificationCategory category) {
        return descriptionFor(notification, category, contentSuppressed());
    }

    private static NotificationCategory resolveCategory(Notification notification, NotificationCategory category) {
        return Optional.ofNullable(category).orElse(notification.getCategory());
    }
}
