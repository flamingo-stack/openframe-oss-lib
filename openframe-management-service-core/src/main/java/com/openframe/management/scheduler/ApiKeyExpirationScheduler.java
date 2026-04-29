package com.openframe.management.scheduler;

import com.openframe.management.service.ApiKeyExpirationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.api-key-expiration.enabled", havingValue = "true", matchIfMissing = true)
public class ApiKeyExpirationScheduler {

    private final ApiKeyExpirationService expirationService;

    @Scheduled(fixedDelayString = "${openframe.api-key-expiration.interval:3600000}")
    @SchedulerLock(
            name = "apiKeyExpiration",
            lockAtMostFor = "${openframe.api-key-expiration.lock-at-most-for:10m}",
            lockAtLeastFor = "${openframe.api-key-expiration.lock-at-least-for:1m}"
    )
    public void disableExpiredKeys() {
        log.info("Starting API key expiration sweep");
        try {
            expirationService.disableExpiredKeys();
        } catch (Exception e) {
            log.error("API key expiration sweep failed", e);
        }
    }
}
