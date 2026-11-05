package com.openframe.api.service.rmm.software.matching;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toList;
import static java.util.stream.Collectors.toSet;
import static org.springframework.util.StringUtils.hasText;

// Matches a Windows program the way winget does: by upgrade code, then by the normalized name with its architecture,
// then without it.
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class WingetPackageMatcher implements PackageMatcher {

    private static final String VARIANT_SEPARATOR = ".";
    private static final Comparator<PackageCatalogEntry> SHORTEST_ID =
            Comparator.comparingInt(entry -> entry.getPackageId().length());

    private final PackageCatalogRepository catalogRepository;

    @Override
    public PackageManagerType getManager() {
        return PackageManagerType.WINGET;
    }

    @Override
    public List<PackageMatch> match(List<SoftwareResponse> rows) {
        Map<String, List<PackageCatalogEntry>> byUpgradeCode = packagesByUpgradeCode(rows);
        Map<String, List<PackageCatalogEntry>> byName = packagesByName(rows);
        return rows.stream()
                .map(row -> matchOf(row, byUpgradeCode, byName))
                .toList();
    }

    private Map<String, List<PackageCatalogEntry>> packagesByUpgradeCode(List<SoftwareResponse> rows) {
        Set<String> codes = rows.stream().flatMap(WingetPackageMatcher::upgradeCodeOf).collect(toSet());
        if (codes.isEmpty()) {
            return Map.of();
        }
        List<PackageCatalogEntry> entries = catalogRepository.findByManagerAndUpgradeCodesIn(getManager(), codes);
        return byKey(entries, PackageCatalogEntry::getUpgradeCodes, codes);
    }

    private Map<String, List<PackageCatalogEntry>> packagesByName(List<SoftwareResponse> rows) {
        Set<String> names = rows.stream().flatMap(WingetPackageMatcher::searchNamesOf).collect(toSet());
        if (names.isEmpty()) {
            return Map.of();
        }
        List<PackageCatalogEntry> entries = catalogRepository.findByManagerAndNormalizedNamesIn(getManager(), names);
        return byKey(entries, PackageCatalogEntry::getNormalizedNames, names);
    }

    private static PackageMatch matchOf(SoftwareResponse row, Map<String, List<PackageCatalogEntry>> byUpgradeCode,
                                        Map<String, List<PackageCatalogEntry>> byName) {
        Stream<List<PackageCatalogEntry>> codeCandidates = upgradeCodeOf(row).map(byUpgradeCode::get);
        Stream<List<PackageCatalogEntry>> nameCandidates = searchNamesOf(row).map(byName::get);
        List<PackageCatalogEntry> candidates = Stream.concat(codeCandidates, nameCandidates)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(List.of());
        if (candidates.isEmpty()) {
            return PackageMatch.noPackage();
        }
        return candidates.stream()
                .min(SHORTEST_ID)
                .filter(base -> isBaseOfAll(base, candidates))
                .map(PackageMatch::of)
                .orElseGet(PackageMatch::ambiguous);
    }

    // several packages under one name are mostly variants of one (Mozilla.Firefox, Mozilla.Firefox.af): the base one
    // is taken; unrelated packages under one name leave the program unmatched
    private static boolean isBaseOfAll(PackageCatalogEntry base, List<PackageCatalogEntry> candidates) {
        String baseId = base.getPackageId().toLowerCase(Locale.ROOT);
        String variantPrefix = baseId + VARIANT_SEPARATOR;
        return candidates.stream()
                .map(entry -> entry.getPackageId().toLowerCase(Locale.ROOT))
                .allMatch(id -> id.equals(baseId) || id.startsWith(variantPrefix));
    }

    private static Map<String, List<PackageCatalogEntry>> byKey(List<PackageCatalogEntry> entries,
                                                                Function<PackageCatalogEntry, List<String>> keysOf,
                                                                Set<String> requested) {
        return entries.stream()
                .flatMap(entry -> requestedKeysOf(entry, keysOf, requested).map(key -> Map.entry(key, entry)))
                .collect(groupingBy(Map.Entry::getKey, mapping(Map.Entry::getValue, toList())));
    }

    private static Stream<String> requestedKeysOf(PackageCatalogEntry entry,
                                                  Function<PackageCatalogEntry, List<String>> keysOf,
                                                  Set<String> requested) {
        List<String> keys = keysOf.apply(entry);
        return keys == null ? Stream.empty() : keys.stream().filter(requested::contains);
    }

    private static Stream<String> upgradeCodeOf(SoftwareResponse row) {
        return Stream.ofNullable(row.getUpgradeCode())
                .filter(code -> hasText(code))
                .map(code -> code.toLowerCase(Locale.ROOT));
    }

    private static Stream<String> searchNamesOf(SoftwareResponse row) {
        return Stream.ofNullable(row.getName())
                .flatMap(name -> WingetNameNormalizer.searchNames(name).stream());
    }
}
