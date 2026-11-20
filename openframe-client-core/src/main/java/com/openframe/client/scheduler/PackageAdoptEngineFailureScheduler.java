package com.openframe.client.scheduler;

import com.openframe.client.listener.packageadopt.PackageAdoptEngineFailureSweep;
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
public class PackageAdoptEngineFailureScheduler {

    private final PackageAdoptEngineFailureSweep packageAdoptEngineFailureSweep;

    @Scheduled(fixedDelayString = "${openframe.rmm.software.adopt.failure-sweep.interval:60000}")
    @SchedulerLock(name = "packageAdoptEngineFailureSweep",
            lockAtMostFor = "${openframe.rmm.software.adopt.failure-sweep.lock-at-most-for:2m}",
            lockAtLeastFor = "${openframe.rmm.software.adopt.failure-sweep.lock-at-least-for:10s}")
    public void run() {
        try {
            packageAdoptEngineFailureSweep.sweep();
        } catch (Exception e) {
            log.error("Package adopt engine-failure sweep failed", e);
        }
    }
}
