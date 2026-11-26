package com.openframe.management.osupdate;

import com.openframe.data.service.rmm.osupdate.DeviceOsUpdateRolloutStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Applies the policies to what the devices report: a new pending update, a new tag of a device or new data from
// the vendor's bulletin reaches the rollout states with the next run, never from the report ingest.
@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class DeviceOsUpdateRolloutStateScheduler {

    private final DeviceOsUpdateRolloutStateService deviceOsUpdateRolloutStateService;

    @Scheduled(cron = "${openframe.rmm.os-update.rollout.cron:0 */10 * * * *}", zone = "UTC")
    @SchedulerLock(name = "deviceOsUpdateRolloutState",
            lockAtMostFor = "${openframe.rmm.os-update.rollout.lock-at-most-for:30m}",
            lockAtLeastFor = "${openframe.rmm.os-update.rollout.lock-at-least-for:1m}")
    public void run() {
        try {
            deviceOsUpdateRolloutStateService.refreshAll();
        } catch (Exception e) {
            log.error("OS update rollout state refresh failed", e);
        }
    }
}
