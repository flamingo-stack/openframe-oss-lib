package com.openframe.client.scheduler;

import com.openframe.client.service.ToolOsSupportSweepService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class ToolOsSupportSweepScheduler {

    private final ToolOsSupportSweepService sweepService;

    @Scheduled(fixedDelayString = "${openframe.tool-os-support.sweep.interval:PT5M}")
    @SchedulerLock(name = "toolOsSupportSweep",
            lockAtMostFor = "${openframe.tool-os-support.sweep.lock-at-most-for:30m}",
            lockAtLeastFor = "${openframe.tool-os-support.sweep.lock-at-least-for:1m}")
    public void run() {
        try {
            sweepService.sweep();
        } catch (Exception e) {
            log.error("Minimum OS version sweep failed", e);
        }
    }
}
