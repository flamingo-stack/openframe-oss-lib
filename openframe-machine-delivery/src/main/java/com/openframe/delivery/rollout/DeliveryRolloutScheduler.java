package com.openframe.delivery.rollout;

import com.openframe.delivery.metrics.DeliveryMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// its own job and lock: a batch of hundreds of machines must not delay the retry and watchdog passes, and a failure
// here is a rollout's, not the sweep's
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.sweep.enabled", havingValue = "true")
public class DeliveryRolloutScheduler {

    private static final String PASS_ROLLOUT = "rollout";

    private final DeliveryRolloutService rolloutService;
    private final DeliveryMetrics metrics;

    @Scheduled(fixedDelayString = "${openframe.delivery.sweep.interval}")
    @SchedulerLock(name = "deliveryRollout",
            lockAtMostFor = "${openframe.delivery.sweep.lock-at-most-for}",
            lockAtLeastFor = "${openframe.delivery.sweep.lock-at-least-for}")
    public void tick() {
        try {
            metrics.timeSweepPass(PASS_ROLLOUT, rolloutService::advance);
        } catch (Exception e) {
            log.error("Delivery rollout pass failed", e);
        }
    }
}
