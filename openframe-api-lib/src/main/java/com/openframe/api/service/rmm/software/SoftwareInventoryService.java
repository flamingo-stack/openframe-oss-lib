package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterOption;
import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceStatus;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.util.FleetSoftwareMapper;
import com.openframe.api.util.FleetVulnerabilityMapper;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.FleetTenantHeader;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;
import com.openframe.sdk.fleetmdm.model.SoftwareTitlesResponse;
import com.openframe.sdk.fleetmdm.model.Vulnerability;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
    private static final int HOSTS_PER_TITLE_LIMIT = 500;
    private static final Map<String, String> FLEET_SORT = Map.of(
            "name", "name",
            "devicesCount", "hosts_count");
    private static final Set<String> CLIENT_SORT = Set.of("cveCount", "highestSeverity", "severity");
    private static final String SORTABLE_FIELDS = "name, devicesCount, cveCount, highestSeverity";
    private static final int TITLES_FETCH_PAGE = 500;
    private static final int TITLES_FETCH_CAP = 5000;

    private final IntegratedToolRepository integratedToolRepository;
    private final FleetDeviceCountEnricher deviceCountEnricher;
    private final com.openframe.api.service.rmm.fleet.FleetHostMachineResolver hostMachineResolver;
    private final TenantIdProvider tenantIdProvider;

    @Value("${TENANT_ID:}")
    private String tenantIdEnv;

    @Value("${openframe.fleet.multi-tenancy.enabled}")
    private boolean fleetMultiTenancyEnabled;

    private FleetMdmClient fleet;

    @PostConstruct
    void wireFleetClient() {
        FleetTenantHeader.validate(fleetMultiTenancyEnabled, tenantIdEnv);
        String key = IntegratedToolId.FLEET_SERVER_ID.getValue();
        IntegratedTool tool = integratedToolRepository.findByKey(key)
                .orElseThrow(() -> new IllegalStateException("Fleet MDM tool not configured: " + key));
        this.fleet = new FleetMdmClient(tool.apiUrl(), tool.apiToken(), tenantIdEnv);
    }

    public Optional<SoftwareResponse> findById(String softwareId) {
        return parseNumericId(softwareId)
                .map(fleet::getSoftwareTitle)
                .map(FleetSoftwareMapper::toResponse)
                .map(row -> {
                    enrichRealDevicesCount(List.of(row));
                    return row;
                });
    }

    public PageResult<SoftwareResponse> listSoftware(String search, int page, Integer perPage,
                                                     SortInput sort, Boolean vulnerable) {
        String field = sort == null ? null : sort.getField();
        boolean desc = sort != null && sort.getDirection() == SortDirection.DESC;

        if (field == null || FLEET_SORT.containsKey(field)) {
            String orderKey = field == null ? null : FLEET_SORT.get(field);
            // Fleet rejects order_direction without order_key — send it only when there is a key.
            String orderDirection = orderKey == null ? null : (desc ? "desc" : "asc");
            PageResult<SoftwareResponse> pageResult = fleetPage(search, page, perPage, orderKey, orderDirection, vulnerable);
            // Enrich ONLY the visible page (bounded by perPage) to keep Fleet fan-out predictable.
            enrichRealDevicesCount(pageResult.items());
            return pageResult;
        }
        if (!CLIENT_SORT.contains(field)) {
            throw new BadRequestException("Unknown sort field '" + field + "'. Sortable fields: " + SORTABLE_FIELDS);
        }
        // fetchAllTitles is bounded by TITLES_FETCH_CAP; we sort in memory then enrich only the returned slice.
        List<SoftwareResponse> all = fetchAllTitles(search, vulnerable).stream()
                .sorted(clientComparator(field, desc))
                .toList();
        PageResult<SoftwareResponse> pageResult = paginateList(all, page, perPage);
        enrichRealDevicesCount(pageResult.items());
        return pageResult;
    }

    // Replace Fleet's raw hosts_count with the count of correlated OpenFrame Machines.
    private void enrichRealDevicesCount(List<SoftwareResponse> titles) {
        deviceCountEnricher.enrich(titles,
                row -> hostsForTitle(row.getId()),
                SoftwareResponse::setDevicesCount);
    }

    private List<Host> hostsForTitle(String titleIdStr) {
        return parseNumericId(titleIdStr)
                .map(titleId -> {
                    HostSearchRequest request = new HostSearchRequest();
                    request.setSoftwareTitleId(titleId);
                    request.setPerPage(HOSTS_PER_TITLE_LIMIT);
                    return fleet.searchHosts(request);
                })
                .orElseGet(List::of);
    }

    private PageResult<SoftwareResponse> fleetPage(String search, int page, Integer perPage, String orderKey,
                                                   String orderDirection, Boolean vulnerable) {
        SoftwareTitleRequest request = SoftwareTitleRequest.builder()
                .page(page).perPage(perPage).query(search)
                .orderKey(orderKey).orderDirection(orderDirection)
                .vulnerable(vulnerable)
                .build();
        SoftwareTitlesResponse response = fleet.listSoftwareTitles(request);
        List<SoftwareResponse> items = mapTitles(response);
        boolean hasNext = response.getMeta() != null
                && Boolean.TRUE.equals(response.getMeta().getHasNextResults());
        boolean hasPrev = response.getMeta() != null
                && Boolean.TRUE.equals(response.getMeta().getHasPreviousResults());
        int total = response.getCount() == null ? items.size() : response.getCount();
        return new PageResult<>(items, hasNext, hasPrev, total, page);
    }

    private List<SoftwareResponse> fetchAllTitles(String search, Boolean vulnerable) {
        List<SoftwareResponse> all = new ArrayList<>();
        int page = 0;
        while (all.size() < TITLES_FETCH_CAP) {
            SoftwareTitleRequest request = SoftwareTitleRequest.builder()
                    .page(page).perPage(TITLES_FETCH_PAGE).query(search)
                    .vulnerable(vulnerable)
                    .build();
            SoftwareTitlesResponse response = fleet.listSoftwareTitles(request);
            all.addAll(mapTitles(response));
            boolean hasNext = response.getMeta() != null
                    && Boolean.TRUE.equals(response.getMeta().getHasNextResults());
            if (!hasNext || response.getSoftwareTitles() == null || response.getSoftwareTitles().isEmpty()) {
                break;
            }
            page++;
        }
        return all;
    }

    private static List<SoftwareResponse> mapTitles(SoftwareTitlesResponse response) {
        return response.getSoftwareTitles() == null ? List.of()
                : response.getSoftwareTitles().stream()
                        .map(FleetSoftwareMapper::toResponse)
                        .filter(Objects::nonNull)
                        .toList();
    }

    private static Comparator<SoftwareResponse> clientComparator(String field, boolean desc) {
        Comparator<SoftwareResponse> base = switch (field) {
            case "cveCount" -> Comparator.comparingInt(SoftwareInventoryService::cveCount);
            case "highestSeverity", "severity" -> Comparator.comparingInt(SoftwareInventoryService::severityRank);
            default -> throw new BadRequestException(
                    "Unknown sort field '" + field + "'. Sortable fields: " + SORTABLE_FIELDS);
        };
        Comparator<SoftwareResponse> directed = desc ? base.reversed() : base;
        // Stable tiebreaker: name ascending, case-insensitive, regardless of the primary direction.
        return directed.thenComparing(row -> row.getName() == null ? "" : row.getName(),
                String.CASE_INSENSITIVE_ORDER);
    }

    private static int cveCount(SoftwareResponse row) {
        return row.getVulnerabilitySummary() == null ? 0 : row.getVulnerabilitySummary().getCveCount();
    }

    private static int severityRank(SoftwareResponse row) {
        SoftwareCveSeverity s = row.getVulnerabilitySummary() == null
                ? null : row.getVulnerabilitySummary().getHighestSeverity();
        return s == null ? 0 : switch (s) {
            case CRITICAL -> 4;
            case HIGH -> 3;
            case MEDIUM -> 2;
            case LOW -> 1;
            case NONE -> 0;
        };
    }

    public PageResult<SoftwareVulnerabilityResponse> listVulnerabilitiesForSoftware(
            String softwareId, String search, int page, Integer perPage,
            String sortField, boolean sortAsc) {
        Optional<Long> parsed = parseNumericId(softwareId);
        if (parsed.isEmpty()) {
            return PageResult.empty(page);
        }
        SoftwareTitle title = fleet.getSoftwareTitle(parsed.get());
        if (title == null || title.getVersions() == null || title.getVersions().isEmpty()) {
            return PageResult.empty(page);
        }
        List<VersionCve> pairs = collectVersionCves(title.getVersions());
        if (pairs.isEmpty()) {
            return PageResult.empty(page);
        }
        Map<String, Vulnerability> enrichment = enrichCves(uniqueCves(pairs));
        Map<String, List<String>> versionsByCve = pairs.stream()
                .collect(Collectors.groupingBy(VersionCve::cve, java.util.LinkedHashMap::new,
                        Collectors.mapping(VersionCve::version, Collectors.toList())));
        List<SoftwareVulnerabilityResponse> all = versionsByCve.entrySet().stream()
                .map(e -> FleetVulnerabilityMapper.toResponse(e.getKey(), enrichment.get(e.getKey()),
                        joinVersions(e.getValue())))
                .filter(Objects::nonNull)
                .filter(v -> matchesSearch(v, search))
                .sorted(comparator(sortField, sortAsc))
                .toList();
        return paginate(all, page, perPage);
    }

    public PageResult<SoftwareOnDeviceResponse> listDevicesForSoftware(String softwareId,
                                                                       SoftwareOnDeviceFilterInput filter,
                                                                       String search, int page, Integer perPage) {
        List<SoftwareOnDeviceResponse> all = allDevicesForSoftware(softwareId, search).stream()
                .filter(row -> matchesStatusFilter(row, filter))
                .toList();
        return paginateList(all, page, perPage);
    }

    private static boolean matchesStatusFilter(SoftwareOnDeviceResponse row, SoftwareOnDeviceFilterInput filter) {
        if (filter == null || filter.getStatuses() == null || filter.getStatuses().isEmpty()) {
            return true;
        }
        return row.getStatus() != null && filter.getStatuses().contains(row.getStatus());
    }

    public SoftwareOnDeviceFilters getSoftwareDeviceFilters(String softwareId, String search) {
        Map<SoftwareOnDeviceStatus, Long> counts = allDevicesForSoftware(softwareId, search).stream()
                .map(SoftwareOnDeviceResponse::getStatus)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        List<SoftwareFilterOption> statuses = counts.entrySet().stream()
                .sorted(Comparator.comparingInt(e -> e.getKey().ordinal()))
                .map(e -> SoftwareFilterOption.builder()
                        .value(e.getKey().name())
                        .label(humanize(e.getKey().name()))
                        .count(e.getValue().intValue())
                        .build())
                .toList();
        return SoftwareOnDeviceFilters.builder().statuses(statuses).build();
    }

    private List<SoftwareOnDeviceResponse> allDevicesForSoftware(String softwareId, String search) {
        Optional<Long> titleId = parseNumericId(softwareId);
        if (titleId.isEmpty()) {
            return List.of();
        }
        SoftwareTitle title = fleet.getSoftwareTitle(titleId.get());
        if (title == null || title.getVersions() == null || title.getVersions().isEmpty()) {
            return List.of();
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
            List<Host> hosts = fleet.searchHosts(request);
            hosts.forEach(host -> hostVersions.add(new HostVersion(host, version.getVersion())));
        }

        Map<Long, Machine> machinesByHostId = hostMachineResolver.resolve(
                tenantIdProvider.getTenantId(), hostVersions.stream().map(HostVersion::host).toList());

        return hostVersions.stream()
                .map(hv -> toDeviceResponse(hv, machinesByHostId, latestVersion))
                .filter(Objects::nonNull)
                .filter(row -> matchesDeviceSearch(row, search))
                .toList();
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

    public SoftwareFilters getSoftwareFilters(String search) {
        // Facet counts don't depend on the enriched devicesCount, so bypass enrichRealDevicesCount
        // here — it would fire N Fleet /hosts lookups just to produce numbers we don't use.
        List<SoftwareResponse> titles = fetchAllTitles(search, null);
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

    private static String joinVersions(List<String> versions) {
        return versions.stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted(SoftwareInventoryService::compareVersions)
                .collect(Collectors.joining(", "));
    }

    // Numeric, segment-wise version order so "9.0" precedes "10.0" (plain String sort would not).
    private static int compareVersions(String a, String b) {
        String[] pa = a.split("\\.");
        String[] pb = b.split("\\.");
        for (int i = 0; i < Math.max(pa.length, pb.length); i++) {
            int va = i < pa.length ? parseSegment(pa[i]) : 0;
            int vb = i < pb.length ? parseSegment(pb[i]) : 0;
            if (va != vb) {
                return Integer.compare(va, vb);
            }
        }
        return a.compareTo(b);
    }

    private static int parseSegment(String segment) {
        try {
            return Integer.parseInt(segment.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Map<String, Vulnerability> enrichCves(Set<String> cves) {
        // ConcurrentHashMap rejects null values, and Fleet returns null for a CVE it has no record of
        // (404) — collect only the resolved ones; callers null-coalesce a missing key.
        Map<String, Vulnerability> enrichment = new java.util.concurrent.ConcurrentHashMap<>();
        cves.parallelStream().forEach(cve -> {
            Vulnerability detail = fleet.getVulnerability(cve);
            if (detail != null) {
                enrichment.put(cve, detail);
            }
        });
        return enrichment;
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
            case "discoveredAt", "discovered" -> Comparator.comparing(
                    SoftwareVulnerabilityResponse::getDiscoveredAt,
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
