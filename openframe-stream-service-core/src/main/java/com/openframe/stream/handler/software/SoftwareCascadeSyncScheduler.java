package com.openframe.stream.handler.software;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.cascade.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class SoftwareCascadeSyncScheduler {

    private final SoftwareCascadeSyncService cascadeSyncService;

    @Scheduled(fixedDelayString = "${openframe.rmm.software.cascade.interval:60000}")
    @SchedulerLock(name = "softwareCascadeSync",
            lockAtMostFor = "${openframe.rmm.software.cascade.lock-at-most-for:5m}",
            lockAtLeastFor = "${openframe.rmm.software.cascade.lock-at-least-for:1s}")
    public void run() {
        try {
            cascadeSyncService.processBatch();
        } catch (Exception e) {
            log.error("[software-cdc] cascade sweep failed", e);
        }
    }
}
