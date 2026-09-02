package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.core.rest.PackageSearchRestClientFactory;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.GZIPInputStream;

@Slf4j
@Component
public class BrewCatalogFetcher {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public BrewCatalogFetcher(PackageCatalogSyncProperties properties, ObjectMapper objectMapper) {
        PackageCatalogSyncProperties.Brew brew = properties.getBrew();
        this.restClient = PackageSearchRestClientFactory.create(brew.getBaseUrl(), brew.getTimeout());
        this.objectMapper = objectMapper;
    }

    public List<PackageCatalogEntry> fetchAll() {
        List<BrewFormulaJson> formulae = fetchJson("/api/formula.json", new TypeReference<>() {
        });
        List<BrewCaskJson> casks = fetchJson("/api/cask.json", new TypeReference<>() {
        });
        Map<String, Integer> formulaInstalls = fetchAnalytics("/api/analytics/install/30d.json", "formula");
        Map<String, Integer> caskInstalls = fetchAnalytics("/api/analytics/cask-install/30d.json", "cask");

        List<PackageCatalogEntry> entries = new ArrayList<>();
        for (BrewFormulaJson formula : formulae) {
            if (shouldSkipFormula(formula)) {
                continue;
            }
            entries.add(toFormulaEntry(formula, formulaInstalls));
        }
        for (BrewCaskJson cask : casks) {
            if (shouldSkipCask(cask)) {
                continue;
            }
            entries.add(toCaskEntry(cask, caskInstalls));
        }
        log.info("Fetched Homebrew catalog: {} entries", entries.size());
        return entries;
    }

    private static boolean shouldSkipFormula(BrewFormulaJson formula) {
        String name = formula.getName();
        Boolean disabled = formula.getDisabled();
        return name == null || Boolean.TRUE.equals(disabled);
    }

    private static boolean shouldSkipCask(BrewCaskJson cask) {
        String token = cask.getToken();
        Boolean disabled = cask.getDisabled();
        return token == null || Boolean.TRUE.equals(disabled);
    }

    private static PackageCatalogEntry toFormulaEntry(BrewFormulaJson formula, Map<String, Integer> installs) {
        String name = formula.getName();
        BrewFormulaJson.Versions versions = formula.getVersions();
        String stableVersion = versions == null ? null : versions.getStable();
        List<String> aliases = concat(formula.getAliases(), formula.getOldnames());
        Integer popularity = installs.get(name);
        String blob = SearchBlob.of(name, name, formula.getDesc(), aliases);
        String entryId = PackageCatalogEntry.entryId(PackageManagerType.BREW, BrewPackageType.FORMULA, name);
        return PackageCatalogEntry.builder()
                .id(entryId)
                .manager(PackageManagerType.BREW.name())
                .packageId(name)
                .name(name)
                .description(formula.getDesc())
                .homepage(formula.getHomepage())
                .version(stableVersion)
                .license(formula.getLicense())
                .brewType(BrewPackageType.FORMULA.name())
                .popularity(popularity)
                .aliases(aliases)
                .searchBlob(blob)
                .build();
    }

    private static PackageCatalogEntry toCaskEntry(BrewCaskJson cask, Map<String, Integer> installs) {
        String token = cask.getToken();
        List<String> names = cask.getName();
        String displayName = names == null || names.isEmpty() ? token : names.getFirst();
        List<String> aliases = concat(cask.getOldTokens(), null);
        Integer popularity = installs.get(token);
        String blob = SearchBlob.of(token, displayName, cask.getDesc(), aliases);
        String entryId = PackageCatalogEntry.entryId(PackageManagerType.BREW, BrewPackageType.CASK, token);
        return PackageCatalogEntry.builder()
                .id(entryId)
                .manager(PackageManagerType.BREW.name())
                .packageId(token)
                .name(displayName)
                .description(cask.getDesc())
                .homepage(cask.getHomepage())
                .version(cask.getVersion())
                .brewType(BrewPackageType.CASK.name())
                .popularity(popularity)
                .aliases(aliases)
                .searchBlob(blob)
                .build();
    }

    private <T> T fetchJson(String path, TypeReference<T> type) {
        try (InputStream body = openBody(path)) {
            return objectMapper.readValue(body, type);
        } catch (IOException e) {
            throw new UncheckedIOException("failed to fetch " + path, e);
        }
    }

    // analytics are best-effort ranking data — their absence must not fail the whole catalog sync
    private Map<String, Integer> fetchAnalytics(String path, String nameField) {
        try (InputStream body = openBody(path)) {
            JsonNode root = objectMapper.readTree(body);
            return toInstallCounts(root, nameField);
        } catch (Exception e) {
            log.warn("Failed to fetch Homebrew analytics {}", path, e);
            return Map.of();
        }
    }

    private static Map<String, Integer> toInstallCounts(JsonNode root, String nameField) {
        Map<String, Integer> counts = new HashMap<>();
        for (JsonNode item : root.path("items")) {
            String name = item.path(nameField).asText(null);
            String count = item.path("count").asText(null);
            if (name == null || count == null) {
                continue;
            }
            Integer parsed = parseCount(count);
            if (parsed != null) {
                counts.put(name, parsed);
            }
        }
        return counts;
    }

    private InputStream openBody(String path) throws IOException {
        ResponseEntity<byte[]> response = restClient.get()
                .uri(path)
                .header(HttpHeaders.ACCEPT_ENCODING, "gzip")
                .retrieve()
                .toEntity(byte[].class);
        byte[] body = response.getBody();
        if (body == null) {
            throw new IOException("empty response from " + path);
        }
        InputStream stream = new ByteArrayInputStream(body);
        String encoding = response.getHeaders().getFirst(HttpHeaders.CONTENT_ENCODING);
        if (encoding != null && encoding.contains("gzip")) {
            stream = new GZIPInputStream(stream);
        }
        return stream;
    }

    // brew analytics serialise counts with comma thousands-separators, e.g. "537,301"
    static Integer parseCount(String count) {
        try {
            String plain = count.replace(",", "");
            return Integer.parseInt(plain);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static List<String> concat(List<String> first, List<String> second) {
        List<String> result = new ArrayList<>();
        if (first != null) {
            result.addAll(first);
        }
        if (second != null) {
            result.addAll(second);
        }
        return List.copyOf(result);
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class BrewFormulaJson {
        private String name;
        private String desc;
        private String homepage;
        private String license;
        private List<String> aliases;
        private List<String> oldnames;
        private Versions versions;
        private Boolean disabled;

        @Data
        @NoArgsConstructor
        @JsonIgnoreProperties(ignoreUnknown = true)
        static class Versions {
            private String stable;
        }
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class BrewCaskJson {
        private String token;
        private List<String> name;
        private String desc;
        private String homepage;
        private String version;
        @JsonProperty("old_tokens")
        private List<String> oldTokens;
        private Boolean disabled;
    }
}
