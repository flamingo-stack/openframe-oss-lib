package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.DeviceOnlineDispatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Cron for the DEVICE_ONLINE first-fire dispatcher. The trigger service records a sentinel
 * synchronously when a machine first goes online; this scheduler drains the pending set every
 * minute — fires DEVICE_ONLINE schedules against currently-online machines, retries offline ones
 * on the next tick, and marks each row as dispatched only after the fires complete.
 *
 * <p>Tuneable via {@code openframe.rmm.device-online.dispatch.interval} (ms, default 60000).
 * ShedLock serialises the tick across client-service replicas so one machine's schedules are
 * fired once per pending row even when several pods run.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineDispatchScheduler {

    private final DeviceOnlineDispatchService dispatchService;

    @Scheduled(fixedDelayString = "${openframe.rmm.device-online.dispatch.interval:60000}")
    @SchedulerLock(
            name = "deviceOnlineDispatch",
            lockAtMostFor = "${openframe.rmm.device-online.dispatch.lock-at-most-for:2m}",
            lockAtLeastFor = "${openframe.rmm.device-online.dispatch.lock-at-least-for:10s}"
    )
    public void run() {
        try {
            dispatchService.processPending();
        } catch (Exception e) {
            log.error("DEVICE_ONLINE dispatch sweep failed", e);
        }
    }
}
