package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.SoftwareScheduleOnlineDispatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareScheduleOnlineDispatchScheduler {

    private final SoftwareScheduleOnlineDispatchService dispatchService;

    @Scheduled(fixedDelayString = "${openframe.rmm.software.schedule.online-dispatch.interval:60000}")
    @SchedulerLock(name = "softwareScheduleOnlineDispatch",
            lockAtMostFor = "${openframe.rmm.software.schedule.online-dispatch.lock-at-most-for:2m}",
            lockAtLeastFor = "${openframe.rmm.software.schedule.online-dispatch.lock-at-least-for:10s}"
    )
    public void run() {
        try {
            dispatchService.processReconnectedDevices();
        } catch (Exception e) {
            log.error("Software schedule reconnect sweep failed", e);
        }
    }
}
