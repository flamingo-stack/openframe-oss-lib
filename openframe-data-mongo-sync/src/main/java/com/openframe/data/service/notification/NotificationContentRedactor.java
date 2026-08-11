package com.openframe.data.service.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContentPolicy;
import com.openframe.data.repository.notification.NotificationContentPolicyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

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

    private final Optional<NotificationContentPolicyRepository> policyRepository;

    private final AtomicReference<CachedPolicy> cache = new AtomicReference<>();

    @Value("${openframe.notifications.policy-cache-seconds:60}")
    private long policyCacheSeconds;

    public String descriptionFor(Notification notification, NotificationCategory category) {
        if (notification == null) {
            return null;
        }
        if (!contentSuppressed()) {
            return notification.getDescription();
        }
        return SUPPRESSED_BY_CATEGORY.getOrDefault(resolveCategory(notification, category), SUPPRESSED_DEFAULT);
    }

    public boolean contentSuppressed() {
        if (policyRepository.isEmpty()) {
            return false;
        }
        CachedPolicy cached = cache.get();
        if (cached != null && cached.isFresh(policyCacheSeconds)) {
            return cached.suppressed();
        }
        try {
            boolean suppressed = policyRepository.get().find()
                    .map(NotificationContentPolicy::isContentSuppressed)
                    .orElse(false);
            cache.set(new CachedPolicy(suppressed, Instant.now()));
            return suppressed;
        } catch (RuntimeException ex) {
            log.warn("Notification policy lookup failed — treating content as not suppressed: {}", ex.getMessage());
            return cached != null && cached.suppressed();
        }
    }

    public void invalidate() {
        cache.set(null);
    }

    private static NotificationCategory resolveCategory(Notification notification, NotificationCategory category) {
        return Optional.ofNullable(category).orElse(notification.getCategory());
    }

    private record CachedPolicy(boolean suppressed, Instant readAt) {

        boolean isFresh(long ttlSeconds) {
            return ttlSeconds > 0 && readAt.plus(Duration.ofSeconds(ttlSeconds)).isAfter(Instant.now());
        }
    }
}
