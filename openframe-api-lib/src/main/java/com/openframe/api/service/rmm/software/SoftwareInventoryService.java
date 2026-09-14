package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareFilterOption;
import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceStatus;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.service.rmm.fleet.FleetClientProvider;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;
import com.openframe.sdk.fleetmdm.model.SoftwareTitlesResponse;
import com.openframe.sdk.fleetmdm.model.Vulnerability;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareInventoryService {

    private static final int DEVICES_PER_VERSION_LIMIT = 500;

    private final FleetClientProvider fleet;
    private final FleetHostMachineResolver hostMachineResolver;
    private final TenantIdProvider tenantIdProvider;

    public Optional<SoftwareResponse> findById(String softwareId) {
        return parseNumericId(softwareId)
                .map(id -> fleet.call(client -> client.getSoftwareTitle(id), "get Fleet software title id=" + id))
                .map(FleetSoftwareMapper::toResponse);
    }

    public PageResult<SoftwareResponse> listSoftware(String search, int page, Integer perPage,
                                                     String orderKey, String orderDirection, Boolean vulnerable) {
        SoftwareTitleRequest request = SoftwareTitleRequest.builder()
                .page(page).perPage(perPage).query(search)
                .orderKey(orderKey).orderDirection(orderDirection)
                .vulnerable(vulnerable)
                .build();
        SoftwareTitlesResponse response = fleet.call(
                client -> client.listSoftwareTitles(request),
                "list Fleet software titles");
        List<SoftwareResponse> items = response.getSoftwareTitles() == null
                ? List.of()
                : response.getSoftwareTitles().stream()
                        .map(FleetSoftwareMapper::toResponse)
                        .filter(Objects::nonNull)
                        .toList();
        boolean hasNext = response.getMeta() != null
                && Boolean.TRUE.equals(response.getMeta().getHasNextResults());
        boolean hasPrev = response.getMeta() != null
                && Boolean.TRUE.equals(response.getMeta().getHasPreviousResults());
        int total = response.getCount() == null ? items.size() : response.getCount();
        return new PageResult<>(items, hasNext, hasPrev, total, page);
    }

    public PageResult<SoftwareVulnerabilityResponse> listVulnerabilitiesForSoftware(
            String softwareId, String search, int page, Integer perPage,
            String sortField, boolean sortAsc) {
        Optional<Long> parsed = parseNumericId(softwareId);
        if (parsed.isEmpty()) {
            return PageResult.empty(page);
        }
        SoftwareTitle title = fleet.call(
                client -> client.getSoftwareTitle(parsed.get()),
                "get Fleet software title id=" + parsed.get());
        if (title == null || title.getVersions() == null || title.getVersions().isEmpty()) {
            return PageResult.empty(page);
        }
        List<VersionCve> pairs = collectVersionCves(title.getVersions());
        if (pairs.isEmpty()) {
            return PageResult.empty(page);
        }
        Map<String, Vulnerability> enrichment = enrichCves(uniqueCves(pairs));
        List<SoftwareVulnerabilityResponse> all = pairs.stream()
                .map(p -> FleetVulnerabilityMapper.toResponse(p.cve(), enrichment.get(p.cve()), p.version()))
                .filter(Objects::nonNull)
                .filter(v -> matchesSearch(v, search))
                .sorted(comparator(sortField, sortAsc))
                .toList();
        return paginate(all, page, perPage);
    }

    /**
     * Devices that have a given software title installed — backs the software detail "Devices" tab.
     * Fleet exposes the installed version only per software <em>version</em>, so we fan out one host
     * query per version of the title, tag each returned host with that version, correlate the Fleet
     * host to an OpenFrame {@link Machine}, and derive the status from the version vs the title's latest.
     * Hosts not enrolled in OpenFrame (no matching Machine) are dropped. Paginated in memory.
     */
    public PageResult<SoftwareOnDeviceResponse> listDevicesForSoftware(String softwareId, String search,
                                                                       int page, Integer perPage) {
        Optional<Long> titleId = parseNumericId(softwareId);
        if (titleId.isEmpty()) {
            return PageResult.empty(page);
        }
        SoftwareTitle title = fleet.call(
                client -> client.getSoftwareTitle(titleId.get()),
                "get Fleet software title id=" + titleId.get());
        if (title == null || title.getVersions() == null || title.getVersions().isEmpty()) {
            return PageResult.empty(page);
        }
        String latestVersion = FleetSoftwareMapper.toResponse(title).getLatestVersion();

        List<HostVersion> hostVersions = new ArrayList<>();
        for (SoftwareTitleVersion version : title.getVersions()) {
            if (version.getId() == null) {
                continue;
            }
            HostSearchRequest request = new HostSearchRequest();
            request.setSoftwareVersionId(version.getId());
            request.setPerPage(DEVICES_PER_VERSION_LIMIT);
            List<Host> hosts = fleet.call(
                    client -> client.searchHosts(request),
                    "list Fleet hosts for software_version_id=" + version.getId());
            hosts.forEach(host -> hostVersions.add(new HostVersion(host, version.getVersion())));
        }

        Map<Long, Machine> machinesByHostId = hostMachineResolver.resolve(
                tenantIdProvider.getTenantId(), hostVersions.stream().map(HostVersion::host).toList());

        List<SoftwareOnDeviceResponse> all = hostVersions.stream()
                .map(hv -> toDeviceResponse(hv, machinesByHostId, latestVersion))
                .filter(Objects::nonNull)
                .filter(row -> matchesDeviceSearch(row, search))
                .toList();
        return paginateList(all, page, perPage);
    }

    private static SoftwareOnDeviceResponse toDeviceResponse(HostVersion hv, Map<Long, Machine> machinesByHostId,
                                                             String latestVersion) {
        Machine device = hv.host().getId() == null ? null : machinesByHostId.get(hv.host().getId());
        if (device == null) {
            return null;
        }
        SoftwareOnDeviceStatus status = latestVersion != null && latestVersion.equals(hv.version())
                ? SoftwareOnDeviceStatus.UP_TO_DATE : SoftwareOnDeviceStatus.OUTDATED;
        return SoftwareOnDeviceResponse.builder()
                .device(device)
                .softwareVersion(hv.version())
                .status(status)
                .build();
    }

    private static boolean matchesDeviceSearch(SoftwareOnDeviceResponse row, String search) {
        if (!hasText(search)) {
            return true;
        }
        String needle = search.toLowerCase(Locale.ROOT);
        Machine d = row.getDevice();
        return (d.getHostname() != null && d.getHostname().toLowerCase(Locale.ROOT).contains(needle))
                || (row.getSoftwareVersion() != null && row.getSoftwareVersion().toLowerCase(Locale.ROOT).contains(needle));
    }

    private static <T> PageResult<T> paginateList(List<T> all, int page, Integer perPage) {
        int size = perPage != null && perPage > 0 ? perPage : all.size();
        int from = Math.max(0, page * size);
        int to = size == 0 ? 0 : Math.min(all.size(), from + size);
        List<T> slice = from >= to ? List.of() : List.copyOf(all.subList(from, to));
        return new PageResult<>(slice, to < all.size(), from > 0, all.size(), page);
    }

    private record HostVersion(Host host, String version) {
    }

    /** Per-title scan cap when computing filter facet counts (one Fleet page). */
    private static final int FILTERS_SCAN_LIMIT = 1000;

    /**
     * Faceted filter-option counts for the software list — Source / Version-status / Severity dropdowns.
     * Fleet has no facet endpoint, so we scan the (searched) software titles and tally each dimension.
     * Bounded to {@link #FILTERS_SCAN_LIMIT} titles.
     */
    public SoftwareFilters getSoftwareFilters(String search) {
        List<SoftwareResponse> titles = listSoftware(search, 0, FILTERS_SCAN_LIMIT, null, null, null).items();
        return SoftwareFilters.builder()
                .sources(facet(titles, SoftwareResponse::getSource))
                .versionStatuses(facet(titles, SoftwareResponse::getVersionStatus))
                .severities(facet(titles, row -> row.getVulnerabilitySummary() == null
                        ? null : row.getVulnerabilitySummary().getHighestSeverity()))
                .build();
    }

    private static <E extends Enum<E>> List<SoftwareFilterOption> facet(List<SoftwareResponse> titles,
                                                                        Function<SoftwareResponse, E> dimension) {
        Map<E, Long> counts = titles.stream()
                .map(dimension)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        return counts.entrySet().stream()
                .sorted(Comparator.comparingInt(e -> e.getKey().ordinal()))
                .map(e -> SoftwareFilterOption.builder()
                        .value(e.getKey().name())
                        .label(humanize(e.getKey().name()))
                        .count(e.getValue().intValue())
                        .build())
                .toList();
    }

    private static String humanize(String enumName) {
        String lower = enumName.toLowerCase(Locale.ROOT).replace('_', ' ');
        return lower.isEmpty() ? lower : Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private static Optional<Long> parseNumericId(String softwareId) {
        if (!hasText(softwareId)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Long.parseLong(softwareId));
        } catch (NumberFormatException e) {
            log.debug("softwareId={} is not numeric — Fleet ids are numeric, returning empty", softwareId);
            return Optional.empty();
        }
    }

    private static List<VersionCve> collectVersionCves(List<SoftwareTitleVersion> versions) {
        return versions.stream()
                .filter(v -> v.getVulnerabilities() != null)
                .flatMap(v -> v.getVulnerabilities().stream()
                        .filter(cve -> hasText(cve))
                        .map(cve -> new VersionCve(v.getVersion(), cve)))
                .toList();
    }

    private static Set<String> uniqueCves(List<VersionCve> pairs) {
        return pairs.stream().map(VersionCve::cve).collect(Collectors.toSet());
    }

    private Map<String, Vulnerability> enrichCves(Set<String> cves) {
        return cves.parallelStream().collect(Collectors.toConcurrentMap(
                cve -> cve,
                cve -> Optional.ofNullable(fleet.call(
                        client -> client.getVulnerability(cve),
                        "get Fleet vulnerability " + cve)).orElse(null)));
    }

    private static boolean matchesSearch(SoftwareVulnerabilityResponse row, String search) {
        if (!hasText(search)) {
            return true;
        }
        String needle = search.toLowerCase(Locale.ROOT);
        return row.getCveId() != null && row.getCveId().toLowerCase(Locale.ROOT).contains(needle);
    }

    private static Comparator<SoftwareVulnerabilityResponse> comparator(String field, boolean ascending) {
        Comparator<SoftwareVulnerabilityResponse> base = switch (field == null ? "" : field) {
            case "severity", "cvssScore" -> Comparator.comparing(
                    SoftwareVulnerabilityResponse::getCvssScore,
                    Comparator.nullsLast(Comparator.naturalOrder()));
            case "publishedAt", "published" -> Comparator.comparing(
                    SoftwareVulnerabilityResponse::getPublishedAt,
                    Comparator.nullsLast(Comparator.naturalOrder()));
            default -> Comparator.comparing(
                    SoftwareVulnerabilityResponse::getCveId,
                    Comparator.nullsLast(Comparator.naturalOrder()));
        };
        return ascending ? base : base.reversed();
    }

    private static PageResult<SoftwareVulnerabilityResponse> paginate(List<SoftwareVulnerabilityResponse> all,
                                                                     int page, Integer perPage) {
        int size = perPage != null && perPage > 0 ? perPage : all.size();
        int from = Math.max(0, page * size);
        int to = Math.min(all.size(), from + size);
        List<SoftwareVulnerabilityResponse> slice = from >= to ? List.of() : List.copyOf(all.subList(from, to));
        return new PageResult<>(slice, to < all.size(), from > 0, all.size(), page);
    }

    private record VersionCve(String version, String cve) {
    }
}
