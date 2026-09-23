package com.openframe.api.service.rmm.device;

import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVersionStatus;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.dto.rmm.vulnerability.AffectedSoftwareResponse;
import com.openframe.api.dto.rmm.vulnerability.VulnerabilityFilterInput;
import com.openframe.api.dto.rmm.vulnerability.VulnerabilityResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.service.rmm.fleet.FleetHostMachineResolver;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.api.service.rmm.vulnerability.FleetGlobalVulnerabilityMapper;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.FleetTenantHeader;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareResponse;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.sdk.fleetmdm.model.HostVulnerabilityInventory;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.apache.commons.lang3.StringUtils.containsIgnoreCase;
import static org.apache.commons.lang3.StringUtils.firstNonBlank;
import static org.springframework.util.CollectionUtils.isEmpty;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DeviceInventoryService {

    private static final int SOFTWARE_FETCH_PAGE = 500;
    private static final int SOFTWARE_FETCH_CAP = 5000;
    private static final int HOSTS_PER_ROW_LIMIT = 500;
    private static final String SOFTWARE_SORTABLE_FIELDS = "name, cveCount, highestSeverity";
    private static final String VULNERABILITY_SORTABLE_FIELDS = "severity, discoveredAt";

    private static final Comparator<SoftwareResponse> BY_NAME =
            Comparator.comparing(DeviceInventoryService::nameOf, String.CASE_INSENSITIVE_ORDER);
    private static final Comparator<VulnerabilityResponse> BY_CVE_ID =
            Comparator.comparing(VulnerabilityResponse::getCveId, Comparator.nullsLast(Comparator.naturalOrder()));

    private final IntegratedToolRepository integratedToolRepository;
    private final DeviceService deviceService;
    private final FleetHostMachineResolver hostMachineResolver;
    private final FleetDeviceCountEnricher deviceCountEnricher;
    private final TenantIdProvider tenantIdProvider;

    @Value("${TENANT_ID:}")
    private String tenantIdEnv;

    @Value("${openframe.fleet.multi-tenancy.enabled}")
    private boolean fleetMultiTenancyEnabled;

    private FleetMdmClient fleet;

    private FleetMdmClient fleet() {
        FleetMdmClient client = fleet;
        if (client == null) {
            FleetTenantHeader.validate(fleetMultiTenancyEnabled, tenantIdEnv);
            String key = IntegratedToolId.FLEET_SERVER_ID.getValue();
            IntegratedTool tool = integratedToolRepository.findByKey(key)
                    .orElseThrow(() -> new IllegalStateException("Fleet MDM tool not configured: " + key));
            client = new FleetMdmClient(tool.apiUrl(), tool.apiToken(), tenantIdEnv);
            fleet = client;
        }
        return client;
    }

    public PageResult<SoftwareResponse> listSoftware(String machineId, SoftwareFilterInput filter, String search,
                                                     int page, Integer perPage, SortInput sort) {
        Comparator<SoftwareResponse> order = softwareOrder(sort);
        Machine machine = requireMachine(machineId);
        return findHostId(machine)
                .map(hostId -> softwareRows(hostId, filter, search, order))
                .map(rows -> softwarePage(rows, page, perPage))
                .orElseGet(() -> PageResult.empty(page));
    }

    public PageResult<VulnerabilityResponse> listVulnerabilities(String machineId, VulnerabilityFilterInput filter,
                                                                 String search, int page, Integer perPage,
                                                                 SortInput sort) {
        Comparator<VulnerabilityResponse> order = vulnerabilityOrder(sort);
        Machine machine = requireMachine(machineId);
        return findHostId(machine)
                .map(hostId -> vulnerabilityRows(hostId, filter, search, order))
                .map(rows -> vulnerabilityPage(rows, page, perPage))
                .orElseGet(() -> PageResult.empty(page));
    }

    private Machine requireMachine(String machineId) {
        return deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new NotFoundException("Device not found: " + machineId));
    }

    private Optional<Long> findHostId(Machine machine) {
        String lookupKey = firstNonBlank(machine.getOsUuid(), machine.getSerialNumber(), machine.getHostname());
        if (!hasText(lookupKey)) {
            return Optional.empty();
        }
        List<Host> candidates = fleet().searchHosts(lookupKey);
        String tenantId = tenantIdProvider.getTenantId();
        Map<Long, Machine> machinesByHostId = hostMachineResolver.resolve(tenantId, candidates);
        Optional<Long> hostId = machinesByHostId.entrySet().stream()
                .filter(entry -> isSameMachine(entry.getValue(), machine))
                .map(Map.Entry::getKey)
                .findFirst();
        if (hostId.isEmpty()) {
            log.debug("No Fleet host correlates to machineId={}", machine.getMachineId());
        }
        return hostId;
    }

    private static boolean isSameMachine(Machine candidate, Machine machine) {
        return Objects.equals(candidate.getMachineId(), machine.getMachineId());
    }

    private List<SoftwareResponse> softwareRows(long hostId, SoftwareFilterInput filter, String search,
                                                Comparator<SoftwareResponse> order) {
        HostInventory inventory = loadInventory(hostId);
        return inventory.getTitles().stream()
                .map(title -> toSoftwareRow(title, inventory))
                .filter(row -> matchesSoftwareFilter(row, filter))
                .filter(row -> matchesSoftwareSearch(row, search))
                .sorted(order)
                .toList();
    }

    private List<VulnerabilityResponse> vulnerabilityRows(long hostId, VulnerabilityFilterInput filter, String search,
                                                          Comparator<VulnerabilityResponse> order) {
        HostInventory inventory = loadInventory(hostId);
        return toVulnerabilityRows(inventory).stream()
                .filter(row -> matchesVulnerabilityFilter(row, filter))
                .filter(row -> matchesVulnerabilitySearch(row, search))
                .sorted(order)
                .toList();
    }

    private PageResult<SoftwareResponse> softwarePage(List<SoftwareResponse> rows, int page, Integer perPage) {
        PageResult<SoftwareResponse> result = PageResult.slice(rows, page, perPage);
        deviceCountEnricher.enrich(result.items(), row -> hostsForTitle(row.getId()), SoftwareResponse::setDevicesCount);
        return result;
    }

    private PageResult<VulnerabilityResponse> vulnerabilityPage(List<VulnerabilityResponse> rows, int page,
                                                                Integer perPage) {
        PageResult<VulnerabilityResponse> result = PageResult.slice(rows, page, perPage);
        deviceCountEnricher.enrich(result.items(), row -> hostsForCve(row.getCveId()),
                VulnerabilityResponse::setDevicesCount);
        return result;
    }

    private HostInventory loadInventory(long hostId) {
        List<HostSoftwareTitle> titles = fetchAllTitles(hostId);
        Map<String, FleetVulnerability> details = indexHostVulnerabilities(hostId);
        return new HostInventory(titles, details);
    }

    private List<HostSoftwareTitle> fetchAllTitles(long hostId) {
        List<HostSoftwareTitle> all = new ArrayList<>();
        int page = 0;
        while (all.size() < SOFTWARE_FETCH_CAP) {
            HostSoftwareResponse response = fleet().listHostSoftware(hostId, page, SOFTWARE_FETCH_PAGE);
            if (response == null || isEmpty(response.getSoftware())) {
                break;
            }
            all.addAll(response.getSoftware());
            if (!hasNextPage(response)) {
                break;
            }
            page++;
        }
        return all;
    }

    private static boolean hasNextPage(HostSoftwareResponse response) {
        return response.getMeta() != null && Boolean.TRUE.equals(response.getMeta().getHasNextResults());
    }

    private Map<String, FleetVulnerability> indexHostVulnerabilities(long hostId) {
        HostVulnerabilityInventory host = fleet().getHostVulnerabilityInventoryById(hostId);
        if (host == null || isEmpty(host.software())) {
            return Map.of();
        }
        Map<String, FleetVulnerability> index = new HashMap<>();
        host.software().forEach(software -> indexSoftwareVulnerabilities(software, index));
        return index;
    }

    private static void indexSoftwareVulnerabilities(FleetSoftware software, Map<String, FleetVulnerability> index) {
        if (isEmpty(software.getVulnerabilities())) {
            return;
        }
        for (FleetVulnerability vulnerability : software.getVulnerabilities()) {
            String key = softwareCveKey(software.getName(), software.getVersion(), vulnerability.getCve());
            index.putIfAbsent(key, vulnerability);
        }
    }

    private static String softwareCveKey(String name, String version, String cve) {
        return name + '|' + version + '|' + cve;
    }

    private static SoftwareResponse toSoftwareRow(HostSoftwareTitle title, HostInventory inventory) {
        List<CveHit> hits = hitsOf(title).toList();
        SoftwareSource source = FleetSoftwareCategory.of(title.getSource()).source();
        return SoftwareResponse.builder()
                .id(Objects.toString(title.getId(), null))
                .name(title.getName())
                .source(source)
                .currentVersion(installedVersion(title))
                .olderVersionsCount(olderVersionsCount(title))
                .vulnerabilitySummary(summarize(hits, inventory))
                .build();
    }

    private static String installedVersion(HostSoftwareTitle title) {
        return versionsOf(title).stream()
                .map(HostSoftwareInstalledVersion::getVersion)
                .findFirst()
                .orElse(null);
    }

    private static int olderVersionsCount(HostSoftwareTitle title) {
        return Math.max(0, versionsOf(title).size() - 1);
    }

    private static SoftwareVulnerabilitySummaryResponse summarize(List<CveHit> hits, HostInventory inventory) {
        if (hits.isEmpty()) {
            return null;
        }
        long cveCount = hits.stream().map(CveHit::getCve).distinct().count();
        SoftwareCveSeverity highest = hits.stream()
                .map(inventory::detail)
                .flatMap(Optional::stream)
                .map(FleetVulnerability::getCvssScore)
                .map(FleetGlobalVulnerabilityMapper::bucketSeverity)
                .filter(Objects::nonNull)
                .max(Comparator.comparingInt(DeviceInventoryService::severityRank))
                .orElse(null);
        return SoftwareVulnerabilitySummaryResponse.builder()
                .cveCount((int) cveCount)
                .highestSeverity(highest)
                .build();
    }

    private static List<VulnerabilityResponse> toVulnerabilityRows(HostInventory inventory) {
        Map<String, List<CveHit>> hitsByCve = inventory.getTitles().stream()
                .flatMap(DeviceInventoryService::hitsOf)
                .collect(Collectors.groupingBy(CveHit::getCve, LinkedHashMap::new, Collectors.toList()));
        return hitsByCve.entrySet().stream()
                .map(entry -> toVulnerabilityRow(entry.getKey(), entry.getValue(), inventory))
                .toList();
    }

    private static VulnerabilityResponse toVulnerabilityRow(String cve, List<CveHit> hits, HostInventory inventory) {
        FleetVulnerability detail = hits.stream()
                .map(inventory::detail)
                .flatMap(Optional::stream)
                .findFirst()
                .orElse(null);
        List<AffectedSoftwareResponse> affected = hits.stream()
                .map(hit -> toAffected(hit, inventory))
                .toList();
        return FleetGlobalVulnerabilityMapper.toHostRow(cve, detail, affected);
    }

    private static AffectedSoftwareResponse toAffected(CveHit hit, HostInventory inventory) {
        HostSoftwareTitle title = hit.getTitle();
        SoftwareSource source = FleetSoftwareCategory.of(title.getSource()).source();
        String resolvedInVersion = inventory.detail(hit)
                .map(FleetVulnerability::getResolvedInVersion)
                .orElse(null);
        return AffectedSoftwareResponse.builder()
                .id(Objects.toString(title.getId(), null))
                .name(title.getName())
                .source(source)
                .version(hit.getVersion())
                .resolvedInVersion(resolvedInVersion)
                .build();
    }

    private static Stream<CveHit> hitsOf(HostSoftwareTitle title) {
        return versionsOf(title).stream().flatMap(installed -> hitsOf(title, installed));
    }

    private static Stream<CveHit> hitsOf(HostSoftwareTitle title, HostSoftwareInstalledVersion installed) {
        List<String> cves = installed.getVulnerabilities() == null ? List.of() : installed.getVulnerabilities();
        return cves.stream()
                .filter(cve -> hasText(cve))
                .map(cve -> new CveHit(title, installed.getVersion(), cve));
    }

    private static List<HostSoftwareInstalledVersion> versionsOf(HostSoftwareTitle title) {
        return title.getInstalledVersions() == null ? List.of() : title.getInstalledVersions();
    }

    private static Comparator<SoftwareResponse> softwareOrder(SortInput sort) {
        if (sort == null || !hasText(sort.getField())) {
            return BY_NAME;
        }
        Comparator<SoftwareResponse> base = switch (sort.getField()) {
            case "name" -> BY_NAME;
            case "cveCount" -> Comparator.comparingInt(DeviceInventoryService::cveCount);
            case "highestSeverity" -> Comparator.comparingInt(DeviceInventoryService::severityRank);
            default -> throw new BadRequestException(
                    "Unknown sort field '" + sort.getField() + "'. Sortable fields: " + SOFTWARE_SORTABLE_FIELDS);
        };
        Comparator<SoftwareResponse> directed = isDescending(sort) ? base.reversed() : base;
        return directed.thenComparing(BY_NAME);
    }

    private static Comparator<VulnerabilityResponse> vulnerabilityOrder(SortInput sort) {
        if (sort == null || !hasText(sort.getField())) {
            return Comparator.comparing(VulnerabilityResponse::getCvssScore, directed(SortDirection.DESC))
                    .thenComparing(BY_CVE_ID);
        }
        Comparator<Double> cvssOrder = directed(sort.getDirection());
        Comparator<Instant> instantOrder = directed(sort.getDirection());
        Comparator<VulnerabilityResponse> base = switch (sort.getField()) {
            case "severity" -> Comparator.comparing(VulnerabilityResponse::getCvssScore, cvssOrder);
            case "discoveredAt" -> Comparator.comparing(VulnerabilityResponse::getDiscoveredAt, instantOrder);
            default -> throw new BadRequestException(
                    "Unknown sort field '" + sort.getField() + "'. Sortable fields: " + VULNERABILITY_SORTABLE_FIELDS);
        };
        return base.thenComparing(BY_CVE_ID);
    }

    private static <T extends Comparable<T>> Comparator<T> directed(SortDirection direction) {
        Comparator<T> natural = Comparator.naturalOrder();
        return Comparator.nullsLast(direction == SortDirection.DESC ? natural.reversed() : natural);
    }

    private static boolean isDescending(SortInput sort) {
        return sort.getDirection() == SortDirection.DESC;
    }

    private static boolean matchesSoftwareFilter(SoftwareResponse row, SoftwareFilterInput filter) {
        if (filter == null) {
            return true;
        }
        return matchesSources(row, filter.getSources())
                && matchesVersionStatuses(row, filter.getVersionStatuses())
                && meetsMinSeverity(highestSeverity(row), filter.getMinSeverity());
    }

    private static boolean matchesSources(SoftwareResponse row, List<SoftwareSource> sources) {
        return isEmpty(sources) || sources.contains(row.getSource());
    }

    private static boolean matchesVersionStatuses(SoftwareResponse row, List<SoftwareVersionStatus> statuses) {
        return isEmpty(statuses) || statuses.contains(row.getVersionStatus());
    }

    private static boolean matchesVulnerabilityFilter(VulnerabilityResponse row, VulnerabilityFilterInput filter) {
        if (filter == null) {
            return true;
        }
        return meetsMinSeverity(row.getSeverity(), filter.getMinSeverity())
                && matchesExploited(row, filter.getExploited());
    }

    private static boolean matchesExploited(VulnerabilityResponse row, Boolean exploitedOnly) {
        return !Boolean.TRUE.equals(exploitedOnly) || Boolean.TRUE.equals(row.getCisaKnownExploit());
    }

    private static boolean meetsMinSeverity(SoftwareCveSeverity actual, SoftwareCveSeverity min) {
        if (min == null || min == SoftwareCveSeverity.NONE) {
            return true;
        }
        return actual != null && severityRank(actual) >= severityRank(min);
    }

    private static boolean matchesSoftwareSearch(SoftwareResponse row, String search) {
        return !hasText(search)
                || containsIgnoreCase(row.getName(), search)
                || containsIgnoreCase(row.getPublisher(), search);
    }

    private static boolean matchesVulnerabilitySearch(VulnerabilityResponse row, String search) {
        return !hasText(search)
                || containsIgnoreCase(row.getCveId(), search)
                || affectsTitleNamed(row, search);
    }

    private static boolean affectsTitleNamed(VulnerabilityResponse row, String search) {
        return row.getAffectedSoftware().stream()
                .anyMatch(software -> containsIgnoreCase(software.getName(), search));
    }

    private List<Host> hostsForTitle(String titleId) {
        HostSearchRequest request = new HostSearchRequest();
        request.setSoftwareTitleId(Long.parseLong(titleId));
        request.setPerPage(HOSTS_PER_ROW_LIMIT);
        return fleet().searchHosts(request);
    }

    private List<Host> hostsForCve(String cveId) {
        HostSearchRequest request = new HostSearchRequest();
        request.setCve(cveId);
        request.setPerPage(HOSTS_PER_ROW_LIMIT);
        return fleet().searchHosts(request);
    }

    private static String nameOf(SoftwareResponse row) {
        return row.getName() == null ? "" : row.getName();
    }

    private static int cveCount(SoftwareResponse row) {
        return row.getVulnerabilitySummary() == null ? 0 : row.getVulnerabilitySummary().getCveCount();
    }

    private static SoftwareCveSeverity highestSeverity(SoftwareResponse row) {
        return row.getVulnerabilitySummary() == null ? null : row.getVulnerabilitySummary().getHighestSeverity();
    }

    private static int severityRank(SoftwareResponse row) {
        SoftwareCveSeverity severity = highestSeverity(row);
        return severity == null ? 0 : severityRank(severity);
    }

    private static int severityRank(SoftwareCveSeverity severity) {
        return switch (severity) {
            case CRITICAL -> 4;
            case HIGH -> 3;
            case MEDIUM -> 2;
            case LOW -> 1;
            case NONE -> 0;
        };
    }

    @Getter
    @AllArgsConstructor
    private static class HostInventory {

        private final List<HostSoftwareTitle> titles;
        private final Map<String, FleetVulnerability> detailsBySoftwareCve;

        Optional<FleetVulnerability> detail(CveHit hit) {
            String key = softwareCveKey(hit.getTitle().getName(), hit.getVersion(), hit.getCve());
            return Optional.ofNullable(detailsBySoftwareCve.get(key));
        }
    }

    @Getter
    @AllArgsConstructor
    private static class CveHit {

        private final HostSoftwareTitle title;
        private final String version;
        private final String cve;
    }
}
