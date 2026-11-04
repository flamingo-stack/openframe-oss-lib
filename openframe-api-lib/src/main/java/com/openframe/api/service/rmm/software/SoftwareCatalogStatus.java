package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVersionStatus;
import com.openframe.api.util.SoftwareVersions;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.AllArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Stream;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toList;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;
import static org.springframework.util.StringUtils.hasText;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareCatalogStatus {

    private static final String WINDOWS_PROGRAMS = "programs";
    private static final String MAC_APPS = "apps";
    private static final String APP_BUNDLE_SUFFIX = ".app";
    private static final String CASK_BUILD_SEPARATOR = ",";
    private static final String UNVERSIONED_CASK = "latest";
    private static final List<String> VARIANT_SEPARATORS = List.of(".", "@");

    // a formula and a cask can share a token: the title is taken as the formula then
    private static final Comparator<PackageCatalogEntry> FORMULA_FIRST =
            Comparator.comparing(entry -> entry.getBrewType() != BrewPackageType.FORMULA);
    private static final Comparator<PackageCatalogEntry> SHORTEST_ID =
            Comparator.comparingInt(entry -> entry.getPackageId().length());

    private final PackageCatalogRepository catalogRepository;

    // Runs after SoftwareAutoUpdateService: a policy's ON / OFF stays, a row without one gets what the catalog allows.
    public void apply(List<SoftwareResponse> rows) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        CatalogPackages packages = loadPackages(rows);
        rows.forEach(row -> apply(row, packages));
    }

    private CatalogPackages loadPackages(List<SoftwareResponse> rows) {
        Map<String, PackageCatalogEntry> brewByToken = brewPackagesByToken(rows);
        Map<String, List<PackageCatalogEntry>> wingetByUpgradeCode = wingetPackagesByUpgradeCode(rows);
        Map<String, List<PackageCatalogEntry>> wingetByName = wingetPackagesByName(rows);
        Map<String, List<PackageCatalogEntry>> casksByAppName = casksByAppName(rows);
        return new CatalogPackages(brewByToken, wingetByUpgradeCode, wingetByName, casksByAppName);
    }

    private Map<String, PackageCatalogEntry> brewPackagesByToken(List<SoftwareResponse> rows) {
        Set<String> tokens = keysOf(rows, SoftwareCatalogStatus::isBrewPackage, SoftwareCatalogStatus::brewTokenOf);
        if (tokens.isEmpty()) {
            return Map.of();
        }
        return catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.BREW, tokens).stream()
                .filter(entry -> entry.getPackageId() != null && entry.getVersion() != null)
                .collect(groupingBy(entry -> entry.getPackageId().toLowerCase(Locale.ROOT)))
                .entrySet().stream()
                .collect(toMap(Map.Entry::getKey, e -> e.getValue().stream().min(FORMULA_FIRST).orElseThrow()));
    }

    private Map<String, List<PackageCatalogEntry>> wingetPackagesByUpgradeCode(List<SoftwareResponse> rows) {
        Set<String> codes = keysOf(rows, SoftwareCatalogStatus::isWindowsProgram, SoftwareCatalogStatus::upgradeCodeOf);
        if (codes.isEmpty()) {
            return Map.of();
        }
        List<PackageCatalogEntry> entries =
                catalogRepository.findByManagerAndUpgradeCodesIn(PackageManagerType.WINGET, codes);
        return byKey(entries, PackageCatalogEntry::getUpgradeCodes, codes);
    }

    private Map<String, List<PackageCatalogEntry>> wingetPackagesByName(List<SoftwareResponse> rows) {
        Set<String> names = keysOf(rows, SoftwareCatalogStatus::isWindowsProgram, SoftwareCatalogStatus::wingetNamesOf);
        if (names.isEmpty()) {
            return Map.of();
        }
        List<PackageCatalogEntry> entries =
                catalogRepository.findByManagerAndNormalizedNamesIn(PackageManagerType.WINGET, names);
        return byKey(entries, PackageCatalogEntry::getNormalizedNames, names);
    }

    private Map<String, List<PackageCatalogEntry>> casksByAppName(List<SoftwareResponse> rows) {
        Set<String> appNames = keysOf(rows, SoftwareCatalogStatus::isMacApp, SoftwareCatalogStatus::appNameOf);
        if (appNames.isEmpty()) {
            return Map.of();
        }
        List<PackageCatalogEntry> entries =
                catalogRepository.findByManagerAndAppNamesIn(PackageManagerType.BREW, appNames);
        return byKey(entries, PackageCatalogEntry::getAppNames, appNames);
    }

    private static void apply(SoftwareResponse row, CatalogPackages packages) {
        if (isBrewPackage(row)) {
            applyBrewPackage(row, packages);
        } else if (isWindowsProgram(row)) {
            applyWindowsProgram(row, packages);
        } else if (isMacApp(row)) {
            applyMacApp(row, packages);
        } else {
            applyLatest(row, null);
        }
    }

    private static void applyBrewPackage(SoftwareResponse row, CatalogPackages packages) {
        Optional<PackageCatalogEntry> found = brewTokenOf(row)
                .map(packages.brewByToken::get)
                .filter(Objects::nonNull)
                .findFirst();
        String latest = found.map(SoftwareCatalogStatus::brewVersionOf).orElse(null);
        applyLatest(row, latest);
        if (row.getAutoUpdate() == null) {
            row.setAutoUpdate(found.isPresent() ? SoftwareAutoUpdateStatus.OFF : SoftwareAutoUpdateStatus.NO_PACKAGE);
        }
    }

    // winget updates a program it matches whoever installed it, so a match alone makes auto-update possible;
    // brew updates an app only when brew installed it, which an apps row does not tell, so applyMacApp leaves it
    private static void applyWindowsProgram(SoftwareResponse row, CatalogPackages packages) {
        List<PackageCatalogEntry> candidates = packages.wingetCandidatesOf(row);
        Optional<PackageCatalogEntry> found = basePackageOf(candidates);
        found.ifPresent(entry -> row.setSource(SoftwareSource.WINGET));
        String latest = found.map(SoftwareCatalogStatus::wingetVersionOf).orElse(null);
        applyLatest(row, latest);
        if (row.getAutoUpdate() != null) {
            return;
        }
        if (found.isPresent()) {
            row.setAutoUpdate(SoftwareAutoUpdateStatus.OFF);
        } else if (candidates.isEmpty()) {
            row.setAutoUpdate(SoftwareAutoUpdateStatus.NO_PACKAGE);
        }
    }

    private static void applyMacApp(SoftwareResponse row, CatalogPackages packages) {
        List<PackageCatalogEntry> candidates = packages.casksOf(row);
        Optional<PackageCatalogEntry> found = basePackageOf(candidates);
        found.ifPresent(entry -> row.setSource(SoftwareSource.BREW));
        String latest = found.map(SoftwareCatalogStatus::brewVersionOf).orElse(null);
        applyLatest(row, latest);
    }

    private static void applyLatest(SoftwareResponse row, String catalogLatest) {
        if (catalogLatest != null) {
            row.setLatestVersion(catalogLatest);
        }
        SoftwareVersionStatus status = versionStatus(row, catalogLatest);
        row.setVersionStatus(status);
    }

    // Devices behind each other are outdated whatever the catalog says; with one version everywhere only the catalog
    // can tell whether a newer release is out.
    private static SoftwareVersionStatus versionStatus(SoftwareResponse row, String catalogLatest) {
        Integer older = row.getOlderVersionsCount();
        if (older != null && older > 0) {
            return SoftwareVersionStatus.OUTDATED;
        }
        String installed = row.getCurrentVersion();
        if (catalogLatest == null || installed == null) {
            return SoftwareVersionStatus.UNKNOWN;
        }
        return SoftwareVersions.compare(installed, catalogLatest) >= 0
                ? SoftwareVersionStatus.UP_TO_DATE : SoftwareVersionStatus.OUTDATED;
    }

    private static Optional<PackageCatalogEntry> basePackageOf(List<PackageCatalogEntry> candidates) {
        return candidates.stream()
                .min(SHORTEST_ID)
                .filter(base -> isBaseOfAll(base, candidates));
    }

    private static boolean isBaseOfAll(PackageCatalogEntry base, List<PackageCatalogEntry> candidates) {
        String baseId = base.getPackageId().toLowerCase(Locale.ROOT);
        return candidates.stream()
                .map(entry -> entry.getPackageId().toLowerCase(Locale.ROOT))
                .allMatch(id -> id.equals(baseId) || isVariantOf(id, baseId));
    }

    private static boolean isVariantOf(String id, String baseId) {
        return VARIANT_SEPARATORS.stream().anyMatch(separator -> id.startsWith(baseId + separator));
    }

    private static String wingetVersionOf(PackageCatalogEntry entry) {
        return hasText(entry.getDisplayVersion()) ? entry.getDisplayVersion() : entry.getVersion();
    }

    // a cask version may end in a build after a comma (3.3.3,5004) that the app does not report, or be "latest"
    private static String brewVersionOf(PackageCatalogEntry entry) {
        String version = entry.getVersion();
        if (version == null || UNVERSIONED_CASK.equals(version)) {
            return null;
        }
        int build = version.indexOf(CASK_BUILD_SEPARATOR);
        return build < 0 ? version : version.substring(0, build);
    }

    private static Set<String> keysOf(List<SoftwareResponse> rows, Predicate<SoftwareResponse> kind,
                                      Function<SoftwareResponse, Stream<String>> keys) {
        return rows.stream().filter(kind).flatMap(keys).collect(toSet());
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

    private static boolean isBrewPackage(SoftwareResponse row) {
        return row.getSource() == SoftwareSource.BREW;
    }

    private static boolean isWindowsProgram(SoftwareResponse row) {
        return WINDOWS_PROGRAMS.equals(row.getFleetSource());
    }

    private static boolean isMacApp(SoftwareResponse row) {
        return MAC_APPS.equals(row.getFleetSource());
    }

    private static Stream<String> brewTokenOf(SoftwareResponse row) {
        return Stream.ofNullable(row.getName()).map(name -> name.toLowerCase(Locale.ROOT));
    }

    private static Stream<String> upgradeCodeOf(SoftwareResponse row) {
        return Stream.ofNullable(row.getUpgradeCode())
                .filter(code -> hasText(code))
                .map(code -> code.toLowerCase(Locale.ROOT));
    }

    private static Stream<String> wingetNamesOf(SoftwareResponse row) {
        return Stream.ofNullable(row.getName())
                .flatMap(name -> WingetNameNormalizer.searchNames(name).stream());
    }

    private static Stream<String> appNameOf(SoftwareResponse row) {
        return Stream.ofNullable(row.getName())
                .map(name -> name.toLowerCase(Locale.ROOT))
                .map(name -> name.endsWith(APP_BUNDLE_SUFFIX) ? name : name + APP_BUNDLE_SUFFIX);
    }

    @AllArgsConstructor
    private static class CatalogPackages {
        private final Map<String, PackageCatalogEntry> brewByToken;
        private final Map<String, List<PackageCatalogEntry>> wingetByUpgradeCode;
        private final Map<String, List<PackageCatalogEntry>> wingetByName;
        private final Map<String, List<PackageCatalogEntry>> casksByAppName;

        List<PackageCatalogEntry> wingetCandidatesOf(SoftwareResponse row) {
            Stream<List<PackageCatalogEntry>> byUpgradeCode = upgradeCodeOf(row).map(wingetByUpgradeCode::get);
            Stream<List<PackageCatalogEntry>> byName = wingetNamesOf(row).map(wingetByName::get);
            return Stream.concat(byUpgradeCode, byName)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(List.of());
        }

        List<PackageCatalogEntry> casksOf(SoftwareResponse row) {
            return appNameOf(row)
                    .map(casksByAppName::get)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(List.of());
        }
    }
}
