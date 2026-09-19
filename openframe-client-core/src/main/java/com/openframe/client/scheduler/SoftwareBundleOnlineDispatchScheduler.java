package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.SoftwareBundleOnlineDispatchService;
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
public class SoftwareBundleOnlineDispatchScheduler {

    private final SoftwareBundleOnlineDispatchService dispatchService;

    @Scheduled(fixedDelayString = "${openframe.rmm.software.bundle.online-dispatch.interval:60000}")
    @SchedulerLock(name = "softwareBundleOnlineDispatch",
            lockAtMostFor = "${openframe.rmm.software.bundle.online-dispatch.lock-at-most-for:2m}",
            lockAtLeastFor = "${openframe.rmm.software.bundle.online-dispatch.lock-at-least-for:10s}"
    )
    public void run() {
        try {
            dispatchService.processDevicesBecameOnline();
        } catch (Exception e) {
            log.error("Software bundle online-dispatch sweep failed", e);
        }
    }
}
