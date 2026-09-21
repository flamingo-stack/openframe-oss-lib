package com.openframe.delivery.sweep;

import com.openframe.delivery.metrics.DeliveryMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {"openframe.delivery.enabled", "openframe.delivery.sweep.enabled"}, havingValue = "true")
public class DeliverySweepScheduler {

    private static final String PASS_RETRY = "retry";
    private static final String PASS_WATCHDOG = "watchdog";

    private final DeliverySweepService sweepService;
    private final DeliveryWatchdogService watchdogService;
    private final DeliveryMetrics metrics;

    @Scheduled(fixedDelayString = "${openframe.delivery.sweep.interval}")
    @SchedulerLock(name = "deliverySweep",
            lockAtMostFor = "${openframe.delivery.sweep.lock-at-most-for}",
            lockAtLeastFor = "${openframe.delivery.sweep.lock-at-least-for}")
    public void tick() {
        runPass(PASS_RETRY, sweepService::retryPending);
        runPass(PASS_WATCHDOG, watchdogService::reapAcked);
    }

    private void runPass(String pass, Runnable body) {
        try {
            metrics.timeSweepPass(pass, body);
        } catch (RuntimeException e) {
            log.error("Delivery sweep pass failed: pass={}", pass, e);
        }
    }
}
