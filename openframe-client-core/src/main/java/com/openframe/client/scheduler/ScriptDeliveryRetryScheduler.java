package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.watchdog.ScriptDeliveryRetryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.rmm.execution.watchdog.enabled", havingValue = "true")
public class ScriptDeliveryRetryScheduler {

    private final ScriptDeliveryRetryService deliveryRetryService;

    @Scheduled(fixedDelayString = "${openframe.rmm.execution.retry.interval}")
    @SchedulerLock(name = "scriptDeliveryRetry",
            lockAtMostFor = "${openframe.rmm.execution.retry.lock-at-most-for}",
            lockAtLeastFor = "${openframe.rmm.execution.retry.lock-at-least-for}")
    public void sweep() {
        try {
            log.debug("Running QUEUED delivery retry sweep");
            deliveryRetryService.retryStuckQueuedDeliveries();
        } catch (Exception e) {
            log.error("QUEUED delivery retry sweep failed", e);
        }
    }
}
