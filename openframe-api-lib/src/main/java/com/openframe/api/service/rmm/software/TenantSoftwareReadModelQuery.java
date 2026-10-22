package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.document.rmm.software.DeviceVulnerability;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import com.openframe.data.repository.rmm.software.DeviceVulnerabilityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.Comparator;
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
            "cveCount", "cveCount");

    private final SoftwareRepository softwareRepository;
    private final DeviceVulnerabilityRepository vulnerabilityRepository;
    private final MachineRepository machineRepository;

    public Optional<SoftwareResponse> findById(String tenantId, String softwareId) {
        Long titleId = parseLong(softwareId);
        if (titleId == null) {
            return Optional.empty();
        }
        return softwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, titleId).map(this::toResponse);
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
        List<SoftwareVulnerabilityResponse> all = vulnerabilityRepository
                .findByTenantIdAndAffectedSoftwareSoftwareTitleId(tenantId, titleId).stream()
                .map(v -> toSoftwareVuln(v, titleId))
                .filter(v -> isBlank(search) || (v.getCveId() != null && v.getCveId().toLowerCase().contains(search.toLowerCase())))
                .sorted(vulnComparator(sortField, sortAsc))
                .toList();
        return paginate(all, page, perPage);
    }

    private SoftwareVulnerabilityResponse toSoftwareVuln(DeviceVulnerability vuln, Long titleId) {
        SoftwareVulnerabilityResponse v = new SoftwareVulnerabilityResponse();
        v.setCveId(vuln.getCveId());
        v.setDiscoveredAt(vuln.getDiscoveredAt());
        if (vuln.getAffectedSoftware() != null) {
            vuln.getAffectedSoftware().stream()
                    .filter(a -> titleId.equals(a.getSoftwareTitleId()))
                    .map(DeviceVulnerability.AffectedSoftware::getInstalledVersion)
                    .filter(Objects::nonNull).findFirst()
                    .ifPresent(v::setAffectedVersion);
        }
        return v;
    }

    private Comparator<SoftwareVulnerabilityResponse> vulnComparator(String sortField, boolean sortAsc) {
        Comparator<SoftwareVulnerabilityResponse> base = "cveId".equals(sortField)
                ? Comparator.comparing(SoftwareVulnerabilityResponse::getCveId, Comparator.nullsLast(Comparator.naturalOrder()))
                : Comparator.comparing(SoftwareVulnerabilityResponse::getDiscoveredAt, Comparator.nullsLast(Comparator.naturalOrder()));
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
        Software software = softwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, titleId).orElse(null);
        if (software == null || software.getInstallations() == null || software.getInstallations().isEmpty()) {
            return List.of();
        }
        List<Software.Installation> installations = software.getInstallations();
        Map<String, Machine> machineById = machineRepository.findByMachineIdIn(
                        installations.stream().map(Software.Installation::getMachineId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(Machine::getMachineId, m -> m, (a, b) -> a));
        return installations.stream()
                .map(i -> toOnDevice(i, machineById.get(i.getMachineId())))
                .filter(Objects::nonNull)
                .filter(row -> isBlank(search) || (row.getDevice().getHostname() != null
                        && row.getDevice().getHostname().toLowerCase().contains(search.toLowerCase())))
                .toList();
    }

    public List<SoftwareResponse> allForFilters(String tenantId, String search) {
        Page<Software> page = isBlank(search)
                ? softwareRepository.findByTenantIdAndDevicesCountGreaterThan(tenantId, 0, Pageable.unpaged())
                : softwareRepository.findByTenantIdAndNameLowerContainingAndDevicesCountGreaterThan(
                        tenantId, search.toLowerCase(), 0, Pageable.unpaged());
        return page.getContent().stream().map(this::toResponse).toList();
    }

    private SoftwareOnDeviceResponse toOnDevice(Software.Installation installation, Machine machine) {
        if (machine == null) {
            return null;
        }
        return SoftwareOnDeviceResponse.builder()
                .device(machine)
                .softwareVersion(installation.getVersion())
                .status(null) // UP_TO_DATE comparison not available yet; null so a status filter matches nothing.
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

    public PageResult<SoftwareResponse> listSoftware(String tenantId, String search, int page, Integer perPage,
                                                     SortInput sort, Boolean vulnerable) {
        int size = perPage == null || perPage <= 0 ? DEFAULT_PER_PAGE : perPage;
        int pageIndex = Math.max(page, 0);
        Pageable pageable = PageRequest.of(pageIndex, size, sortOf(sort));

        boolean vuln = Boolean.TRUE.equals(vulnerable);
        boolean hasSearch = !isBlank(search);
        String nameLower = hasSearch ? search.toLowerCase() : null;

        Page<Software> result;
        if (hasSearch && vuln) {
            result = softwareRepository
                    .findByTenantIdAndNameLowerContainingAndCveCountGreaterThanAndDevicesCountGreaterThan(
                            tenantId, nameLower, 0, 0, pageable);
        } else if (hasSearch) {
            result = softwareRepository
                    .findByTenantIdAndNameLowerContainingAndDevicesCountGreaterThan(tenantId, nameLower, 0, pageable);
        } else if (vuln) {
            result = softwareRepository
                    .findByTenantIdAndCveCountGreaterThanAndDevicesCountGreaterThan(tenantId, 0, 0, pageable);
        } else {
            result = softwareRepository.findByTenantIdAndDevicesCountGreaterThan(tenantId, 0, pageable);
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

    private SoftwareResponse toResponse(Software sw) {
        SoftwareResponse row = new SoftwareResponse();
        row.setId(sw.getSoftwareTitleId() == null ? null : String.valueOf(sw.getSoftwareTitleId()));
        row.setName(sw.getName());
        row.setSource(FleetSoftwareCategory.of(sw.getSource()).source());
        row.setLatestVersion(sw.getLatestVersion());
        row.setDevicesCount(sw.getDevicesCount());

        SoftwareVulnerabilitySummaryResponse summary = new SoftwareVulnerabilitySummaryResponse();
        summary.setCveCount(sw.getCveCount());
        row.setVulnerabilitySummary(summary);
        return row;
    }
}
