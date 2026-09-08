package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmException;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleRequest;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;
import com.openframe.sdk.fleetmdm.model.SoftwareTitlesResponse;
import com.openframe.sdk.fleetmdm.model.Vulnerability;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.springframework.util.CollectionUtils.isEmpty;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.software-management.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareInventoryService {

    private static final String PORT_SEPARATOR = ":";

    private final IntegratedToolRepository integratedToolRepository;
    private final TenantIdProvider tenantIdProvider;

    public Optional<SoftwareResponse> findById(String softwareId) {
        return parseNumericId(softwareId)
                .map(id -> callFleet(client -> client.getSoftwareTitle(id), "get Fleet software title id=" + id))
                .map(FleetSoftwareMapper::toResponse);
    }

    public PageResult<SoftwareResponse> listSoftware(String search, int page, Integer perPage,
                                                     String orderKey, String orderDirection, Boolean vulnerable) {
        SoftwareTitleRequest request = SoftwareTitleRequest.builder()
                .page(page).perPage(perPage).query(search)
                .orderKey(orderKey).orderDirection(orderDirection)
                .vulnerable(vulnerable)
                .build();
        SoftwareTitlesResponse response = callFleet(
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
        SoftwareTitle title = callFleet(
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
                cve -> Optional.ofNullable(callFleet(
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

    // ────────── Fleet SDK plumbing ──────────

    private <T> T callFleet(FleetSdkCall<T> call, String action) {
        try {
            return call.execute(fleetClient());
        } catch (IOException e) {
            throw new FleetMdmException("Failed to " + action, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FleetMdmException("Interrupted while " + action, e);
        }
    }

    @FunctionalInterface
    private interface FleetSdkCall<T> {
        T execute(FleetMdmClient client) throws IOException, InterruptedException;
    }

    private FleetMdmClient fleetClient() {
        String key = IntegratedToolId.FLEET_SERVER_ID.getValue();
        IntegratedTool tool = integratedToolRepository.findByKey(key)
                .orElseThrow(() -> new IllegalStateException("Fleet MDM tool not configured: " + key));
        return new FleetMdmClient(resolveApiUrl(tool), resolveApiToken(tool), tenantIdProvider.getTenantId());
    }

    private static String resolveApiUrl(IntegratedTool tool) {
        List<ToolUrl> urls = tool.getToolUrls();
        if (isEmpty(urls)) {
            throw new IllegalStateException("Fleet MDM tool has no configured URLs");
        }
        ToolUrl api = urls.stream()
                .filter(u -> u.getType() == ToolUrlType.API)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Fleet MDM tool has no API URL"));
        return hasText(api.getPort()) ? api.getUrl() + PORT_SEPARATOR + api.getPort() : api.getUrl();
    }

    private static String resolveApiToken(IntegratedTool tool) {
        ToolCredentials credentials = tool.getCredentials();
        ToolApiKey apiKey = credentials == null ? null : credentials.getApiKey();
        if (apiKey == null || !hasText(apiKey.getKey())) {
            throw new IllegalStateException("Fleet MDM tool has no API token configured");
        }
        return apiKey.getKey();
    }
}
