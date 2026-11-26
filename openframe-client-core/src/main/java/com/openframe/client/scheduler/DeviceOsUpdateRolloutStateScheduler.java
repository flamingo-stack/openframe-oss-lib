package com.openframe.client.scheduler;

import com.openframe.client.metrics.DeviceOsUpdateRolloutStateMetrics;
import com.openframe.data.service.rmm.osupdate.DeviceOsUpdateRolloutStateService;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Applies the policies to what the devices report: a saved policy, a customer's override, a new pending update, a
// new tag of a device or new data from the vendor's bulletin reaches the rollout states with the next run, never
// from the report ingest. An override of one device also writes the rows of that device from the API: this run
// and that call may overlap, the next run settles it within a minute.
@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class DeviceOsUpdateRolloutStateScheduler {

    private final DeviceOsUpdateRolloutStateService deviceOsUpdateRolloutStateService;
    private final DeviceOsUpdateRolloutStateMetrics deviceOsUpdateRolloutStateMetrics;

    @Scheduled(cron = "${openframe.rmm.os-update.rollout.cron:0 * * * * *}", zone = "UTC")
    @SchedulerLock(name = "deviceOsUpdateRolloutState",
            lockAtMostFor = "${openframe.rmm.os-update.rollout.lock-at-most-for:5m}",
            lockAtLeastFor = "${openframe.rmm.os-update.rollout.lock-at-least-for:10s}")
    public void run() {
        Timer.Sample runStarted = deviceOsUpdateRolloutStateMetrics.startRun();
        try {
            deviceOsUpdateRolloutStateService.refreshAll();
        } catch (Exception e) {
            log.error("OS update rollout state refresh failed", e);
            deviceOsUpdateRolloutStateMetrics.recordRunFailed();
        } finally {
            deviceOsUpdateRolloutStateMetrics.recordRun(runStarted);
        }
    }
}
