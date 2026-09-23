package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareCveSeverity;
import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.dto.shared.PageResult;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.service.rmm.fleet.DeviceHostInventoryLoader;
import com.openframe.api.service.rmm.fleet.FleetDeviceCountEnricher;
import com.openframe.api.service.rmm.fleet.FleetMdmClientProvider;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.api.service.rmm.fleet.HostInventory;
import com.openframe.api.service.rmm.fleet.HostInventory.CveHit;
import com.openframe.api.service.rmm.vulnerability.FleetGlobalVulnerabilityMapper;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSearchRequest;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.containsIgnoreCase;
import static org.springframework.util.CollectionUtils.isEmpty;
import static org.springframework.util.StringUtils.hasText;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DeviceSoftwareService {

    private static final String DEFAULT_SORT_FIELD = "name";
    private static final int HOSTS_PER_TITLE_LIMIT = 500;

    private final DeviceHostInventoryLoader inventoryLoader;
    private final FleetMdmClientProvider fleetClientProvider;
    private final FleetDeviceCountEnricher deviceCountEnricher;

    public PageResult<SoftwareResponse> list(String machineId, SoftwareFilterInput filter, String search,
                                             int page, Integer perPage, SortInput sort) {
        Comparator<SoftwareResponse> order = order(sort);
        HostInventory inventory = inventoryLoader.load(machineId);
        List<SoftwareResponse> rows = inventory.getTitles().stream()
                .map(title -> toRow(title, inventory))
                .filter(row -> matchesFilter(row, filter))
                .filter(row -> matchesSearch(row, search))
                .sorted(order)
                .toList();
        PageResult<SoftwareResponse> result = PageResult.slice(rows, page, perPage);
        deviceCountEnricher.enrich(result.items(), row -> hostsForTitle(row.getId()), SoftwareResponse::setDevicesCount);
        return result;
    }

    private static Comparator<SoftwareResponse> order(SortInput sort) {
        String field = hasSortField(sort) ? sort.getField() : DEFAULT_SORT_FIELD;
        return SoftwareInventoryService.comparatorFor(field, isDescending(sort));
    }

    private static boolean hasSortField(SortInput sort) {
        return sort != null && hasText(sort.getField());
    }

    private static boolean isDescending(SortInput sort) {
        return sort != null && sort.getDirection() == SortDirection.DESC;
    }

    private static SoftwareResponse toRow(HostSoftwareTitle title, HostInventory inventory) {
        String id = Objects.toString(title.getId(), null);
        SoftwareSource source = FleetSoftwareCategory.of(title.getSource()).source();
        List<HostSoftwareInstalledVersion> installed = HostInventory.installedVersionsOf(title);
        return SoftwareResponse.builder()
                .id(id)
                .name(title.getName())
                .source(source)
                .currentVersion(installedVersion(installed))
                .olderVersionsCount(Math.max(0, installed.size() - 1))
                .vulnerabilitySummary(summarize(title, inventory))
                .build();
    }

    private static String installedVersion(List<HostSoftwareInstalledVersion> installed) {
        return installed.stream()
                .map(HostSoftwareInstalledVersion::getVersion)
                .findFirst()
                .orElse(null);
    }

    private static SoftwareVulnerabilitySummaryResponse summarize(HostSoftwareTitle title, HostInventory inventory) {
        List<CveHit> hits = HostInventory.hitsOf(title).toList();
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
                .max(Comparator.comparingInt(SoftwareInventoryService::severityRank))
                .orElse(null);
        return SoftwareVulnerabilitySummaryResponse.builder()
                .cveCount((int) cveCount)
                .highestSeverity(highest)
                .build();
    }

    private static boolean matchesFilter(SoftwareResponse row, SoftwareFilterInput filter) {
        if (filter == null) {
            return true;
        }
        return matchesSources(row, filter.getSources()) && meetsMinSeverity(row, filter.getMinSeverity());
    }

    private static boolean matchesSources(SoftwareResponse row, List<SoftwareSource> sources) {
        return isEmpty(sources) || sources.contains(row.getSource());
    }

    private static boolean meetsMinSeverity(SoftwareResponse row, SoftwareCveSeverity min) {
        if (isNoCutoff(min)) {
            return true;
        }
        return SoftwareInventoryService.severityRank(row) >= SoftwareInventoryService.severityRank(min);
    }

    private static boolean isNoCutoff(SoftwareCveSeverity min) {
        return min == null || min == SoftwareCveSeverity.NONE;
    }

    private static boolean matchesSearch(SoftwareResponse row, String search) {
        return !hasText(search)
                || containsIgnoreCase(row.getName(), search)
                || containsIgnoreCase(row.getPublisher(), search);
    }

    private List<Host> hostsForTitle(String titleId) {
        HostSearchRequest request = new HostSearchRequest();
        request.setSoftwareTitleId(Long.parseLong(titleId));
        request.setPerPage(HOSTS_PER_TITLE_LIMIT);
        return fleetClientProvider.client().searchHosts(request);
    }
}
