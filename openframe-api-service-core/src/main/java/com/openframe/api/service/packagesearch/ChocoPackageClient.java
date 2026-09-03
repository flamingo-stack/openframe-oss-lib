package com.openframe.api.service.packagesearch;

import com.openframe.core.rest.PackageSearchRestClientFactory;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.api.service.packagesearch.PackageSearchProperties;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.dto.packagesearch.PackageVersion;
import com.openframe.api.exception.PackageNotFoundException;
import com.openframe.api.exception.PackageSourceUnavailableException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriBuilder;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.function.Supplier;

@Service
public class ChocoPackageClient implements PackageManagerClient {

    private static final String UNAVAILABLE_MESSAGE =
            "The Chocolatey repository is temporarily unavailable. Please try again later.";
    private static final String FILTER_LATEST_VERSION = "IsLatestVersion";
    private static final String EMPTY_TARGET_FRAMEWORK = "''";
    private static final String ORDER_BY_DOWNLOADS = "DownloadCount desc";
    private static final String ORDER_BY_PUBLISHED = "Published desc";
    private static final int SEARCH_ITEM_DESCRIPTION_LIMIT = 300;
    private static final int CACHE_MAX_SIZE = 2000;

    private final RestClient restClient;
    private final ChocoFeedParser chocoFeedParser;
    private final Cache<String, PackageDetails> detailsCache;

    public ChocoPackageClient(PackageSearchProperties packageSearchProperties, ChocoFeedParser chocoFeedParser) {
        PackageSearchProperties.Choco choco = packageSearchProperties.getChoco();
        this.restClient = PackageSearchRestClientFactory.create(choco.getBaseUrl(), choco.getTimeout());
        this.chocoFeedParser = chocoFeedParser;
        this.detailsCache = Caffeine.newBuilder()
                .expireAfterWrite(choco.getCacheTtl())
                .maximumSize(CACHE_MAX_SIZE)
                .build();
    }

    @Override
    public PackageManagerType getPackageManagerType() {
        return PackageManagerType.CHOCO;
    }

    @Override
    public PackageSearchResult search(String query, int limit, int offset) {
        String trimmedQuery = query.trim();
        return requestSearchPage(trimmedQuery, limit, offset);
    }

    @Override
    public PackageDetails findPackage(String packageId, BrewPackageType packageType) {
        String cacheKey = packageId.toLowerCase(Locale.ROOT);
        return detailsCache.get(cacheKey, key -> loadDetails(packageId));
    }

    private PackageSearchResult requestSearchPage(String query, int limit, int offset) {
        // one extra row makes hasMore exact without a second $count request;
        // the server caps a page at 40, which is why the router clamps limit to 39
        int probeSize = limit + 1;
        String quotedQuery = quote(query);
        String xml = callCommunityRepo(() -> restClient.get()
                .uri(builder -> searchUri(builder, quotedQuery, probeSize, offset))
                .retrieve()
                .body(String.class));
        List<ChocoEntry> entries = parseFeed(xml);
        List<PackageSearchItem> items = entries.stream()
                .limit(limit)
                .map(this::toItem)
                .toList();
        boolean hasMore = entries.size() > limit;
        return PackageSearchResult.builder()
                .items(items)
                .total(null)
                .hasMore(hasMore)
                .build();
    }

    private URI searchUri(UriBuilder builder, String quotedQuery, int top, int skip) {
        return builder.path("/Search()")
                .queryParam("$filter", FILTER_LATEST_VERSION)
                .queryParam("searchTerm", quotedQuery)
                .queryParam("targetFramework", EMPTY_TARGET_FRAMEWORK)
                .queryParam("includePrerelease", "false")
                .queryParam("$orderby", ORDER_BY_DOWNLOADS)
                .queryParam("$top", top)
                .queryParam("$skip", skip)
                .build();
    }

    private PackageDetails loadDetails(String packageId) {
        ChocoEntry latest = fetchLatestEntry(packageId);
        List<PackageVersion> versions = fetchVersions(latest);
        String id = latest.getId();
        String name = displayName(latest);
        String description = firstNonNull(latest.getDescription(), latest.getSummary());
        String installCommand = installCommand(id);
        return PackageDetails.builder()
                .id(id)
                .packageManager(PackageManagerType.CHOCO)
                .name(name)
                .description(description)
                .homepage(latest.getProjectUrl())
                .iconUrl(latest.getIconUrl())
                .installCommand(installCommand)
                .popularity(latest.getDownloadCount())
                .tags(tags(latest))
                .versions(versions)
                .build();
    }

    private ChocoEntry fetchLatestEntry(String packageId) {
        String lowerId = packageId.toLowerCase(Locale.ROOT);
        String quotedId = quote(lowerId);
        String filter = "tolower(Id) eq " + quotedId + " and " + FILTER_LATEST_VERSION;
        String xml = callCommunityRepo(() -> restClient.get()
                .uri(builder -> latestEntryUri(builder, filter))
                .retrieve()
                .body(String.class));
        List<ChocoEntry> entries = parseFeed(xml);
        if (entries.isEmpty()) {
            throw new PackageNotFoundException(packageId);
        }
        return entries.getFirst();
    }

    private URI latestEntryUri(UriBuilder builder, String filter) {
        return builder.path("/Packages()")
                .queryParam("$filter", filter)
                .queryParam("$top", 1)
                .build();
    }

    // the community feed serves at most one OData page here, so this is the newest 40 versions
    private List<PackageVersion> fetchVersions(ChocoEntry latest) {
        String quotedId = quote(latest.getId());
        String xml = callCommunityRepo(() -> restClient.get()
                .uri(builder -> versionsUri(builder, quotedId))
                .retrieve()
                .body(String.class));
        List<ChocoEntry> entries = parseFeed(xml);
        List<PackageVersion> versions = entries.stream()
                .map(this::toVersion)
                .toList();
        if (versions.isEmpty()) {
            PackageVersion onlyKnown = toVersion(latest);
            return List.of(onlyKnown);
        }
        return versions;
    }

    private URI versionsUri(UriBuilder builder, String quotedId) {
        return builder.path("/FindPackagesById()")
                .queryParam("id", quotedId)
                .queryParam("$orderby", ORDER_BY_PUBLISHED)
                .build();
    }

    private PackageVersion toVersion(ChocoEntry entry) {
        return PackageVersion.builder()
                .version(entry.getVersion())
                .releasedAt(entry.getPublished())
                .prerelease(entry.getPrerelease())
                .build();
    }

    private <T> T callCommunityRepo(Supplier<T> call) {
        try {
            return call.get();
        } catch (RestClientException e) {
            throw new PackageSourceUnavailableException(UNAVAILABLE_MESSAGE, e);
        }
    }

    private List<ChocoEntry> parseFeed(String xml) {
        if (xml == null) {
            throw new PackageSourceUnavailableException(UNAVAILABLE_MESSAGE);
        }
        try {
            return chocoFeedParser.parse(xml);
        } catch (IllegalStateException e) {
            throw new PackageSourceUnavailableException(UNAVAILABLE_MESSAGE, e);
        }
    }

    private PackageSearchItem toItem(ChocoEntry entry) {
        String id = entry.getId();
        String name = displayName(entry);
        String description = shortDescription(entry);
        String installCommand = installCommand(id);
        return PackageSearchItem.builder()
                .id(id)
                .name(name)
                .description(description)
                .version(entry.getVersion())
                .homepage(entry.getProjectUrl())
                .iconUrl(entry.getIconUrl())
                .installCommand(installCommand)
                .popularity(entry.getDownloadCount())
                .packageManager(PackageManagerType.CHOCO)
                .build();
    }

    private static String displayName(ChocoEntry entry) {
        String title = entry.getTitle();
        return title != null ? title : entry.getId();
    }

    private static String shortDescription(ChocoEntry entry) {
        String summary = entry.getSummary();
        if (summary != null) {
            return summary;
        }
        String description = entry.getDescription();
        if (description == null || description.length() <= SEARCH_ITEM_DESCRIPTION_LIMIT) {
            return description;
        }
        return description.substring(0, SEARCH_ITEM_DESCRIPTION_LIMIT) + "…";
    }

    private static List<String> tags(ChocoEntry entry) {
        String rawTags = entry.getTags();
        if (rawTags == null) {
            return List.of();
        }
        String[] parts = rawTags.trim().split("\\s+");
        return Arrays.stream(parts)
                .filter(tag -> !tag.isBlank())
                .toList();
    }

    private static String installCommand(String packageId) {
        return "choco install " + packageId;
    }

    private static String firstNonNull(String first, String second) {
        return first != null ? first : second;
    }

    // OData string literals: wrap in single quotes, escape embedded quotes by doubling
    private static String quote(String value) {
        String escaped = value.replace("'", "''");
        return "'" + escaped + "'";
    }
}
