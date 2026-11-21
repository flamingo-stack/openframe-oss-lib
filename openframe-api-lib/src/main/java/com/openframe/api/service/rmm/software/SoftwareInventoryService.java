package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareAdoptionResponse;
import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareFilterOption;
import com.openframe.api.dto.rmm.software.SoftwareFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceFilters;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareOnDeviceStatus;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.api.service.rmm.fleet.DeviceHostInventoryLoader;
import com.openframe.api.service.rmm.fleet.FleetCalls;
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.api.service.rmm.fleet.FleetSoftwareOs;
import com.openframe.api.service.rmm.fleet.FleetSoftwareType;
import com.openframe.api.service.rmm.fleet.HostInventory;
import com.openframe.api.service.rmm.fleet.HostInventory.CveHit;
import com.openframe.api.service.rmm.vulnerability.FleetGlobalVulnerabilityMapper;
import com.openframe.api.util.FleetSoftwareMapper;
import com.openframe.core.util.SoftwareVersions;
import com.openframe.api.util.FleetVulnerabilityMapper;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareSchedulePackage;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.FleetTenantHeader;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;
import com.openframe.sdk.fleetmdm.model.SoftwareTitlesResponse;
import com.openframe.sdk.fleetmdm.model.Vulnerability;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.data.nats.delivery.PackageAdoptReach;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.BinaryOperator;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static com.openframe.data.document.audit.AuditAction.SOFTWARE_AUTO_UPDATE_DISABLE;
import static org.apache.commons.lang3.StringUtils.containsIgnoreCase;
import static org.springframework.util.CollectionUtils.isEmpty;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareInventoryService {

    private static final int DEVICES_PER_VERSION_LIMIT = 500;
    private static final int HOSTS_PER_TITLE_LIMIT = 500;
    private static final Set<String> SORTABLE = Set.of("name", "devicesCount", "cveCount", "highestSeverity", "severity");
    private static final String SORTABLE_FIELDS = "name, devicesCount, cveCount, highestSeverity";
    private static final String DEFAULT_SORT_FIELD = "name";
    private static final String DEVICE_SORT_FIELD = "softwareVersion";
    private static final String DEFAULT_VULNERABILITY_SORT_FIELD = "cveId";
    private static final int TITLES_FETCH_PAGE = 500;
    private static final int TITLES_FETCH_CAP = 5000;
    private static final Map<String, String> FLEET_ORDER_KEY = Map.of(
            "name", "name",
            "devicesCount", "hosts_count");
    private static final Comparator<FleetVulnerability> EARLIEST_DISCOVERED =
            Comparator.comparing(FleetVulnerability::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));

    private final IntegratedToolRepository integratedToolRepository;
    private final FleetDeviceCountEnricher deviceCountEnricher;
    private final com.openframe.api.service.rmm.fleet.FleetHostMachineResolver hostMachineResolver;
    private final TenantIdProvider tenantIdProvider;
    private final DeviceHostInventoryLoader deviceHostInventoryLoader;
    private final DeviceSoftwareReadModelQuery deviceSoftwareReadModelQuery;
    private final TenantSoftwareReadModelQuery tenantSoftwareReadModelQuery;
    private final SoftwareAutoUpdateService autoUpdateService;
    private final SoftwareCatalogStatus catalogStatus;
    private final TagAssignmentRepository tagAssignmentRepository;
    private final OrganizationRepository organizationRepository;
    private final SoftwareScheduleRepository softwareScheduleRepository;
    private final SoftwareScheduleTargetResolver softwareScheduleTargetResolver;
    private final SoftwareAdoptionService softwareAdoptionService;
    private final PackageManagerAvailability packageManagerAvailability;
    private final PackageAdoptReach packageAdoptReach;
    private final AuditedMethodRunner auditedMethodRunner;

    @Value("${TENANT_ID:}")
    private String tenantIdEnv;

    @Value("${openframe.fleet.multi-tenancy.enabled}")
    private boolean fleetMultiTenancyEnabled;

    @Value("${openframe.rmm.software.fleet-paging.enabled}")
    private boolean fleetPaging;

    @Value("${openframe.features.software-read-model.enabled}")
    private boolean softwareReadModel;

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

    public Optional<SoftwareResponse> findById(String softwareId) {
        if (softwareReadModel) {
            return readModelSoftware(softwareId);
        }
        return parseNumericId(softwareId)
                .map(fleet()::getSoftwareTitle)
                .map(FleetSoftwareMapper::toResponse)
                .map(row -> {
                    if (!fleetPaging) {
                        enrichRealDevicesCount(List.of(row));
                    }
                    List<SoftwareResponse> rows = List.of(row);
                    applyStatuses(rows);
                    return row;
                });
    }

    // the same statuses as the Fleet path: the read model stores no auto-update or catalog state
    private Optional<SoftwareResponse> readModelSoftware(String softwareId) {
        String tenantId = tenantIdProvider.getTenantId();
        if (!tenantSoftwareReadModelQuery.exists(tenantId, softwareId)) {
            return Optional.empty();
        }
        SoftwareResponse row = tenantSoftwareReadModelQuery.get(tenantId, softwareId);
        List<SoftwareResponse> rows = List.of(row);
        applyStatuses(rows);
        applyAdoptionCounts(rows);
        return Optional.of(row);
    }

    public PackageCatalogEntry getManagingPackage(String softwareId) {
        SoftwareResponse software = getManagedSoftware(softwareId);
        return software.getManagingPackage();
    }

    private SoftwareResponse getManagedSoftware(String softwareId) {
        SoftwareResponse software = getSoftware(softwareId);
        if (software.getManagingPackage() == null) {
            throw new BadRequestException("No package manager manages " + software.getName());
        }
        return software;
    }

    public SoftwareResponse getAdoptableSoftware(String softwareId) {
        SoftwareResponse software = getSoftware(softwareId);
        if (software.getAdoptionPackage() == null) {
            throw new BadRequestException("No package to adopt " + software.getName() + " into");
        }
        return software;
    }

    // only the read model knows where a device keeps its copy and which casks brew installed there: on the Fleet
    // path every device stays
    public List<String> withoutCopiesNotToAdopt(String softwareId, SoftwareBundlePackage adoptionPackage,
                                                List<String> machineIds) {
        if (!softwareReadModel) {
            return machineIds;
        }
        String tenantId = tenantIdProvider.getTenantId();
        Long softwareTitleId = Long.valueOf(softwareId);
        Set<String> userApplicationsOnly = deviceSoftwareReadModelQuery.machinesWithUserApplicationsOnlyCopy(
                tenantId, softwareTitleId, machineIds);
        Set<String> withCask = machinesWithCask(tenantId, machineIds, adoptionPackage);
        return machineIds.stream()
                .filter(machineId -> !userApplicationsOnly.contains(machineId))
                .filter(machineId -> !withCask.contains(machineId))
                .toList();
    }

    private Set<String> machinesWithCask(String tenantId, Collection<String> machineIds,
                                         SoftwareBundlePackage adoptionPackage) {
        String cask = caskTokenOf(adoptionPackage);
        if (cask == null) {
            return Set.of();
        }
        return deviceSoftwareReadModelQuery.caskTokensByMachineId(tenantId, machineIds).entrySet().stream()
                .filter(casksOnMachine -> casksOnMachine.getValue().contains(cask))
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());
    }

    private static String caskTokenOf(SoftwareBundlePackage adoptionPackage) {
        boolean cask = adoptionPackage != null && adoptionPackage.getPackageManager() == PackageManagerType.BREW
                && adoptionPackage.getBrewPackageType() == BrewPackageType.CASK
                && adoptionPackage.getPackageName() != null;
        return cask ? adoptionPackage.getPackageName().toLowerCase(Locale.ROOT) : null;
    }

    private SoftwareResponse getSoftware(String softwareId) {
        return findById(softwareId)
                .orElseThrow(() -> new NotFoundException("Software not found: " + softwareId));
    }

    public AutoUpdateTurnedOn turnOnAutoUpdate(String softwareId, List<String> machineIds,
                                               PackageUpdateSettings settings, String actor) {
        SoftwareResponse software = getManagedSoftware(softwareId);
        PackageCatalogEntry managingPackage = software.getManagingPackage();
        SoftwareAutoUpdateService.TurnedOn devices =
                autoUpdateService.turnOn(softwareId, managingPackage, machineIds, settings, actor);
        List<SoftwareResponse> rows = List.of(software);
        applyStatuses(rows);
        return new AutoUpdateTurnedOn(software, devices.added(), devices.removed());
    }

    public record AutoUpdateTurnedOn(SoftwareResponse software, List<String> added, List<String> removed) {
    }

    // Fleet lists a title only after its periodic host count, so a title just seen on a device can be unknown there
    // while a policy already names it: the policy is enough to turn off, and nothing is written for an unknown id.
    public SoftwareResponse turnOffAutoUpdate(String softwareId, String actor) {
        AuditCall call = AuditCall.of(SOFTWARE_AUTO_UPDATE_DISABLE, softwareId)
                .withCompare(false)
                .withTargetNameOf(SoftwareInventoryService::nameOf)
                .withDetailsFromResult(result -> result instanceof TurnedOff turnedOff
                        ? Map.of("machineIds", turnedOff.machineIds(), "removed", turnedOff.machineIds()) : Map.of())
                .withRecordsResult(result -> result instanceof TurnedOff turnedOff
                        && !turnedOff.machineIds().isEmpty());
        return auditedMethodRunner.run(call, () -> disableAutoUpdate(softwareId, actor)).software();
    }

    private record TurnedOff(SoftwareResponse software, List<String> machineIds) {
    }

    private static String nameOf(Object result) {
        return result instanceof TurnedOff turnedOff ? turnedOff.software().getName() : null;
    }

    private TurnedOff disableAutoUpdate(String softwareId, String actor) {
        Optional<SoftwareResponse> title = findById(softwareId);
        boolean inFleet = title.isPresent();
        if (!isKnown(softwareId, inFleet)) {
            throw new NotFoundException("Software not found: " + softwareId);
        }
        List<String> machineIds = autoUpdateService.turnOff(softwareId, actor);
        SoftwareResponse software = title.orElseGet(() -> autoUpdateService.titleFromPolicies(softwareId));
        List<SoftwareResponse> rows = List.of(software);
        applyStatuses(rows);
        return new TurnedOff(software, machineIds);
    }

    private boolean isKnown(String softwareId, boolean inFleet) {
        return inFleet || autoUpdateService.hasPolicy(softwareId);
    }

    private PageResult<SoftwareResponse> readModelSoftware(String search, int page, Integer perPage, SortInput sort,
                                                           Boolean vulnerable, SoftwareFilterInput filter) {
        if (hasVersionStatuses(filter)) {
            String field = sort == null ? null : sort.getField();
            boolean desc = sort != null && sort.getDirection() == SortDirection.DESC;
            return readModelSoftwareOfVersionStatuses(search, page, perPage, field, desc, vulnerable, filter);
        }
        String tenantId = tenantIdProvider.getTenantId();
        PageResult<SoftwareResponse> readModelPage = tenantSoftwareReadModelQuery.listSoftware(tenantId, search,
                page, perPage, sort, vulnerable, filter);
        return withStatuses(readModelPage);
    }

    // manageable: the titles a package manager manages (true) or the others (false). A Fleet page cannot be narrowed
    // by it, sources, autoUpdateStatuses, osTypes or versionStatuses and leaves them out; the read model and the full
    // fetch apply them
    public PageResult<SoftwareResponse> listSoftware(String search, int page, Integer perPage,
                                                     SortInput sort, Boolean vulnerable, SoftwareFilterInput filter) {
        String field = sort == null ? null : sort.getField();
        boolean desc = sort != null && sort.getDirection() == SortDirection.DESC;
        if (field != null && !SORTABLE.contains(field)) {
            throw new BadRequestException("Unknown sort field '" + field + "'. Sortable fields: " + SORTABLE_FIELDS);
        }
        if (softwareReadModel) {
            PageResult<SoftwareResponse> readModelPage =
                    readModelSoftware(search, page, perPage, sort, vulnerable, filter);
            applyAdoptionCounts(readModelPage.items());
            return readModelPage;
        }
        if (fleetPaging) {
            return withStatuses(softwarePageFromFleet(search, page, perPage, sort, vulnerable));
        }

        List<SoftwareTitle> titles = fetchAllTitles(search, vulnerable);
        Map<Long, String> titleIdByVersionId = titleIdByVersionId(titles);
        List<SoftwareResponse> all = mapTitles(titles);
        enrichDevicesCountFromHosts(all, titleIdByVersionId);
        List<SoftwareResponse> withDevices = all.stream()
                .filter(row -> deviceCount(row) > 0)
                .toList();
        boolean statusesOnEveryRow = hasStatusFilter(filter);
        if (statusesOnEveryRow) {
            // the filter reads the source and the auto-update the statuses set, so they go on every row before the
            // page is cut
            applyStatuses(withDevices);
        }
        List<SoftwareResponse> chosen = withDevices.stream()
                .filter(row -> matchesCatalogFilter(row, filter))
                .toList();
        List<SoftwareResponse> ordered = field == null
                ? chosen
                : chosen.stream().sorted(comparatorFor(field, desc)).toList();
        PageResult<SoftwareResponse> result = paginateList(ordered, page, perPage);
        return statusesOnEveryRow ? result : withStatuses(result);
    }

    private PageResult<SoftwareResponse> readModelSoftwareOfVersionStatuses(String search, int page, Integer perPage,
                                                                            String field, boolean desc,
                                                                            Boolean vulnerable,
                                                                            SoftwareFilterInput filter) {
        List<SoftwareResponse> chosen = readModelTitles(search, vulnerable, filter);
        String sortField = field == null ? DEFAULT_SORT_FIELD : field;
        Comparator<SoftwareResponse> order = comparatorFor(sortField, desc);
        List<SoftwareResponse> ordered = chosen.stream().sorted(order).toList();
        return paginateList(ordered, page, perPage);
    }

    private List<SoftwareResponse> readModelTitles(String search, Boolean vulnerable, SoftwareFilterInput filter) {
        String tenantId = tenantIdProvider.getTenantId();
        List<SoftwareResponse> titles = tenantSoftwareReadModelQuery.allTitles(tenantId, search, vulnerable, filter);
        applyStatuses(titles);
        return titles.stream()
                .filter(row -> matchesVersionStatus(row, filter))
                .toList();
    }

    public static Boolean vulnerableOnly(SoftwareFilterInput filter) {
        return filter == null || isNoCutoff(filter.getMinSeverity()) ? null : Boolean.TRUE;
    }

    private static boolean hasVersionStatuses(SoftwareFilterInput filter) {
        return filter != null && !isEmpty(filter.getVersionStatuses());
    }

    private static boolean hasStatusFilter(SoftwareFilterInput filter) {
        return filter != null && (filter.getManageable() != null || !isEmpty(filter.getSources())
                || !isEmpty(filter.getAutoUpdateStatuses()) || !isEmpty(filter.getVersionStatuses()));
    }

    private static boolean matchesVersionStatus(SoftwareResponse row, SoftwareFilterInput filter) {
        return filter == null || selected(filter.getVersionStatuses(), row.getVersionStatus());
    }

    // read model only: a device counts where adoptSoftware would send the order
    private void applyAdoptionCounts(List<SoftwareResponse> rows) {
        rows.forEach(row -> row.setAdoptionCount(0));
        List<SoftwareResponse> adoptable = rows.stream().filter(row -> row.getAdoptionPackage() != null).toList();
        if (adoptable.isEmpty()) {
            return;
        }
        String tenantId = tenantIdProvider.getTenantId();
        List<Long> titleIds = adoptable.stream().map(SoftwareResponse::getId).map(Long::valueOf).toList();
        Map<Long, List<String>> machinesByTitleId =
                deviceSoftwareReadModelQuery.machinesOutsideUserApplicationsByTitleId(tenantId, titleIds);
        List<String> machineIds = machinesByTitleId.values().stream().flatMap(List::stream).distinct().toList();
        if (machineIds.isEmpty()) {
            return;
        }
        List<String> reachable = packageAdoptReach.filterReachable(machineIds);
        Map<PackageManagerType, Set<String>> adoptableByManager = adoptable.stream()
                .map(row -> row.getAdoptionPackage().getPackageManager())
                .distinct()
                .collect(Collectors.toMap(Function.identity(),
                        manager -> Set.copyOf(packageManagerAvailability.adoptableOn(reachable, manager))));
        Map<String, Set<String>> casksByMachineId =
                deviceSoftwareReadModelQuery.caskTokensByMachineId(tenantId, reachable);
        for (SoftwareResponse row : adoptable) {
            Long titleId = Long.valueOf(row.getId());
            List<String> titleMachineIds = machinesByTitleId.getOrDefault(titleId, List.of());
            SoftwareBundlePackage adoptionPackage = row.getAdoptionPackage();
            Set<String> withManager = adoptableByManager.get(adoptionPackage.getPackageManager());
            String cask = caskTokenOf(adoptionPackage);
            long count = titleMachineIds.stream()
                    .filter(withManager::contains)
                    .filter(machineId -> !hasCask(casksByMachineId, machineId, cask))
                    .count();
            row.setAdoptionCount(Math.toIntExact(count));
        }
    }

    private static boolean hasCask(Map<String, Set<String>> casksByMachineId, String machineId, String cask) {
        Set<String> casks = casksByMachineId.getOrDefault(machineId, Set.of());
        return cask != null && casks.contains(cask);
    }

    private PageResult<SoftwareResponse> withStatuses(PageResult<SoftwareResponse> page) {
        applyStatuses(page.items());
        return page;
    }

    // the policies first: a row they cover keeps its ON / OFF, the catalog fills the rest
    private void applyStatuses(List<SoftwareResponse> rows) {
        autoUpdateService.applyToSoftware(rows);
        catalogStatus.apply(rows);
    }

    private PageResult<SoftwareResponse> softwarePageFromFleet(String search, int page, Integer perPage,
                                                               SortInput sort, Boolean vulnerable) {
        // Fleet cannot order titles by CVE count or severity: those sorts get its default, most devices first
        String orderKey = sort == null || sort.getField() == null ? null : FLEET_ORDER_KEY.get(sort.getField());
        SoftwareTitleRequest request = SoftwareTitleRequest.builder()
                .page(page).perPage(perPage).query(search)
                .vulnerable(vulnerable)
                .orderKey(orderKey).orderDirection(orderKey == null ? null : fleetDirection(sort))
                .build();
        SoftwareTitlesResponse response = fleet().listSoftwareTitles(request);
        List<SoftwareResponse> rows = mapTitles(titlesOf(response));
        boolean hasNext = response.getMeta() != null && Boolean.TRUE.equals(response.getMeta().getHasNextResults());
        int total = Objects.requireNonNullElse(response.getCount(), rows.size());
        return new PageResult<>(rows, hasNext, page > 0, total, page);
    }

    private static String fleetDirection(SortInput sort) {
        return sort.getDirection() == SortDirection.DESC ? "desc" : "asc";
    }

    private void enrichDevicesCountFromHosts(List<SoftwareResponse> rows, Map<Long, String> titleIdByVersionId) {
        FleetMdmClient client = fleet();
        deviceCountEnricher.enrichFromHostSoftware(rows, client::searchHosts,
                software -> titleIdOf(software, titleIdByVersionId),
                SoftwareResponse::getId, SoftwareResponse::setDevicesCount);
    }

    private static Stream<String> titleIdOf(FleetSoftware software, Map<Long, String> titleIdByVersionId) {
        Long versionId = software.getId();
        String titleId = titleIdByVersionId.get(versionId);
        return Stream.ofNullable(titleId);
    }

    private static int deviceCount(SoftwareResponse row) {
        return row.getDevicesCount() == null ? 0 : row.getDevicesCount();
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
                    return fleet().searchHosts(request);
                })
                .orElseGet(List::of);
    }


    private List<SoftwareTitle> fetchAllTitles(String search, Boolean vulnerable) {
        List<SoftwareTitle> all = new ArrayList<>();
        int page = 0;
        while (all.size() < TITLES_FETCH_CAP) {
            SoftwareTitleRequest request = SoftwareTitleRequest.builder()
                    .page(page).perPage(TITLES_FETCH_PAGE).query(search)
                    .vulnerable(vulnerable)
                    .build();
            SoftwareTitlesResponse response = fleet().listSoftwareTitles(request);
            List<SoftwareTitle> batch = titlesOf(response);
            all.addAll(batch);
            boolean hasNext = response.getMeta() != null
                    && Boolean.TRUE.equals(response.getMeta().getHasNextResults());
            if (!hasNext || batch.isEmpty()) {
                break;
            }
            page++;
        }
        return all;
    }

    private static List<SoftwareResponse> mapTitles(List<SoftwareTitle> titles) {
        return titles.stream()
                .map(FleetSoftwareMapper::toResponse)
                .filter(Objects::nonNull)
                .toList();
    }

    private static List<SoftwareTitle> titlesOf(SoftwareTitlesResponse response) {
        List<SoftwareTitle> titles = response.getSoftwareTitles();
        return isEmpty(titles) ? List.of() : titles;
    }

    private static Map<Long, String> titleIdByVersionId(List<SoftwareTitle> titles) {
        return titles.stream()
                .filter(SoftwareInventoryService::hasIdAndVersions)
                .flatMap(SoftwareInventoryService::versionIdToTitleId)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue, (first, second) -> first));
    }

    private static boolean hasIdAndVersions(SoftwareTitle title) {
        return title.getId() != null && !isEmpty(title.getVersions());
    }

    private static Stream<Map.Entry<Long, String>> versionIdToTitleId(SoftwareTitle title) {
        String titleId = title.getId().toString();
        return title.getVersions().stream()
                .map(SoftwareTitleVersion::getId)
                .filter(Objects::nonNull)
                .map(versionId -> Map.entry(versionId, titleId));
    }

    private static Comparator<SoftwareResponse> comparatorFor(String field, boolean desc) {
        Comparator<SoftwareResponse> base = switch (field) {
            case "name" -> Comparator.comparing(row -> row.getName() == null ? "" : row.getName(),
                    String.CASE_INSENSITIVE_ORDER);
            case "devicesCount" -> Comparator.comparingInt(SoftwareInventoryService::deviceCount);
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
        return s == null ? 0 : severityRank(s);
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

    public PageResult<SoftwareVulnerabilityResponse> listVulnerabilitiesForSoftware(
            String softwareId, SoftwareVulnerabilityFilterInput filter, String search, int page, Integer perPage,
            String sortField, boolean sortAsc) {
        if (softwareReadModel) {
            return tenantSoftwareReadModelQuery.listVulnerabilitiesForSoftware(
                    tenantIdProvider.getTenantId(), softwareId, search, page, perPage, sortField, sortAsc);
        }
        Comparator<SoftwareVulnerabilityResponse> order =
                SoftwareVulnerabilityOrder.of(sortField, DEFAULT_VULNERABILITY_SORT_FIELD, sortAsc);
        Optional<Long> parsed = parseNumericId(softwareId);
        if (parsed.isEmpty()) {
            return PageResult.empty(page);
        }
        SoftwareTitle title = fleet().getSoftwareTitle(parsed.get());
        if (title == null || title.getVersions() == null || title.getVersions().isEmpty()) {
            return PageResult.empty(page);
        }
        List<VersionCve> pairs = collectVersionCves(title.getVersions());
        if (pairs.isEmpty()) {
            return PageResult.empty(page);
        }
        Map<String, List<String>> versionsByCve = pairs.stream()
                .collect(Collectors.groupingBy(VersionCve::cve, java.util.LinkedHashMap::new,
                        Collectors.mapping(VersionCve::version, Collectors.toList())));
        Function<Map.Entry<String, List<String>>, SoftwareVulnerabilityResponse> toRow;
        if (fleetPaging) {
            Map<String, FleetVulnerability> details = cveDetails(title.getVersions());
            toRow = e -> FleetVulnerabilityMapper.toResponse(e.getKey(), details.get(e.getKey()), joinVersions(e.getValue()));
        } else {
            Map<String, Vulnerability> enrichment = enrichCves(uniqueCves(pairs));
            toRow = e -> FleetVulnerabilityMapper.toResponse(e.getKey(), enrichment.get(e.getKey()), joinVersions(e.getValue()));
        }
        List<SoftwareVulnerabilityResponse> all = versionsByCve.entrySet().stream()
                .map(toRow)
                .filter(Objects::nonNull)
                .filter(v -> matchesSearch(v, search))
                .filter(v -> filter == null || selected(filter.getSeverities(), v.getSeverity()))
                .sorted(order)
                .toList();
        return paginate(all, page, perPage);
    }

    public PageResult<SoftwareOnDeviceResponse> listDevicesForSoftware(String softwareId,
                                                                       SoftwareOnDeviceFilterInput filter,
                                                                       String search, int page, Integer perPage,
                                                                       SortInput sort) {
        Comparator<SoftwareOnDeviceResponse> order = deviceOrder(sort);
        List<SoftwareOnDeviceResponse> chosen = chosenDevices(softwareId, filter, search);
        List<SoftwareOnDeviceResponse> all = chosen.stream()
                .sorted(order)
                .toList();
        PageResult<SoftwareOnDeviceResponse> result = paginateList(all, page, perPage);
        applyAdoptions(softwareId, result.items());
        return result;
    }

    private void applyAdoptions(String softwareId, List<SoftwareOnDeviceResponse> rows) {
        List<String> machineIds = rows.stream().map(row -> row.getDevice().getMachineId()).toList();
        Map<String, SoftwareAdoptionResponse> adoptions = softwareAdoptionService.getAdoptionsByMachineId(softwareId, machineIds);
        rows.forEach(row -> applyAdoption(row, adoptions));
    }

    private static void applyAdoption(SoftwareOnDeviceResponse row, Map<String, SoftwareAdoptionResponse> adoptions) {
        String machineId = row.getDevice().getMachineId();
        SoftwareAdoptionResponse adoption = adoptions.get(machineId);
        row.setAdoption(adoption);
    }

    private List<SoftwareOnDeviceResponse> chosenDevices(String softwareId, SoftwareOnDeviceFilterInput filter,
                                                         String search) {
        List<SoftwareOnDeviceResponse> rows = devicesWithAutoUpdate(softwareId, search);
        Set<String> tagged = taggedMachines(rows, filter);
        return rows.stream()
                .filter(row -> matchesDeviceFilter(row, filter, tagged))
                .toList();
    }

    // the filters read auto-update, so it is set on every row, not only on the page
    private List<SoftwareOnDeviceResponse> devicesWithAutoUpdate(String softwareId, String search) {
        List<SoftwareOnDeviceResponse> rows = softwareReadModel
                ? readModelDevicesForSoftware(softwareId, search)
                : allDevicesForSoftware(softwareId, search);
        autoUpdateService.applyToDevices(softwareId, rows);
        rows.stream()
                .filter(SoftwareInventoryService::isManagedWithoutPolicy)
                .forEach(row -> row.setAutoUpdate(SoftwareAutoUpdateStatus.OFF));
        return rows;
    }

    public boolean isSoftwareReadModelEnabled() {
        return softwareReadModel;
    }

    // reads the read model whatever the flag: check isSoftwareReadModelEnabled() first, an unfilled one lists no device
    public List<String> listMachineIdsForSoftware(String softwareId) {
        String tenantId = tenantIdProvider.getTenantId();
        return tenantSoftwareReadModelQuery.machineIdsForSoftware(tenantId, softwareId);
    }

    private static boolean isManagedWithoutPolicy(SoftwareOnDeviceResponse row) {
        SoftwareSource installedBy = row.getInstalledBy();
        return row.getAutoUpdate() == null && installedBy != null && installedBy != SoftwareSource.UNMANAGED;
    }

    private List<SoftwareOnDeviceResponse> readModelDevicesForSoftware(String softwareId, String search) {
        String tenantId = tenantIdProvider.getTenantId();
        if (!tenantSoftwareReadModelQuery.exists(tenantId, softwareId)) {
            return List.of();
        }
        // the catalog's newest release when it carries the title, otherwise the highest version installed
        SoftwareResponse titleRow = tenantSoftwareReadModelQuery.get(tenantId, softwareId);
        List<SoftwareResponse> titleRows = List.of(titleRow);
        catalogStatus.apply(titleRows);
        String latestVersion = titleRow.getLatestVersion();
        SoftwareSource source = titleRow.getSource();
        SoftwareSource installedBy = source == SoftwareSource.UNMANAGED ? null : source;
        List<SoftwareOnDeviceResponse> rows = tenantSoftwareReadModelQuery
                .devicesForSoftwareRows(tenantId, softwareId, search, latestVersion);
        rows.forEach(row -> row.setInstalledBy(managedByOn(row.getDevice(), installedBy)));
        markInstalledCasks(titleRow, rows);
        markScheduledUpdates(softwareId, titleRow, rows);
        return rows;
    }

    private void markInstalledCasks(SoftwareResponse title, List<SoftwareOnDeviceResponse> rows) {
        String tenantId = tenantIdProvider.getTenantId();
        List<String> machineIds = rows.stream().map(row -> row.getDevice().getMachineId()).toList();
        SoftwareBundlePackage adoptionPackage = title.getAdoptionPackage();
        Set<String> withCask = machinesWithCask(tenantId, machineIds, adoptionPackage);
        rows.stream()
                .filter(row -> isOn(row, withCask))
                .forEach(row -> row.setInstalledBy(SoftwareSource.BREW));
    }

    // scheduled = an active update schedule with a run still ahead on the device
    private void markScheduledUpdates(String softwareId, SoftwareResponse title, List<SoftwareOnDeviceResponse> rows) {
        String tenantId = tenantIdProvider.getTenantId();
        Instant now = Instant.now();
        PackageCatalogEntry managingPackage = title.getManagingPackage();
        List<String> atServerTime = softwareScheduleRepository
                .findByTenantIdAndStatusAndNextRunAtGreaterThanOrderByNextRunAtAsc(tenantId, ScriptStatus.ACTIVE, now)
                .stream()
                .filter(schedule -> updates(schedule, softwareId, managingPackage))
                .map(softwareScheduleTargetResolver::resolveMachineIds)
                .flatMap(List::stream)
                .toList();
        List<SoftwareSchedule> atDeviceTimeSchedules = softwareScheduleRepository
                .findByTenantIdAndStatusAndTriggerAndTimeReference(tenantId, ScriptStatus.ACTIVE,
                        ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL)
                .stream()
                .filter(schedule -> updates(schedule, softwareId, managingPackage))
                .toList();
        List<String> atDeviceTime = softwareScheduleTargetResolver
                .resolveMachineIdsAwaitingDeviceTime(atDeviceTimeSchedules).values().stream()
                .flatMap(List::stream)
                .toList();
        Set<String> scheduled = new HashSet<>(atServerTime);
        scheduled.addAll(atDeviceTime);
        rows.stream()
                .filter(row -> isOn(row, scheduled))
                .forEach(row -> row.setStatus(SoftwareOnDeviceStatus.SCHEDULED_UPDATE));
    }

    private static boolean updates(SoftwareSchedule schedule, String softwareId, PackageCatalogEntry managingPackage) {
        List<SoftwareSchedulePackage> packages = schedule.getPackages();
        return schedule.getAction() == SoftwareAction.UPDATE && !isEmpty(packages)
                && packages.stream().anyMatch(scheduled -> isOf(scheduled, softwareId, managingPackage));
    }

    // a schedule made from the package search carries no softwareId: it names the package that manages the title
    private static boolean isOf(SoftwareSchedulePackage scheduled, String softwareId,
                                PackageCatalogEntry managingPackage) {
        return softwareId.equals(scheduled.getSoftwareId())
                || (managingPackage != null && managingPackage.getManager() == scheduled.getPackageManager()
                && managingPackage.getPackageId().equals(scheduled.getPackageName()));
    }

    private static boolean isOn(SoftwareOnDeviceResponse row, Set<String> machineIds) {
        String machineId = row.getDevice().getMachineId();
        return machineIds.contains(machineId);
    }

    private static Comparator<SoftwareOnDeviceResponse> deviceOrder(SortInput sort) {
        if (!hasSortField(sort)) {
            return (a, b) -> 0;
        }
        if (!DEVICE_SORT_FIELD.equals(sort.getField())) {
            throw new BadRequestException("Unknown sort field '" + sort.getField() + "'. Sortable fields: " + DEVICE_SORT_FIELD);
        }
        Comparator<String> versions = isDescending(sort)
                ? Comparator.comparing(Function.identity(), SoftwareVersions::compare).reversed()
                : SoftwareVersions::compare;
        return Comparator.comparing(SoftwareOnDeviceResponse::getSoftwareVersion, Comparator.nullsLast(versions));
    }

    // null = no tag filter; a device matches when it carries any of the tags
    private Set<String> taggedMachines(List<SoftwareOnDeviceResponse> rows, SoftwareOnDeviceFilterInput filter) {
        if (filter == null || isEmpty(filter.getDeviceTagIds())) {
            return null;
        }
        List<String> machineIds = rows.stream().map(row -> row.getDevice().getMachineId()).toList();
        if (machineIds.isEmpty()) {
            return Set.of();
        }
        return tagAssignmentRepository.findByEntityIdInAndTagIdInAndEntityType(
                        machineIds, filter.getDeviceTagIds(), TagEntityType.DEVICE).stream()
                .map(TagAssignment::getEntityId)
                .collect(Collectors.toSet());
    }

    private static boolean matchesDeviceFilter(SoftwareOnDeviceResponse row, SoftwareOnDeviceFilterInput filter,
                                               Set<String> tagged) {
        if (filter == null) {
            return true;
        }
        Machine device = row.getDevice();
        return selected(filter.getStatuses(), row.getStatus())
                && selected(filter.getOrganizationIds(), device.getOrganizationId())
                && selected(filter.getDeviceStatuses(), device.getStatus())
                && selected(filter.getInstalledBy(), row.getInstalledBy())
                && selected(filter.getAutoUpdateStatuses(), row.getAutoUpdate())
                && manageable(filter.getManageable(), row.getInstalledBy())
                && (tagged == null || tagged.contains(device.getMachineId()));
    }

    // nothing chosen in a dropdown matches every row; a row without a value matches no choice
    private static <T> boolean selected(List<T> chosen, T value) {
        return isEmpty(chosen) || (value != null && chosen.contains(value));
    }

    // a package manager manages the row when its source names one; UNMANAGED or unknown is not manageable
    private static boolean manageable(Boolean wanted, SoftwareSource source) {
        return wanted == null || wanted == (source != null && source != SoftwareSource.UNMANAGED);
    }

    public PageResult<SoftwareResponse> listSoftwareForDevice(String machineId, SoftwareFilterInput filter,
                                                              String search, int page, Integer perPage,
                                                              SortInput sort) {
        Comparator<SoftwareResponse> order = deviceSoftwareOrder(sort);
        List<SoftwareResponse> rows = deviceSoftware(machineId, filter, search);
        // the filter reads source and auto-update, so they are set on every row, not only on the page
        autoUpdateService.applyToSoftwareOnDevice(machineId, rows);
        Set<String> installedCasks = installedCasksOn(machineId, rows);
        catalogStatus.applyOnDevice(machineId, rows, installedCasks);
        List<SoftwareResponse> chosen = rows.stream()
                .filter(row -> matchesCatalogFilter(row, filter))
                .toList();
        if (!softwareReadModel && !fleetPaging) {
            enrichDevicesCountFromHosts(chosen);
        }
        return paginateList(chosen.stream().sorted(order).toList(), page, perPage);
    }

    private List<SoftwareResponse> deviceSoftware(String machineId, SoftwareFilterInput filter, String search) {
        if (softwareReadModel) {
            String tenantId = tenantIdProvider.getTenantId();
            return deviceSoftwareReadModelQuery.rowsForDevice(tenantId, machineId, search).stream()
                    .filter(row -> matchesDeviceSoftwareFilter(row, filter))
                    .toList();
        }
        HostInventory inventory = deviceHostInventoryLoader.load(fleet(), machineId);
        return deviceSoftwareRows(inventory, filter, search);
    }

    public SoftwareFilters getDeviceSoftwareFilters(String machineId, String search) {
        List<SoftwareResponse> rows = deviceSoftware(machineId, null, search);
        autoUpdateService.applyToSoftwareOnDevice(machineId, rows);
        Set<String> installedCasks = installedCasksOn(machineId, rows);
        catalogStatus.applyOnDevice(machineId, rows, installedCasks);
        return softwareFilters(rows);
    }

    // a search can leave the cask's own row out of the rows: the read model is asked for every cask on the device
    private Set<String> installedCasksOn(String machineId, List<SoftwareResponse> rows) {
        if (!softwareReadModel) {
            return rows.stream()
                    .filter(row -> row.getFleetSource() == FleetSource.HOMEBREW_CASKS && row.getName() != null)
                    .map(row -> row.getName().toLowerCase(Locale.ROOT))
                    .collect(Collectors.toSet());
        }
        String tenantId = tenantIdProvider.getTenantId();
        List<String> machineIds = List.of(machineId);
        Map<String, Set<String>> casks = deviceSoftwareReadModelQuery.caskTokensByMachineId(tenantId, machineIds);
        return casks.getOrDefault(machineId, Set.of());
    }

    private static List<SoftwareResponse> deviceSoftwareRows(HostInventory inventory, SoftwareFilterInput filter,
                                                             String search) {
        return inventory.getTitles().stream()
                .map(title -> toDeviceSoftwareRow(title, inventory))
                .filter(row -> matchesDeviceSoftwareFilter(row, filter))
                .filter(row -> matchesDeviceSoftwareSearch(row, search))
                .toList();
    }

    private void enrichDevicesCountFromHosts(List<SoftwareResponse> rows) {
        if (isEmpty(rows)) {
            return;
        }
        List<SoftwareTitle> catalog = fetchAllTitles(null, null);
        Map<Long, String> titleIdByVersionId = titleIdByVersionId(catalog);
        enrichDevicesCountFromHosts(rows, titleIdByVersionId);
    }

    private static Comparator<SoftwareResponse> deviceSoftwareOrder(SortInput sort) {
        String field = hasSortField(sort) ? sort.getField() : DEFAULT_SORT_FIELD;
        return comparatorFor(field, isDescending(sort));
    }

    private static boolean hasSortField(SortInput sort) {
        return sort != null && hasText(sort.getField());
    }

    private static boolean isDescending(SortInput sort) {
        return sort != null && sort.getDirection() == SortDirection.DESC;
    }

    private static SoftwareResponse toDeviceSoftwareRow(HostSoftwareTitle title, HostInventory inventory) {
        String id = Objects.toString(title.getId(), null);
        SoftwareSource source = FleetSoftwareCategory.of(title.getSource()).source();
        List<HostSoftwareInstalledVersion> installed = HostInventory.installedVersionsOf(title);
        return SoftwareResponse.builder()
                .id(id)
                .name(title.getName())
                .source(source)
                .type(FleetSoftwareType.of(title.getSource()))
                .currentVersion(installedVersion(installed))
                .olderVersionsCount(Math.max(0, installed.size() - 1))
                .vulnerabilitySummary(summarizeDeviceSoftware(title, inventory))
                .fleetSource(FleetSource.of(title.getSource()))
                .publisher(FleetSoftwareMapper.firstText(installed, HostSoftwareInstalledVersion::getVendor))
                .upgradeCode(title.getUpgradeCode())
                .bundleIdentifier(title.getBundleIdentifier())
                .productCodes(FleetSoftwareMapper.distinctText(installed, HostSoftwareInstalledVersion::getArpKey))
                .packageFamilyNames(FleetSoftwareMapper.distinctText(installed, HostSoftwareInstalledVersion::getPackageFamilyName))
                .systemComponent(FleetSoftwareMapper.allFlagged(installed, HostSoftwareInstalledVersion::getSystemComponent))
                .build();
    }

    private static String installedVersion(List<HostSoftwareInstalledVersion> installed) {
        return installed.stream()
                .map(HostSoftwareInstalledVersion::getVersion)
                .findFirst()
                .orElse(null);
    }

    private static SoftwareVulnerabilitySummaryResponse summarizeDeviceSoftware(HostSoftwareTitle title,
                                                                            HostInventory inventory) {
        List<CveHit> hits = HostInventory.hitsOf(title).toList();
        if (hits.isEmpty()) {
            return null;
        }
        long distinctCves = hits.stream().map(CveHit::getCve).distinct().count();
        SoftwareCveSeverity highest = hits.stream()
                .map(inventory::detail)
                .flatMap(Optional::stream)
                .map(FleetVulnerability::getCvssScore)
                .map(FleetGlobalVulnerabilityMapper::bucketSeverity)
                .filter(Objects::nonNull)
                .max(Comparator.comparingInt(SoftwareInventoryService::severityRank))
                .orElse(null);
        return SoftwareVulnerabilitySummaryResponse.builder()
                .cveCount((int) distinctCves)
                .highestSeverity(highest)
                .build();
    }

    private static boolean matchesDeviceSoftwareFilter(SoftwareResponse row, SoftwareFilterInput filter) {
        return filter == null || meetsMinSeverity(row, filter.getMinSeverity());
    }

    private static boolean matchesCatalogFilter(SoftwareResponse row, SoftwareFilterInput filter) {
        return filter == null
                || (selected(filter.getSources(), row.getSource())
                && selected(filter.getAutoUpdateStatuses(), row.getAutoUpdate())
                && selected(filter.getOsTypes(), osOf(row))
                && selected(filter.getVersionStatuses(), row.getVersionStatus())
                && manageable(filter.getManageable(), row.getSource()));
    }

    private static OsType osOf(SoftwareResponse row) {
        FleetSource fleetSource = row.getFleetSource();
        return FleetSoftwareOs.of(fleetSource);
    }

    private static boolean meetsMinSeverity(SoftwareResponse row, SoftwareCveSeverity min) {
        if (isNoCutoff(min)) {
            return true;
        }
        return severityRank(row) >= severityRank(min);
    }

    private static boolean isNoCutoff(SoftwareCveSeverity min) {
        return min == null || min == SoftwareCveSeverity.NONE;
    }

    private static boolean matchesDeviceSoftwareSearch(SoftwareResponse row, String search) {
        return !hasText(search)
                || containsIgnoreCase(row.getName(), search)
                || containsIgnoreCase(row.getPublisher(), search);
    }

    public SoftwareOnDeviceFilters getSoftwareDeviceFilters(String softwareId, SoftwareOnDeviceFilterInput filter,
                                                            String search) {
        List<SoftwareOnDeviceResponse> rows = chosenDevices(softwareId, filter, search);
        return SoftwareOnDeviceFilters.builder()
                .statuses(facet(rows, SoftwareOnDeviceResponse::getStatus))
                .installedBy(facet(rows, SoftwareOnDeviceResponse::getInstalledBy))
                .autoUpdateStatuses(facet(rows, SoftwareOnDeviceResponse::getAutoUpdate))
                .deviceStatuses(facet(rows, row -> row.getDevice().getStatus()))
                .organizations(organizationFacet(rows))
                .build();
    }

    private List<SoftwareFilterOption> organizationFacet(List<SoftwareOnDeviceResponse> rows) {
        Stream<String> organizationIds = rows.stream().map(row -> row.getDevice().getOrganizationId());
        return SoftwareFilterOptions.organizations(organizationIds, organizationRepository);
    }

    private List<SoftwareOnDeviceResponse> allDevicesForSoftware(String softwareId, String search) {
        Optional<Long> titleId = parseNumericId(softwareId);
        if (titleId.isEmpty()) {
            return List.of();
        }
        SoftwareTitle title = fleet().getSoftwareTitle(titleId.get());
        if (title == null || title.getVersions() == null || title.getVersions().isEmpty()) {
            return List.of();
        }
        // the catalog's newest release when it carries the title, otherwise the highest version installed
        SoftwareResponse titleRow = FleetSoftwareMapper.toResponse(title);
        List<SoftwareResponse> titleRows = List.of(titleRow);
        catalogStatus.apply(titleRows);
        String latestVersion = titleRow.getLatestVersion();
        SoftwareSource installedBy = managedBy(titleRow, title.getSource());

        List<SoftwareTitleVersion> versions = title.getVersions().stream()
                .filter(version -> version.getId() != null)
                .toList();
        List<HostVersion> hostVersions = (fleetPaging
                ? FleetCalls.inParallel(versions, this::hostVersionsOf)
                : versions.stream().map(this::hostVersionsOf).toList())
                .stream()
                .flatMap(List::stream)
                .toList();

        Map<Long, Machine> machinesByHostId = hostMachineResolver.resolve(
                tenantIdProvider.getTenantId(), hostVersions.stream().map(HostVersion::host).toList());

        // one machine can carry several versions (e.g. a pip per Python install) and several Fleet hosts
        Map<String, List<SoftwareOnDeviceResponse>> rowsByMachine = hostVersions.stream()
                .map(hv -> toDeviceResponse(hv, machinesByHostId, latestVersion, installedBy))
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(row -> row.getDevice().getMachineId(),
                        java.util.LinkedHashMap::new, Collectors.toList()));
        List<SoftwareOnDeviceResponse> rows = rowsByMachine.values().stream()
                .map(SoftwareInventoryService::mergeDeviceRows)
                .filter(row -> matchesDeviceSearch(row, search))
                .toList();
        markScheduledUpdates(softwareId, titleRow, rows);
        return rows;
    }

    private static SoftwareOnDeviceResponse mergeDeviceRows(List<SoftwareOnDeviceResponse> rows) {
        boolean upToDate = rows.stream().allMatch(row -> row.getStatus() == SoftwareOnDeviceStatus.UP_TO_DATE);
        return SoftwareOnDeviceResponse.builder()
                .device(rows.get(0).getDevice())
                .softwareVersion(joinVersions(rows.stream().map(SoftwareOnDeviceResponse::getSoftwareVersion).toList()))
                .status(upToDate ? SoftwareOnDeviceStatus.UP_TO_DATE : SoftwareOnDeviceStatus.OUTDATED)
                .installedBy(rows.get(0).getInstalledBy())
                .build();
    }

    // Fleet names only the package managers it lists itself; an app it calls "apps" or "programs" may still have come
    // from winget or a cask, so it is unknown here, not "Manually"
    private static SoftwareSource installedBy(String fleetSource) {
        SoftwareSource source = FleetSoftwareCategory.of(fleetSource).source();
        return source == SoftwareSource.UNMANAGED ? null : source;
    }

    // a program winget matches is managed by winget whoever installed it; brew and choco manage what they installed
    private static SoftwareSource managedBy(SoftwareResponse titleRow, String fleetSource) {
        return titleRow.getSource() == SoftwareSource.WINGET ? SoftwareSource.WINGET : installedBy(fleetSource);
    }

    private static SoftwareSource managedByOn(Machine device, SoftwareSource managedBy) {
        if (managedBy != SoftwareSource.WINGET) {
            return managedBy;
        }
        return PackageManagerAvailability.isPresentOn(device, PackageManagerType.WINGET) ? managedBy : null;
    }

    private List<HostVersion> hostVersionsOf(SoftwareTitleVersion version) {
        HostSearchRequest request = new HostSearchRequest();
        request.setSoftwareVersionId(version.getId());
        request.setPerPage(DEVICES_PER_VERSION_LIMIT);
        return fleet().searchHosts(request).stream()
                .map(host -> new HostVersion(host, version.getVersion()))
                .toList();
    }

    private static SoftwareOnDeviceResponse toDeviceResponse(HostVersion hv, Map<Long, Machine> machinesByHostId,
                                                             String latestVersion, SoftwareSource installedBy) {
        Machine device = hv.host().getId() == null ? null : machinesByHostId.get(hv.host().getId());
        if (device == null) {
            return null;
        }
        // at or past the latest: the catalog can lag behind a release a device already runs
        SoftwareOnDeviceStatus status = latestVersion != null && hv.version() != null
                && SoftwareVersions.compare(hv.version(), latestVersion) >= 0
                ? SoftwareOnDeviceStatus.UP_TO_DATE : SoftwareOnDeviceStatus.OUTDATED;
        return SoftwareOnDeviceResponse.builder()
                .device(device)
                .softwareVersion(hv.version())
                .status(status)
                .installedBy(managedByOn(device, installedBy))
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

    public SoftwareFilters getSoftwareFilters(SoftwareFilterInput filter, String search) {
        Boolean vulnerable = vulnerableOnly(filter);
        if (softwareReadModel) {
            List<SoftwareResponse> titles = readModelTitles(search, vulnerable, filter);
            return softwareFilters(titles);
        }
        if (fleetPaging) {
            // counting facets would mean downloading the whole Fleet catalog; the UI reads only versionStatuses,
            // which Fleet never fills
            return softwareFilters(List.of());
        }
        // Facet counts don't depend on the enriched devicesCount, so bypass enrichRealDevicesCount
        // here — it would fire N Fleet /hosts lookups just to produce numbers we don't use.
        List<SoftwareTitle> fetched = fetchAllTitles(search, vulnerable);
        List<SoftwareResponse> titles = mapTitles(fetched);
        applyStatuses(titles);
        List<SoftwareResponse> chosen = titles.stream()
                .filter(row -> matchesCatalogFilter(row, filter))
                .toList();
        return softwareFilters(chosen);
    }

    private static SoftwareFilters softwareFilters(List<SoftwareResponse> titles) {
        return SoftwareFilters.builder()
                .sources(facet(titles, SoftwareResponse::getSource))
                .versionStatuses(facet(titles, SoftwareResponse::getVersionStatus))
                .severities(facet(titles, row -> row.getVulnerabilitySummary() == null
                        ? null : row.getVulnerabilitySummary().getHighestSeverity()))
                .autoUpdateStatuses(facet(titles, SoftwareResponse::getAutoUpdate))
                .osTypes(facet(titles, SoftwareInventoryService::osOf))
                .build();
    }

    private static <T, E extends Enum<E>> List<SoftwareFilterOption> facet(List<T> rows, Function<T, E> dimension) {
        return SoftwareFilterOptions.enumFacet(rows, dimension);
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
                .sorted(SoftwareVersions::compare)
                .collect(Collectors.joining(", "));
    }

    private Map<String, Vulnerability> enrichCves(Set<String> cves) {
        // ConcurrentHashMap rejects null values, and Fleet returns null for a CVE it has no record of
        // (404) — collect only the resolved ones; callers null-coalesce a missing key.
        Map<String, Vulnerability> enrichment = new java.util.concurrent.ConcurrentHashMap<>();
        cves.parallelStream().forEach(cve -> {
            Vulnerability detail = fleet().getVulnerability(cve);
            if (detail != null) {
                enrichment.put(cve, detail);
            }
        });
        return enrichment;
    }

    private Map<String, FleetVulnerability> cveDetails(List<SoftwareTitleVersion> versions) {
        List<Long> versionIds = versions.stream()
                .map(SoftwareTitleVersion::getId)
                .filter(Objects::nonNull)
                .toList();
        return FleetCalls.inParallel(versionIds, fleet()::getSoftwareVersion).stream()
                .filter(Objects::nonNull)
                .flatMap(version -> isEmpty(version.getVulnerabilities())
                        ? Stream.empty() : version.getVulnerabilities().stream())
                .filter(cve -> hasText(cve.getCve()))
                .collect(Collectors.toMap(FleetVulnerability::getCve, Function.identity(),
                        BinaryOperator.minBy(EARLIEST_DISCOVERED)));
    }

    private static boolean matchesSearch(SoftwareVulnerabilityResponse row, String search) {
        if (!hasText(search)) {
            return true;
        }
        String needle = search.toLowerCase(Locale.ROOT);
        return row.getCveId() != null && row.getCveId().toLowerCase(Locale.ROOT).contains(needle);
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
