package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.TenantSoftware;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.TenantSoftwareRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantSoftwareCveAggregator {

    private final DeviceCveRepository deviceCveRepository;
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
                .collect(Collectors.toSet());

        int cveCount = cveIds.size();
        if (tenantSoftware.getCveCount() == cveCount) {
            return;
        }
        tenantSoftware.setCveCount(cveCount);
        tenantSoftware.setUpdatedAt(Instant.now());
        tenantSoftwareRepository.save(tenantSoftware);
        log.debug("[software-cdc] tenant_software cve aggregate: tenant={} title={} cveCount={}",
                tenantId, softwareTitleId, cveCount);
    }
}
