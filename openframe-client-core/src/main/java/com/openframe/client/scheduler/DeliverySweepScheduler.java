package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.delivery.DeliverySweepService;
import com.openframe.client.service.rmm.delivery.DeliveryWatchdogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.rmm.delivery.enabled", havingValue = "true")
public class DeliverySweepScheduler {

    private final DeliverySweepService sweepService;
    private final DeliveryWatchdogService watchdogService;

    @Scheduled(fixedDelayString = "${openframe.rmm.delivery.sweep-interval}")
    @SchedulerLock(name = "deliverySweep",
            lockAtMostFor = "${openframe.rmm.delivery.lock-at-most-for}",
            lockAtLeastFor = "${openframe.rmm.delivery.lock-at-least-for}")
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
