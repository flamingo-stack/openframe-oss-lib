package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.PackageUpdateClockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class PackageUpdateClockScheduler {

    private final PackageUpdateClockService clockService;

    @Scheduled(fixedDelayString = "${openframe.rmm.software.package-update.deadline.interval:60000}")
    @SchedulerLock(name = "packageUpdateDeadlineForce",
            lockAtMostFor = "${openframe.rmm.software.package-update.deadline.lock-at-most-for:2m}",
            lockAtLeastFor = "${openframe.rmm.software.package-update.deadline.lock-at-least-for:10s}")
    public void forceExpiredDeadlines() {
        try {
            clockService.forceExpiredDeadlines();
        } catch (Exception e) {
            log.error("Package-update deadline-force sweep failed", e);
        }
    }

    @Scheduled(fixedDelayString = "${openframe.rmm.software.package-update.retry.interval:300000}")
    @SchedulerLock(name = "packageUpdateAutoRetry",
            lockAtMostFor = "${openframe.rmm.software.package-update.retry.lock-at-most-for:2m}",
            lockAtLeastFor = "${openframe.rmm.software.package-update.retry.lock-at-least-for:10s}")
    public void retryFailedAutoUpdates() {
        try {
            clockService.retryFailedAutoUpdates();
        } catch (Exception e) {
            log.error("Package-update AUTO-retry sweep failed", e);
        }
    }
}
