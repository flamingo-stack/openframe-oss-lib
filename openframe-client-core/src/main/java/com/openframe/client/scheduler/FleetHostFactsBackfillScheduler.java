package com.openframe.client.scheduler;

import com.openframe.client.service.agentregistration.fleet.FleetHostFactsBackfillService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Once an hour: fills the hardware facts Fleet knows (serial, computer name, model, manufacturer, OS UUID) of machines
// the tool connection consumer left without them: machines registered before Fleet facts were stored, and a fill that
// failed because the consumer or Fleet was down. A machine Fleet could not fill is tried again after
// openframe.fleet.host-facts.backfill.recheck-after (7 days by default). New machines are filled at once, when their
// Fleet connection is added.
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.fleet.host-facts.backfill.enabled", havingValue = "true", matchIfMissing = true)
public class FleetHostFactsBackfillScheduler {

    private final FleetHostFactsBackfillService backfillService;

    @Scheduled(cron = "${openframe.fleet.host-facts.backfill.cron:0 15 * * * *}", zone = "UTC")
    @SchedulerLock(name = "fleetHostFactsBackfill",
            lockAtMostFor = "${openframe.fleet.host-facts.backfill.lock-at-most-for:1h}",
            lockAtLeastFor = "${openframe.fleet.host-facts.backfill.lock-at-least-for:5m}")
    public void run() {
        try {
            log.debug("Running Fleet host facts backfill");
            backfillService.backfill();
        } catch (Exception e) {
            log.error("Fleet host facts backfill failed", e);
        }
    }
}
