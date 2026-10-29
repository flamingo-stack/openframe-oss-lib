package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.PackageAutoUpdateTrigger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = {"spring.cloud.stream.enabled", "openframe.rmm.software.enabled"}, havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class PackageAutoUpdateTriggerScheduler {

    private final PackageAutoUpdateTrigger trigger;

    // the package catalog syncs brew every 15 minutes, winget every 30
    @Scheduled(fixedDelayString = "${openframe.rmm.software.auto-update.trigger.interval:900000}")
    @SchedulerLock(name = "packageAutoUpdateTrigger",
            lockAtMostFor = "${openframe.rmm.software.auto-update.trigger.lock-at-most-for:10m}",
            lockAtLeastFor = "${openframe.rmm.software.auto-update.trigger.lock-at-least-for:30s}"
    )
    public void run() {
        try {
            trigger.run();
        } catch (Exception e) {
            log.error("Package auto-update trigger failed", e);
        }
    }
}
