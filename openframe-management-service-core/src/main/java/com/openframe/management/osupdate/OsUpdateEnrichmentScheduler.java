package com.openframe.management.osupdate;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;

// Enriches the OS update catalogue from the vendors' bulletins, never from the report ingest: a new update waits for
// the next run, and an outage of a vendor only delays it.
@Component
@ConditionalOnProperty(name = {"openframe.rmm.os-update.enabled", "openframe.rmm.os-update.enrichment.enabled"},
        havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class OsUpdateEnrichmentScheduler {

    private final OsUpdateEnrichmentService osUpdateEnrichmentService;
    private final OsUpdateEnrichmentMetrics osUpdateEnrichmentMetrics;

    @Value("${openframe.rmm.os-update.enrichment.ttl:24h}")
    private Duration ttl;

    @Value("${openframe.rmm.os-update.enrichment.batch-size:500}")
    private int batchSize;

    @Value("${openframe.rmm.os-update.enrichment.os-version-builds.refresh-interval:6h}")
    private Duration osVersionBuildsRefreshInterval;

    @Scheduled(cron = "${openframe.rmm.os-update.enrichment.cron:0 25 * * * *}", zone = "UTC")
    @SchedulerLock(name = "osUpdateEnrichment",
            lockAtMostFor = "${openframe.rmm.os-update.enrichment.lock-at-most-for:30m}",
            lockAtLeastFor = "${openframe.rmm.os-update.enrichment.lock-at-least-for:1m}")
    public void run() {
        try {
            Instant enrichedBefore = Instant.now().minus(ttl);
            osUpdateEnrichmentService.enrichNotEnrichedSince(enrichedBefore, batchSize);
        } catch (Exception e) {
            log.error("OS update enrichment failed", e);
            osUpdateEnrichmentMetrics.recordRunFailed();
        }
    }

    // On the cron of the enrichment, but the bulletins are asked once per refresh interval.
    @Scheduled(cron = "${openframe.rmm.os-update.enrichment.cron:0 25 * * * *}", zone = "UTC")
    @SchedulerLock(name = "osVersionBuildRefresh",
            lockAtMostFor = "${openframe.rmm.os-update.enrichment.lock-at-most-for:30m}",
            lockAtLeastFor = "${openframe.rmm.os-update.enrichment.lock-at-least-for:1m}")
    public void refreshOsVersionBuilds() {
        try {
            Instant now = Instant.now();
            YearMonth month = YearMonth.from(now.atZone(ZoneOffset.UTC));
            osUpdateEnrichmentService.refreshOsVersionBuilds(month, now.minus(osVersionBuildsRefreshInterval));
        } catch (Exception e) {
            log.error("OS version build refresh failed", e);
            osUpdateEnrichmentMetrics.recordRunFailed();
        }
    }
}
