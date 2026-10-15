package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.data.document.rmm.software.TenantSoftware;
import com.openframe.data.repository.rmm.software.TenantSoftwareRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@RequiredArgsConstructor
public class TenantSoftwareReadModelQuery {

    private static final int DEFAULT_PER_PAGE = 20;
    private static final Map<String, String> SORT_FIELD = Map.of(
            "name", "nameLower",
            "devicesCount", "devicesCount",
            "cveCount", "cveCount",
            "highestSeverity", "highestSeverity",
            "severity", "highestSeverity");

    private final TenantSoftwareRepository tenantSoftwareRepository;

    public PageResult<SoftwareResponse> listSoftware(String tenantId, String search, int page, Integer perPage,
                                                     SortInput sort, Boolean vulnerable) {
        int size = perPage == null || perPage <= 0 ? DEFAULT_PER_PAGE : perPage;
        int pageIndex = Math.max(page, 0);
        Pageable pageable = PageRequest.of(pageIndex, size, sortOf(sort));

        boolean vuln = Boolean.TRUE.equals(vulnerable);
        boolean hasSearch = !isBlank(search);
        String nameLower = hasSearch ? search.toLowerCase() : null;

        Page<TenantSoftware> result;
        if (hasSearch && vuln) {
            result = tenantSoftwareRepository
                    .findByTenantIdAndNameLowerContainingAndCveCountGreaterThanAndDevicesCountGreaterThan(
                            tenantId, nameLower, 0, 0, pageable);
        } else if (hasSearch) {
            result = tenantSoftwareRepository
                    .findByTenantIdAndNameLowerContainingAndDevicesCountGreaterThan(tenantId, nameLower, 0, pageable);
        } else if (vuln) {
            result = tenantSoftwareRepository
                    .findByTenantIdAndCveCountGreaterThanAndDevicesCountGreaterThan(tenantId, 0, 0, pageable);
        } else {
            result = tenantSoftwareRepository.findByTenantIdAndDevicesCountGreaterThan(tenantId, 0, pageable);
        }

        List<SoftwareResponse> rows = result.getContent().stream().map(this::toResponse).toList();
        return new PageResult<>(rows, result.hasNext(), pageIndex > 0, (int) result.getTotalElements(), pageIndex);
    }

    private Sort sortOf(SortInput sort) {
        String field = sort == null ? null : sort.getField();
        String property = SORT_FIELD.getOrDefault(field, "nameLower");
        Sort.Direction direction = sort != null && sort.getDirection() == SortDirection.DESC
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        return Sort.by(direction, property);
    }

    private SoftwareResponse toResponse(TenantSoftware ts) {
        SoftwareResponse row = new SoftwareResponse();
        row.setId(ts.getSoftwareTitleId() == null ? null : String.valueOf(ts.getSoftwareTitleId()));
        row.setName(ts.getName());
        row.setSource(FleetSoftwareCategory.of(ts.getSource()).source());
        row.setLatestVersion(ts.getLatestVersion());
        row.setOlderVersionsCount(ts.getOlderVersionsCount());
        row.setDevicesCount(ts.getDevicesCount());
        row.setCpeMatched(ts.getCpeMatched());

        SoftwareVulnerabilitySummaryResponse summary = new SoftwareVulnerabilitySummaryResponse();
        summary.setCveCount(ts.getCveCount());
        summary.setHighestSeverity(severityOf(ts.getHighestSeverity()));
        row.setVulnerabilitySummary(summary);
        return row;
    }

    private static SoftwareCveSeverity severityOf(String severity) {
        if (isBlank(severity)) {
            return null;
        }
        try {
            return SoftwareCveSeverity.valueOf(severity);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
