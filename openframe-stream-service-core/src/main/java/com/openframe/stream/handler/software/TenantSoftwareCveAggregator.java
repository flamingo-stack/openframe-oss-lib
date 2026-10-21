package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.CveMetadata;
import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.TenantSoftware;
import com.openframe.data.repository.rmm.software.CveMetadataRepository;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.TenantSoftwareRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantSoftwareCveAggregator {

    private static final Map<String, Integer> SEVERITY_RANK = Map.of(
            "CRITICAL", 5, "HIGH", 4, "MEDIUM", 3, "LOW", 2, "NONE", 1);

    private final DeviceCveRepository deviceCveRepository;
    private final CveMetadataRepository cveMetadataRepository;
    private final TenantSoftwareRepository tenantSoftwareRepository;

    public void recompute(String tenantId, Long softwareTitleId) {
        if (tenantId == null || softwareTitleId == null) {
            return;
        }
        TenantSoftware tenantSoftware = tenantSoftwareRepository
                .findByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId)
                .orElse(null);
        if (tenantSoftware == null) {
            // Count row not projected yet; the host-count handler recomputes once it lands.
            return;
        }
        Set<String> cveIds = deviceCveRepository.findByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId).stream()
                .map(DeviceCve::getCveId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());

        int cveCount = cveIds.size();
        String highestSeverity = highestSeverity(cveIds);
        if (tenantSoftware.getCveCount() == cveCount
                && Objects.equals(tenantSoftware.getHighestSeverity(), highestSeverity)) {
            return;
        }
        tenantSoftware.setCveCount(cveCount);
        tenantSoftware.setHighestSeverity(highestSeverity);
        tenantSoftware.setUpdatedAt(Instant.now());
        tenantSoftwareRepository.save(tenantSoftware);
        log.debug("[software-cdc] tenant_software cve aggregate: tenant={} title={} cveCount={} severity={}",
                tenantId, softwareTitleId, cveCount, highestSeverity);
    }

    private String highestSeverity(Set<String> cveIds) {
        if (cveIds.isEmpty()) {
            return null;
        }
        List<CveMetadata> metas = cveMetadataRepository.findByCveIdIn(cveIds);
        String best = null;
        int bestRank = 0;
        for (CveMetadata meta : metas) {
            int rank = SEVERITY_RANK.getOrDefault(meta.getSeverity(), 0);
            if (rank > bestRank) {
                bestRank = rank;
                best = meta.getSeverity();
            }
        }
        return best;
    }
}
