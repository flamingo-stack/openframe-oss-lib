package com.openframe.client.scheduler;

import com.openframe.client.service.rmm.osupdate.OsUpdateService;
import com.openframe.client.service.rmm.osupdate.enrichment.ConditionalOnOsUpdateEnrichment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

// Enriches the OS update catalogue from the vendors' bulletins, never from the report ingest: a new update waits for
// the next run, and an outage of a vendor only delays it.
@Component
@ConditionalOnOsUpdateEnrichment
@RequiredArgsConstructor
@Slf4j
public class OsUpdateEnrichmentScheduler {

    private final OsUpdateService osUpdateService;

    @Value("${openframe.rmm.os-update.enrichment.ttl:24h}")
    private Duration ttl;

    @Value("${openframe.rmm.os-update.enrichment.batch-size:500}")
    private int batchSize;

    @Scheduled(cron = "${openframe.rmm.os-update.enrichment.cron:0 25 * * * *}", zone = "UTC")
    @SchedulerLock(name = "osUpdateEnrichment",
            lockAtMostFor = "${openframe.rmm.os-update.enrichment.lock-at-most-for:30m}",
            lockAtLeastFor = "${openframe.rmm.os-update.enrichment.lock-at-least-for:1m}")
    public void run() {
        try {
            osUpdateService.enrichNotEnrichedSince(Instant.now().minus(ttl), batchSize);
        } catch (Exception e) {
            log.error("OS update enrichment failed", e);
        }
    }
}
