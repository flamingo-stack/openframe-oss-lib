package com.openframe.stream.enrichment;

import com.openframe.data.document.rmm.software.CveMetadata;
import com.openframe.data.document.rmm.software.TenantCve;
import com.openframe.data.repository.rmm.software.CveMetadataRepository;
import com.openframe.data.repository.rmm.software.TenantCveRepository;
import com.openframe.stream.enrichment.NvdClient.NvdCveData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Slf4j
@ConditionalOnProperty(name = "openframe.cve-enrichment.enabled", havingValue = "true")
public class CveEnrichmentService {

    private static final String SOURCE = "external";

    private final CveMetadataRepository cveMetadataRepository;
    private final TenantCveRepository tenantCveRepository;
    private final NvdClient nvdClient;
    private final EpssClient epssClient;
    private final CisaKevClient cisaKevClient;
    private final long nvdDelayMs;
    private final boolean nvdEnabled;
    private final boolean epssEnabled;
    private final boolean kevEnabled;

    public CveEnrichmentService(CveMetadataRepository cveMetadataRepository,
                                TenantCveRepository tenantCveRepository,
                                NvdClient nvdClient, EpssClient epssClient, CisaKevClient cisaKevClient,
                                @Value("${openframe.cve-enrichment.nvd.delay-ms}") long nvdDelayMs,
                                @Value("${openframe.cve-enrichment.nvd.enabled}") boolean nvdEnabled,
                                @Value("${openframe.cve-enrichment.epss.enabled}") boolean epssEnabled,
                                @Value("${openframe.cve-enrichment.kev.enabled}") boolean kevEnabled) {
        this.cveMetadataRepository = cveMetadataRepository;
        this.tenantCveRepository = tenantCveRepository;
        this.nvdClient = nvdClient;
        this.epssClient = epssClient;
        this.cisaKevClient = cisaKevClient;
        this.nvdDelayMs = nvdDelayMs;
        this.nvdEnabled = nvdEnabled;
        this.epssEnabled = epssEnabled;
        this.kevEnabled = kevEnabled;
    }

    public void enrich(List<CveMetadata> targets) {
        if (targets == null || targets.isEmpty()) {
            return;
        }
        List<String> cveIds = targets.stream().map(CveMetadata::getCveId).toList();
        Map<String, Double> epss = epssEnabled ? epssClient.fetch(cveIds) : Map.of();
        Set<String> knownExploited = kevEnabled ? cisaKevClient.knownExploitedCves() : Set.of();
        Instant now = Instant.now();

        for (CveMetadata metadata : targets) {
            String cveId = metadata.getCveId();
            NvdCveData nvd = nvdEnabled ? nvdClient.fetch(cveId) : null;
            if (nvd != null) {
                metadata.setCvssScore(nvd.cvssScore());
                metadata.setSeverity(nvd.severity());
                metadata.setPublishedAt(nvd.published());
                metadata.setDescription(nvd.description());
                metadata.setCweId(nvd.cweId());
            }
            metadata.setEpssProbability(epss.get(cveId));
            if (!knownExploited.isEmpty()) {
                metadata.setCisaKnownExploit(knownExploited.contains(cveId));
            }
            metadata.setSource(SOURCE);
            metadata.setCachedAt(now);
            cveMetadataRepository.save(metadata);
            fanOutToTenants(metadata);
            pace();
        }
        log.info("[cve-enrichment] enriched {} CVEs", targets.size());
    }

    /**
     * Cheap daily refresh of the volatile signals only — EPSS (recomputed daily upstream) and CISA
     * KEV — for already-known CVEs. Skips NVD entirely and leaves {@code cachedAt} untouched so it
     * does not reset the NVD refresh clock. The KEV set is fetched once by the caller and passed in.
     */
    public void refreshScores(List<CveMetadata> targets, Set<String> knownExploited) {
        if (targets == null || targets.isEmpty()) {
            return;
        }
        Map<String, Double> epss = epssEnabled
                ? epssClient.fetch(targets.stream().map(CveMetadata::getCveId).toList())
                : Map.of();
        Instant now = Instant.now();
        for (CveMetadata metadata : targets) {
            if (epssEnabled) {
                metadata.setEpssProbability(epss.get(metadata.getCveId()));
            }
            if (kevEnabled && !knownExploited.isEmpty()) {
                metadata.setCisaKnownExploit(knownExploited.contains(metadata.getCveId()));
            }
            metadata.setLastModifiedAt(now);
            cveMetadataRepository.save(metadata);
            fanOutToTenants(metadata);
        }
    }

    private void fanOutToTenants(CveMetadata metadata) {
        List<TenantCve> rows = tenantCveRepository.findByCveId(metadata.getCveId());
        if (rows.isEmpty()) {
            return;
        }
        Instant now = Instant.now();
        for (TenantCve row : rows) {
            row.setSeverity(metadata.getSeverity());
            row.setCvssScore(metadata.getCvssScore());
            row.setEpssProbability(metadata.getEpssProbability());
            row.setCisaKnownExploit(metadata.getCisaKnownExploit());
            row.setPublishedAt(metadata.getPublishedAt());
            row.setUpdatedAt(now);
        }
        tenantCveRepository.saveAll(rows);
    }

    private void pace() {
        if (!nvdEnabled || nvdDelayMs <= 0) {
            return;
        }
        try {
            Thread.sleep(nvdDelayMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
