package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceStatus;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareType;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.api.service.rmm.fleet.FleetSoftwareType;
import com.openframe.core.exception.NotFoundException;
import com.openframe.core.util.SoftwareVersions;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.Vulnerability;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.software.VulnerabilityRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
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
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@RequiredArgsConstructor
public class TenantSoftwareReadModelQuery {

    private static final int DEFAULT_PER_PAGE = 20;
    private static final String DEFAULT_SORT_PROPERTY = "nameLower";
    private static final Map<String, String> SORT_FIELD = Map.of(
            "name", "nameLower",
            "devicesCount", "devicesCount",
            "cveCount", "cveCount");

    private final SoftwareRepository softwareRepository;
    private final VulnerabilityRepository vulnerabilityRepository;
    private final MachineRepository machineRepository;

    public boolean exists(String tenantId, String softwareId) {
        Long titleId = parseLong(softwareId);
        return titleId != null && softwareRepository.existsByTenantIdAndSoftwareTitleId(tenantId, titleId);
    }

    public SoftwareResponse get(String tenantId, String softwareId) {
        Software software = load(tenantId, softwareId);
        return toResponse(software);
    }

    private Software load(String tenantId, String softwareId) {
        Long titleId = parseLong(softwareId);
        if (titleId == null) {
            throw new NotFoundException("Software not found: " + softwareId);
        }
        return softwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, titleId)
                .orElseThrow(() -> new NotFoundException("Software not found: " + softwareId));
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

    private SoftwareVulnerabilityResponse toSoftwareVuln(Vulnerability vuln, Long titleId) {
        SoftwareVulnerabilityResponse v = new SoftwareVulnerabilityResponse();
        v.setCveId(vuln.getCveId());
        v.setDiscoveredAt(vuln.getDiscoveredAt());
        if (vuln.getAffectedSoftware() != null) {
            vuln.getAffectedSoftware().stream()
                    .filter(a -> titleId.equals(a.getSoftwareTitleId()))
                    .map(Vulnerability.AffectedSoftware::getInstalledVersion)
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

    // Every device that has the title, each compared with latestVersion (the catalog's newest release or the highest
    // version installed): a device is up to date only when every version it carries is at or past it.
    public List<SoftwareOnDeviceResponse> devicesForSoftwareRows(String tenantId, String softwareId, String search,
                                                                 String latestVersion) {
        Software software = load(tenantId, softwareId);
        List<Software.Installation> installations = software.getInstallations() == null
                ? List.of() : software.getInstallations();
        List<String> machineIds = installations.stream()
                .map(Software.Installation::getMachineId).filter(Objects::nonNull).distinct().toList();
        Map<String, Machine> machineById = machineRepository.findByMachineIdIn(machineIds).stream()
                .collect(Collectors.toMap(Machine::getMachineId, Function.identity(), (a, b) -> a));
        return installations.stream()
                .filter(installation -> machineById.containsKey(installation.getMachineId()))
                .map(installation -> toOnDevice(installation, machineById, latestVersion))
                .filter(row -> matchesHostname(row, search))
                .toList();
    }

    private static SoftwareOnDeviceResponse toOnDevice(Software.Installation installation, Map<String, Machine> machineById,
                                                       String latestVersion) {
        Machine machine = machineById.get(installation.getMachineId());
        List<String> versions = installation.getVersions() == null ? List.of() : installation.getVersions();
        String shown = String.join(", ", versions);
        SoftwareOnDeviceStatus status = isUpToDate(versions, latestVersion)
                ? SoftwareOnDeviceStatus.UP_TO_DATE : SoftwareOnDeviceStatus.OUTDATED;
        return SoftwareOnDeviceResponse.builder()
                .device(machine)
                .softwareVersion(shown.isEmpty() ? null : shown)
                .status(status)
                .build();
    }

    private static boolean isUpToDate(List<String> versions, String latestVersion) {
        return latestVersion != null && !versions.isEmpty()
                && versions.stream().allMatch(version -> SoftwareVersions.compare(version, latestVersion) >= 0);
    }

    private static boolean matchesHostname(SoftwareOnDeviceResponse row, String search) {
        if (isBlank(search)) {
            return true;
        }
        String hostname = row.getDevice().getHostname();
        return hostname != null && hostname.toLowerCase().contains(search.toLowerCase());
    }

    public List<SoftwareResponse> allForFilters(String tenantId, String search) {
        Page<Software> page = isBlank(search)
                ? softwareRepository.findByTenantIdAndDevicesCountGreaterThan(tenantId, 0, Pageable.unpaged())
                : softwareRepository.findByTenantIdAndNameLowerContainingAndDevicesCountGreaterThan(
                        tenantId, search.toLowerCase(), 0, Pageable.unpaged());
        return page.getContent().stream().map(TenantSoftwareReadModelQuery::toResponse).toList();
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

        List<SoftwareResponse> rows = result.getContent().stream().map(TenantSoftwareReadModelQuery::toResponse).toList();
        return new PageResult<>(rows, result.hasNext(), pageIndex > 0, (int) result.getTotalElements(), pageIndex);
    }

    private Sort sortOf(SortInput sort) {
        String field = sort == null ? null : sort.getField();
        // Map.of refuses a null key, and no sort field is the list's default request
        String property = field == null ? DEFAULT_SORT_PROPERTY : SORT_FIELD.getOrDefault(field, DEFAULT_SORT_PROPERTY);
        Sort.Direction direction = sort != null && sort.getDirection() == SortDirection.DESC
                ? Sort.Direction.DESC : Sort.Direction.ASC;
        return Sort.by(direction, property);
    }

    // currentVersion is the version on the most devices and olderVersionsCount the other versions in use, as the
    // Fleet path reports them, so the catalog status reads both paths the same way
    private static SoftwareResponse toResponse(Software sw) {
        List<String> installedVersions = installedVersions(sw);
        Map<String, Long> devicesByVersion = installedVersions.stream()
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        String currentVersion = devicesByVersion.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
        Long titleId = sw.getSoftwareTitleId();
        String id = titleId == null ? null : titleId.toString();
        String fleetSource = sw.getSource();
        FleetSoftwareCategory category = FleetSoftwareCategory.of(fleetSource);
        SoftwareType type = FleetSoftwareType.of(fleetSource);
        int olderVersions = Math.max(0, devicesByVersion.size() - 1);

        SoftwareVulnerabilitySummaryResponse summary = new SoftwareVulnerabilitySummaryResponse();
        summary.setCveCount(sw.getCveCount());

        SoftwareResponse row = new SoftwareResponse();
        row.setId(id);
        row.setName(sw.getName());
        row.setSource(category.source());
        row.setFleetSource(fleetSource);
        row.setPublisher(sw.getVendor());
        row.setUpgradeCode(sw.getUpgradeCode());
        row.setProductCodes(sw.getArpKeys());
        row.setPackageFamilyNames(sw.getPackageFamilyNames());
        row.setSystemComponent(sw.getSystemComponent());
        row.setPackageMatch(sw.getPackageMatch());
        row.setType(type);
        row.setCurrentVersion(currentVersion);
        row.setLatestVersion(sw.getLatestVersion());
        row.setOlderVersionsCount(olderVersions);
        row.setDevicesCount(sw.getDevicesCount());
        row.setVulnerabilitySummary(summary);
        return row;
    }

    private static List<String> installedVersions(Software sw) {
        if (sw.getInstallations() == null) {
            return List.of();
        }
        return sw.getInstallations().stream()
                .map(Software.Installation::getVersions)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .filter(Objects::nonNull)
                .toList();
    }
}
