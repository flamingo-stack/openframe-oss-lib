package com.openframe.stream.enrichment;

import com.openframe.data.document.rmm.software.CveMetadata;
import com.openframe.data.repository.rmm.software.CveMetadataRepository;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
@Slf4j
@ConditionalOnProperty(name = "openframe.cve-enrichment.enabled", havingValue = "true")
public class CveEnrichmentScheduler {

    private final CveMetadataRepository cveMetadataRepository;
    private final CveEnrichmentService cveEnrichmentService;
    private final int batchSize;
    private final Duration refreshAfter;

    public CveEnrichmentScheduler(CveMetadataRepository cveMetadataRepository,
                                  CveEnrichmentService cveEnrichmentService,
                                  @Value("${openframe.cve-enrichment.batch-size}") int batchSize,
                                  @Value("${openframe.cve-enrichment.refresh-after}") Duration refreshAfter) {
        this.cveMetadataRepository = cveMetadataRepository;
        this.cveEnrichmentService = cveEnrichmentService;
        this.batchSize = batchSize;
        this.refreshAfter = refreshAfter;
    }

    @Scheduled(fixedDelayString = "${openframe.cve-enrichment.interval}")
    @SchedulerLock(
            name = "cveEnrichment",
            lockAtMostFor = "${openframe.cve-enrichment.lock-at-most-for}",
            lockAtLeastFor = "${openframe.cve-enrichment.lock-at-least-for}")
    public void run() {
        PageRequest page = PageRequest.of(0, batchSize);
        List<CveMetadata> batch = new ArrayList<>(cveMetadataRepository.findByCachedAtIsNull(page));
        if (batch.size() < batchSize) {
            Instant cutoff = Instant.now().minus(refreshAfter);
            PageRequest remaining = PageRequest.of(0, batchSize - batch.size());
            batch.addAll(cveMetadataRepository.findByCachedAtBefore(cutoff, remaining));
        }
        if (batch.isEmpty()) {
            return;
        }
        log.info("[cve-enrichment] starting batch of {} CVEs", batch.size());
        cveEnrichmentService.enrich(batch);
    }
}
