package com.openframe.api.service.packagesearch;

import com.openframe.core.rest.PackageSearchRestClientFactory;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
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
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.yaml.snakeyaml.Yaml;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class WingetPackageService implements PackageManagerClient {

    private static final String UNAVAILABLE_MESSAGE =
            "The winget catalog is temporarily unavailable. Please try again later.";
    private static final int DETAILS_CACHE_MAX_SIZE = 5000;

    private final PackageCatalogRepository packageCatalogRepository;
    private final RestClient restClient;
    private final Cache<String, PackageDetails> detailsCache;

    public WingetPackageService(PackageCatalogRepository packageCatalogRepository, PackageSearchProperties properties) {
        PackageSearchProperties.Winget winget = properties.getWinget();
        this.packageCatalogRepository = packageCatalogRepository;
        this.restClient = PackageSearchRestClientFactory.create(winget.getBaseUrl(), winget.getTimeout());
        this.detailsCache = Caffeine.newBuilder()
                .expireAfterWrite(winget.getDetailCacheTtl())
                .maximumSize(DETAILS_CACHE_MAX_SIZE)
                .build();
    }

    @Override
    public PackageManagerType getPackageManagerType() {
        return PackageManagerType.WINGET;
    }

    @Override
    public PackageSearchResult search(String query, int limit, int offset) {
        String normalizedQuery = query.trim().toLowerCase(Locale.ROOT);
        List<Scored> matched = scoreCandidates(normalizedQuery);
        List<PackageSearchItem> items = pageOf(matched, limit, offset);
        int total = matched.size();
        boolean hasMore = offset + limit < total;
        return PackageSearchResult.builder()
                .items(items)
                .total(total)
                .hasMore(hasMore)
                .build();
    }

    @Override
    public PackageDetails findPackage(String packageId, BrewPackageType packageType) {
        String managerName = PackageManagerType.WINGET.name();
        List<PackageCatalogEntry> found = packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(managerName, packageId);
        if (found.isEmpty()) {
            throw new PackageNotFoundException(packageId);
        }
        PackageCatalogEntry entry = found.getFirst();
        String cacheKey = entry.getPackageId();
        return detailsCache.get(cacheKey, key -> loadDetails(entry));
    }

    private List<Scored> scoreCandidates(String query) {
        String managerName = PackageManagerType.WINGET.name();
        List<PackageCatalogEntry> candidates = packageCatalogRepository.findByManagerAndSearchBlobContaining(managerName, query);
        return candidates.stream()
                .map(entry -> scoreEntry(query, entry))
                .filter(Scored::isMatch)
                .sorted(byRelevance())
                .toList();
    }

    private Scored scoreEntry(String query, PackageCatalogEntry entry) {
        int score = PackageMatcher.score(query, entry.getPackageId(), entry.getName(),
                entry.getAliases(), null);
        return new Scored(score, entry);
    }

    // locale forks share the canonical package's moniker (Mozilla.Firefox.ach etc. all carry
    // "firefox"), so on equal score the shortest id wins — that is the canonical package
    private static Comparator<Scored> byRelevance() {
        Comparator<Scored> byScore = Comparator.comparingInt(Scored::getScore).reversed();
        return byScore
                .thenComparingInt(Scored::idLength)
                .thenComparing(Scored::entryName, String.CASE_INSENSITIVE_ORDER);
    }

    private List<PackageSearchItem> pageOf(List<Scored> matched, int limit, int offset) {
        return matched.stream()
                .skip(offset)
                .limit(limit)
                .map(this::toItem)
                .toList();
    }

    private PackageSearchItem toItem(Scored scored) {
        PackageCatalogEntry entry = scored.getEntry();
        String id = entry.getPackageId();
        String installCommand = installCommand(id);
        return PackageSearchItem.builder()
                .id(id)
                .name(entry.getName())
                .version(entry.getVersion())
                .publisher(entry.getPublisher())
                .installCommand(installCommand)
                .packageManager(PackageManagerType.WINGET)
                .build();
    }

    private PackageDetails loadDetails(PackageCatalogEntry entry) {
        List<VersionData> versionData = fetchVersionData(entry);
        Map<String, Object> manifest = fetchLatestManifest(versionData);

        List<PackageVersion> versions = toVersions(versionData, entry);
        String entryId = entry.getPackageId();
        String manifestName = stringValue(manifest, "PackageName");
        String description = firstNonNull(stringValue(manifest, "Description"), stringValue(manifest, "ShortDescription"));
        String publisher = firstNonNull(stringValue(manifest, "Publisher"), entry.getPublisher());
        String homepage = firstNonNull(stringValue(manifest, "PackageUrl"), stringValue(manifest, "PublisherUrl"));
        String license = stringValue(manifest, "License");
        String installCommand = installCommand(entryId);
        String entryName = entry.getName();
        String name = firstNonNull(manifestName, entryName);
        String icon = iconUrl(manifest);
        List<String> manifestTags = tags(manifest);
        return PackageDetails.builder()
                .id(entryId)
                .packageManager(PackageManagerType.WINGET)
                .name(name)
                .description(description)
                .publisher(publisher)
                .homepage(homepage)
                .iconUrl(icon)
                .license(license)
                .installCommand(installCommand)
                .tags(manifestTags)
                .versions(versions)
                .build();
    }

    private Map<String, Object> fetchLatestManifest(List<VersionData> versionData) {
        if (versionData.isEmpty()) {
            return Map.of();
        }
        VersionData latest = versionData.getFirst();
        String relativePath = latest.getRelativePath();
        return fetchManifest(relativePath);
    }

    private List<PackageVersion> toVersions(List<VersionData> versionData, PackageCatalogEntry entry) {
        if (versionData.isEmpty()) {
            String latestVersion = entry.getVersion();
            PackageVersion onlyKnown = PackageVersion.builder().version(latestVersion).build();
            return List.of(onlyKnown);
        }
        return versionData.stream()
                .map(this::toPackageVersion)
                .toList();
    }

    private PackageVersion toPackageVersion(VersionData data) {
        String version = data.getVersion();
        return PackageVersion.builder().version(version).build();
    }

    @Getter
    @AllArgsConstructor
    static final class VersionData {
        private final String version;
        private final String relativePath;
    }

    private List<VersionData> fetchVersionData(PackageCatalogEntry entry) {
        String id = entry.getPackageId();
        String hashPrefix = entry.getHashPrefix();
        byte[] compressed = fetchBytes("/cache/packages/" + id + "/" + hashPrefix + "/versionData.mszyml");
        try {
            byte[] decompressed = Mszip.decompress(compressed);
            String yaml = new String(decompressed, StandardCharsets.UTF_8);
            return parseVersionData(yaml);
        } catch (RuntimeException e) {
            // a corrupt CDN body must read as "source unavailable", not leak decoder internals
            throw new PackageSourceUnavailableException(UNAVAILABLE_MESSAGE, e);
        }
    }

    private static final String VERSION_PREFIX = "- v: ";
    private static final String PATH_PREFIX = "  rP: ";

    // parsed by line on purpose: a YAML parser would read versions like 154.0 as floats and mangle 4.280
    static List<VersionData> parseVersionData(String yaml) {
        List<VersionData> versions = new ArrayList<>();
        String version = null;
        for (String line : yaml.split("\n")) {
            if (line.startsWith(VERSION_PREFIX)) {
                String rawVersion = line.substring(VERSION_PREFIX.length()).trim();
                version = unquote(rawVersion);
            } else if (line.startsWith(PATH_PREFIX) && version != null) {
                String rawPath = line.substring(PATH_PREFIX.length()).trim();
                String relativePath = unquote(rawPath);
                VersionData data = new VersionData(version, relativePath);
                versions.add(data);
                version = null;
            }
        }
        return versions;
    }

    private Map<String, Object> fetchManifest(String relativePath) {
        byte[] body = fetchBytes("/cache/" + relativePath);
        try {
            String yamlText = new String(body, StandardCharsets.UTF_8);
            Object loaded = new Yaml().load(yamlText);
            if (loaded instanceof Map<?, ?> map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> manifest = (Map<String, Object>) map;
                return manifest;
            }
            return Map.of();
        } catch (RuntimeException e) {
            // a corrupt CDN body must read as "source unavailable", not leak parser internals
            throw new PackageSourceUnavailableException(UNAVAILABLE_MESSAGE, e);
        }
    }

    private byte[] fetchBytes(String path) {
        try {
            byte[] body = restClient.get().uri(path).retrieve().body(byte[].class);
            if (body == null) {
                throw new PackageSourceUnavailableException(UNAVAILABLE_MESSAGE);
            }
            return body;
        } catch (RestClientException e) {
            throw new PackageSourceUnavailableException(UNAVAILABLE_MESSAGE, e);
        }
    }

    private static String installCommand(String packageId) {
        return "winget install -e --id " + packageId;
    }

    private static String stringValue(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private static String iconUrl(Map<String, Object> manifest) {
        if (manifest.get("Icons") instanceof List<?> icons && !icons.isEmpty()
                && icons.getFirst() instanceof Map<?, ?> icon) {
            Object url = icon.get("IconUrl");
            return url == null ? null : String.valueOf(url);
        }
        return null;
    }

    private static List<String> tags(Map<String, Object> manifest) {
        if (manifest.get("Tags") instanceof List<?> raw) {
            return raw.stream().map(String::valueOf).toList();
        }
        return List.of();
    }

    private static String firstNonNull(String first, String second) {
        return first != null ? first : second;
    }

    private static String unquote(String value) {
        boolean singleQuoted = value.startsWith("'") && value.endsWith("'");
        boolean doubleQuoted = value.startsWith("\"") && value.endsWith("\"");
        if (value.length() >= 2 && (singleQuoted || doubleQuoted)) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    @Getter
    @AllArgsConstructor
    private static final class Scored {
        private final int score;
        private final PackageCatalogEntry entry;

        private boolean isMatch() {
            return score > 0;
        }

        private int idLength() {
            return entry.getPackageId().length();
        }

        private String entryName() {
            return entry.getName();
        }
    }
}
