package com.openframe.delivery;

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

    private final DeliverySweepService sweepService;
    private final DeliveryWatchdogService watchdogService;

    @Scheduled(fixedDelayString = "${openframe.delivery.sweep.interval}")
    @SchedulerLock(name = "deliverySweep",
            lockAtMostFor = "${openframe.delivery.sweep.lock-at-most-for}",
            lockAtLeastFor = "${openframe.delivery.sweep.lock-at-least-for}")
    public void tick() {
        retryPending();
        reapAcked();
    }

    private void retryPending() {
        try {
            sweepService.retryPending();
        } catch (Exception e) {
            log.error("Delivery sweep failed", e);
        }
    }

    private void reapAcked() {
        try {
            watchdogService.reapAcked();
        } catch (Exception e) {
            log.error("Delivery watchdog failed", e);
        }
    }
}
