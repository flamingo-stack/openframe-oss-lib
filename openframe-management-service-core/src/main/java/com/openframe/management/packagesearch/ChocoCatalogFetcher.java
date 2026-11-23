package com.openframe.management.packagesearch;

import com.openframe.core.jackson.Jackson2Compatibility;
import com.openframe.core.rest.PackageSearchRestClientFactory;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toMap;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChocoCatalogFetcher {

    private static final String CATALOG_PATH = "/catalog.json";
    private static final String SEARCH_PATH = "/search/query";
    private static final Duration TIMEOUT = Duration.ofSeconds(30);
    private static final String CURATED_REASON = "curated";
    private static final String CHOCOLATEY_ID = "chocolatey";
    private static final JsonMapper JSON_MAPPER = Jackson2Compatibility.jsonMapper();
    private static final ChocoFeedSearch.Hit NO_HIT = new ChocoFeedSearch.Hit();
    private static final PackageCatalogEntry NO_MATCHING_KEYS = new PackageCatalogEntry();

    private final PackageManagerProperties packageManagerProperties;
    private final PackageCatalogRepository catalogRepository;

    public List<PackageCatalogEntry> fetchAll() {
        RestClient feed = PackageSearchRestClientFactory.create(feedDirectory(), TIMEOUT);
        ChocoFeedCatalog catalog = fetch(feed, CATALOG_PATH, ChocoFeedCatalog.class);
        ChocoFeedSearch search = fetch(feed, SEARCH_PATH, ChocoFeedSearch.class);
        Map<String, PackageCatalogEntry> wingetEntriesById = wingetEntriesById(catalog);
        List<PackageCatalogEntry> entries = toEntries(catalog, search, wingetEntriesById);
        log.info("Fetched Chocolatey feed catalog: {} entries", entries.size());
        return entries;
    }

    static List<PackageCatalogEntry> toEntries(ChocoFeedCatalog catalog, ChocoFeedSearch search,
                                               Map<String, PackageCatalogEntry> wingetEntriesById) {
        Map<String, ChocoFeedSearch.Hit> hitsById = search.getData().stream()
                .filter(hit -> hit.getId() != null)
                .collect(toMap(hit -> lowerCase(hit.getId()), identity(), (first, second) -> first));
        return catalog.getPackages().stream()
                .filter(ChocoCatalogFetcher::isCuratedApp)
                .map(pkg -> toEntry(pkg, hitsById, wingetEntriesById))
                .toList();
    }

    private String feedDirectory() {
        String feedUrl = packageManagerProperties.getChoco().getFeedUrl();
        int indexFileStart = feedUrl.lastIndexOf('/');
        return feedUrl.substring(0, indexFileStart);
    }

    private Map<String, PackageCatalogEntry> wingetEntriesById(ChocoFeedCatalog catalog) {
        List<String> wingetIds = catalog.getPackages().stream()
                .map(ChocoFeedCatalog.Package::getWingetId)
                .filter(StringUtils::hasText)
                .distinct()
                .toList();
        return catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.WINGET, wingetIds).stream()
                .collect(toMap(PackageCatalogEntry::getPackageId, identity(), (first, second) -> first));
    }

    private static <T> T fetch(RestClient feed, String path, Class<T> type) {
        byte[] body = feed.get().uri(path).retrieve().body(byte[].class);
        if (body == null) {
            throw new IllegalStateException("empty Chocolatey feed response from " + path);
        }
        return JSON_MAPPER.readValue(body, type);
    }

    private static boolean isCuratedApp(ChocoFeedCatalog.Package pkg) {
        return CURATED_REASON.equals(pkg.getReason())
                && hasText(pkg.getId())
                && hasText(pkg.getVersion())
                && !CHOCOLATEY_ID.equalsIgnoreCase(pkg.getId());
    }

    private static PackageCatalogEntry toEntry(ChocoFeedCatalog.Package pkg, Map<String, ChocoFeedSearch.Hit> hitsById,
                                               Map<String, PackageCatalogEntry> wingetEntriesById) {
        String id = pkg.getId();
        String wingetId = pkg.getWingetId();
        ChocoFeedSearch.Hit hit = hitsById.getOrDefault(lowerCase(id), NO_HIT);
        PackageCatalogEntry winget = hasText(wingetId)
                ? wingetEntriesById.getOrDefault(wingetId, NO_MATCHING_KEYS)
                : NO_MATCHING_KEYS;
        String title = hit.getTitle();
        String name = hasText(title) ? title : id;
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.CHOCO)
                .packageId(id)
                .name(name)
                .description(hit.getDescription())
                .homepage(hit.getProjectUrl())
                .version(pkg.getVersion())
                .productCodes(winget.getProductCodes())
                .upgradeCodes(winget.getUpgradeCodes())
                .packageFamilyNames(winget.getPackageFamilyNames())
                .normalizedNames(winget.getNormalizedNames())
                .normalizedPublishers(winget.getNormalizedPublishers())
                .build();
    }

    private static String lowerCase(String id) {
        return id.toLowerCase(Locale.ROOT);
    }
}
