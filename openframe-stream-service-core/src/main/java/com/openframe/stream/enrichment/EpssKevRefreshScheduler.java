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

import java.util.List;
import java.util.Set;

@Component
@Slf4j
@ConditionalOnProperty(name = "openframe.cve-enrichment.daily-refresh.enabled", havingValue = "true")
public class EpssKevRefreshScheduler {

    private final CveMetadataRepository cveMetadataRepository;
    private final CveEnrichmentService cveEnrichmentService;
    private final CisaKevClient cisaKevClient;
    private final int pageSize;

    public EpssKevRefreshScheduler(CveMetadataRepository cveMetadataRepository,
                                   CveEnrichmentService cveEnrichmentService,
                                   CisaKevClient cisaKevClient,
                                   @Value("${openframe.cve-enrichment.daily-refresh.page-size}") int pageSize) {
        this.cveMetadataRepository = cveMetadataRepository;
        this.cveEnrichmentService = cveEnrichmentService;
        this.cisaKevClient = cisaKevClient;
        this.pageSize = pageSize;
    }

    @Scheduled(cron = "${openframe.cve-enrichment.daily-refresh.cron}")
    @SchedulerLock(
            name = "cveScoreRefresh",
            lockAtMostFor = "${openframe.cve-enrichment.daily-refresh.lock-at-most-for}",
            lockAtLeastFor = "${openframe.cve-enrichment.daily-refresh.lock-at-least-for}")
    public void run() {
        Set<String> knownExploited = cisaKevClient.knownExploitedCves();
        int page = 0;
        int processed = 0;
        while (true) {
            List<CveMetadata> batch = cveMetadataRepository.findAll(PageRequest.of(page, pageSize)).getContent();
            if (batch.isEmpty()) {
                break;
            }
            cveEnrichmentService.refreshScores(batch, knownExploited);
            processed += batch.size();
            if (batch.size() < pageSize) {
                break;
            }
            page++;
        }
        log.info("[cve-enrichment] daily EPSS/CISA refresh complete: {} CVEs", processed);
    }
}
