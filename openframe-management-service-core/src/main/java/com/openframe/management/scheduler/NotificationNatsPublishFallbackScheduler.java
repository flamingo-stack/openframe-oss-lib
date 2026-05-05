package com.openframe.management.scheduler;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.repository.notification.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Replays notifications that failed their initial NATS publish. Capped retries +
 * ShedLock for distributed safety.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(value = "openframe.notification-publish-fallback.enabled", havingValue = "true")
@ConditionalOnBean(NotificationNatsPublisher.class)
public class NotificationNatsPublishFallbackScheduler {

    private final NotificationRepository notificationRepository;
    private final NotificationNatsPublisher notificationNatsPublisher;

    @Value("${openframe.notification-publish-fallback.max-attempts:5}")
    private int maxPublishAttempts;

    @Value("${openframe.notification-publish-fallback.batch-size:100}")
    private int batchSize;

    @Scheduled(fixedDelayString = "${openframe.notification-publish-fallback.interval:30000}")
    @SchedulerLock(
            name = "notificationNatsPublishFallback",
            lockAtMostFor = "${openframe.notification-publish-fallback.lock-at-most-for:5m}",
            lockAtLeastFor = "${openframe.notification-publish-fallback.lock-at-least-for:5s}"
    )
    public void republishUnpublishedNotifications() {
        try {
            List<Notification> candidates = notificationRepository
                    .findRetryablePublishCandidates(maxPublishAttempts, batchSize);

            if (candidates.isEmpty()) {
                return;
            }

            log.info("Retrying NATS publish for {} unpublished notification(s)", candidates.size());

            for (Notification notification : candidates) {
                try {
                    notificationNatsPublisher.publish(notification);
                } catch (Exception ex) {
                    log.warn("Fallback publish failed for notification {}: {}",
                            notification.getId(), ex.getMessage());
                }
            }
        } catch (Exception ex) {
            log.error("Notification publish fallback sweep failed", ex);
        }
    }
}
