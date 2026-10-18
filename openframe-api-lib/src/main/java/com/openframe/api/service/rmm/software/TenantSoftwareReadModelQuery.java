package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceStatus;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.CveMetadata;
import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.TenantSoftware;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.software.CveMetadataRepository;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.TenantSoftwareRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

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
    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final DeviceCveRepository deviceCveRepository;
    private final CveMetadataRepository cveMetadataRepository;
    private final MachineRepository machineRepository;

    public Optional<SoftwareResponse> findById(String tenantId, String softwareId) {
        Long titleId = parseLong(softwareId);
        if (titleId == null) {
            return Optional.empty();
        }
        return tenantSoftwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, titleId).map(this::toResponse);
    }

    private static Long parseLong(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public PageResult<SoftwareVulnerabilityResponse> listVulnerabilitiesForSoftware(
            String tenantId, String softwareId, String search, int page, Integer perPage,
            String sortField, boolean sortAsc) {
        Long titleId = parseLong(softwareId);
        if (titleId == null) {
            return PageResult.empty(page);
        }
        Map<String, List<DeviceCve>> byCve = deviceCveRepository.findByTenantIdAndSoftwareTitleId(tenantId, titleId)
                .stream()
                .filter(dc -> dc.getCveId() != null)
                .collect(Collectors.groupingBy(DeviceCve::getCveId, LinkedHashMap::new, Collectors.toList()));
        if (byCve.isEmpty()) {
            return PageResult.empty(page);
        }
        Map<String, CveMetadata> metaByCve = cveMetadataRepository.findByCveIdIn(byCve.keySet()).stream()
                .collect(Collectors.toMap(CveMetadata::getCveId, m -> m, (a, b) -> a));
        List<SoftwareVulnerabilityResponse> all = byCve.entrySet().stream()
                .map(e -> toSoftwareVuln(e.getKey(), e.getValue(), metaByCve.get(e.getKey())))
                .filter(v -> isBlank(search) || (v.getCveId() != null && v.getCveId().toLowerCase().contains(search.toLowerCase())))
                .sorted(vulnComparator(sortField, sortAsc))
                .toList();
        return paginate(all, page, perPage);
    }

    private SoftwareVulnerabilityResponse toSoftwareVuln(String cveId, List<DeviceCve> rows, CveMetadata meta) {
        SoftwareVulnerabilityResponse v = new SoftwareVulnerabilityResponse();
        v.setCveId(cveId);
        if (meta != null) {
            v.setSeverity(severityOf(meta.getSeverity()));
            v.setCvssScore(meta.getCvssScore());
        }
        v.setAffectedVersion(rows.stream().map(DeviceCve::getInstalledVersion).filter(Objects::nonNull)
                .distinct().collect(Collectors.joining(", ")));
        v.setDiscoveredAt(rows.stream().map(DeviceCve::getDiscoveredAt).filter(Objects::nonNull)
                .min(Comparator.naturalOrder()).orElse(null));
        return v;
    }

    private Comparator<SoftwareVulnerabilityResponse> vulnComparator(String sortField, boolean sortAsc) {
        Comparator<SoftwareVulnerabilityResponse> base = "discoveredAt".equals(sortField)
                ? Comparator.comparing(SoftwareVulnerabilityResponse::getDiscoveredAt, Comparator.nullsLast(Comparator.naturalOrder()))
                : Comparator.comparing(SoftwareVulnerabilityResponse::getCvssScore, Comparator.nullsLast(Comparator.naturalOrder()));
        return sortAsc ? base : base.reversed();
    }

    public PageResult<SoftwareOnDeviceResponse> listDevicesForSoftware(
            String tenantId, String softwareId, SoftwareOnDeviceFilterInput filter, String search,
            int page, Integer perPage) {
        List<SoftwareOnDeviceResponse> all = devicesForSoftwareRows(tenantId, softwareId, search).stream()
                .filter(row -> matchesStatusFilter(row, filter))
                .toList();
        return paginate(all, page, perPage);
    }

    public List<SoftwareOnDeviceResponse> devicesForSoftwareRows(String tenantId, String softwareId, String search) {
        Long titleId = parseLong(softwareId);
        if (titleId == null) {
            return List.of();
        }
        List<DeviceSoftware> installed = deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, titleId);
        if (installed.isEmpty()) {
            return List.of();
        }
        Map<String, Machine> machineById = machineRepository.findByMachineIdIn(
                        installed.stream().map(DeviceSoftware::getMachineId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(Machine::getMachineId, m -> m, (a, b) -> a));
        return installed.stream()
                .map(ds -> toOnDevice(ds, machineById.get(ds.getMachineId())))
                .filter(Objects::nonNull)
                .filter(row -> isBlank(search) || (row.getDevice().getHostname() != null
                        && row.getDevice().getHostname().toLowerCase().contains(search.toLowerCase())))
                .toList();
    }

    public List<SoftwareResponse> allForFilters(String tenantId, String search) {
        Page<TenantSoftware> page = isBlank(search)
                ? tenantSoftwareRepository.findByTenantIdAndDevicesCountGreaterThan(tenantId, 0, Pageable.unpaged())
                : tenantSoftwareRepository.findByTenantIdAndNameLowerContainingAndDevicesCountGreaterThan(
                        tenantId, search.toLowerCase(), 0, Pageable.unpaged());
        return page.getContent().stream().map(this::toResponse).toList();
    }

    private SoftwareOnDeviceResponse toOnDevice(DeviceSoftware ds, Machine machine) {
        if (machine == null) {
            return null;
        }
        // Up-to-date status needs a latest-version comparison the read-model doesn't carry yet.
        return SoftwareOnDeviceResponse.builder()
                .device(machine)
                .softwareVersion(ds.getVersion())
                .status(SoftwareOnDeviceStatus.UP_TO_DATE)
                .build();
    }

    private boolean matchesStatusFilter(SoftwareOnDeviceResponse row, SoftwareOnDeviceFilterInput filter) {
        if (filter == null || filter.getStatuses() == null || filter.getStatuses().isEmpty()) {
            return true;
        }
        return row.getStatus() != null && filter.getStatuses().contains(row.getStatus());
    }

    private <T> PageResult<T> paginate(List<T> all, int page, Integer perPage) {
        int size = perPage != null && perPage > 0 ? perPage : DEFAULT_PER_PAGE;
        int pageIndex = Math.max(page, 0);
        int from = pageIndex * size;
        int to = Math.min(all.size(), from + size);
        List<T> slice = from >= all.size() ? List.of() : all.subList(from, to);
        return new PageResult<>(slice, to < all.size(), pageIndex > 0, all.size(), pageIndex);
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
}
