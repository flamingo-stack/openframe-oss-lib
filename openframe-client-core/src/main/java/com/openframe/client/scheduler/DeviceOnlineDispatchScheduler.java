package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.DeviceOnlineDispatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineDispatchScheduler {

    private final DeviceOnlineDispatchService dispatchService;

    @Scheduled(fixedDelayString = "${openframe.rmm.device-online.dispatch.interval:60000}")
    @SchedulerLock(name = "deviceOnlineDispatch",
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
