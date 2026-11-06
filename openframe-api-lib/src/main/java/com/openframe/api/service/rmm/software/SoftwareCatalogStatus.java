package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVersionStatus;
import com.openframe.api.service.rmm.software.matching.PackageMatch;
import com.openframe.api.service.rmm.software.matching.SoftwarePackageMatcher;
import com.openframe.core.util.SoftwareVersions;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareCatalogStatus {

    private static final String CASK_BUILD_SEPARATOR = ",";
    private static final String UNVERSIONED_CASK = "latest";
    private static final Map<PackageManagerType, SoftwareSource> SOURCE_BY_MANAGER =
            Map.of(PackageManagerType.WINGET, SoftwareSource.WINGET);

    // a formula and a cask can share a token: the title is taken as the formula then
    private static final Comparator<PackageCatalogEntry> FORMULA_FIRST =
            Comparator.comparing(entry -> entry.getBrewType() != BrewPackageType.FORMULA);

    private final PackageCatalogRepository catalogRepository;
    private final SoftwarePackageMatcher packageMatcher;

    // Runs after SoftwareAutoUpdateService: a policy's ON / OFF stays, a row without one gets what the catalog allows.
    public void apply(List<SoftwareResponse> rows) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        Map<String, PackageCatalogEntry> brewPackages = brewPackagesByToken(rows);
        Map<SoftwareResponse, PackageMatch> matches = packageMatcher.match(rows);
        rows.forEach(row -> apply(row, brewPackages, matches));
    }

    private static void apply(SoftwareResponse row, Map<String, PackageCatalogEntry> brewPackages,
                              Map<SoftwareResponse, PackageMatch> matches) {
        PackageMatch match = matches.get(row);
        if (isBrewPackage(row)) {
            applyBrewPackage(row, brewPackages);
        } else if (match != null) {
            applyMatch(row, match);
        } else {
            applyLatest(row, null);
        }
    }

    private static void applyBrewPackage(SoftwareResponse row, Map<String, PackageCatalogEntry> brewPackages) {
        String token = brewTokenOf(row);
        PackageCatalogEntry entry = token == null ? null : brewPackages.get(token);
        String latest = entry == null ? null : brewVersionOf(entry);
        applyLatest(row, latest);
        if (row.getAutoUpdate() == null) {
            row.setAutoUpdate(entry != null ? SoftwareAutoUpdateStatus.OFF : SoftwareAutoUpdateStatus.NO_PACKAGE);
        }
    }

    // winget updates a program it matches whoever installed it, so a match alone makes the program manageable
    private static void applyMatch(SoftwareResponse row, PackageMatch match) {
        PackageCatalogEntry entry = match.getEntry();
        String latest = match.isMatched() ? versionOf(entry) : null;
        applyLatest(row, latest);
        if (match.isMatched()) {
            SoftwareSource source = SOURCE_BY_MANAGER.get(entry.getManager());
            row.setSource(source);
        }
        if (row.getAutoUpdate() != null) {
            return;
        }
        if (match.isMatched()) {
            row.setAutoUpdate(SoftwareAutoUpdateStatus.OFF);
        } else if (match.hasNoPackage()) {
            row.setAutoUpdate(SoftwareAutoUpdateStatus.NO_PACKAGE);
        }
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

    private Map<String, PackageCatalogEntry> brewPackagesByToken(List<SoftwareResponse> rows) {
        Set<String> tokens = rows.stream()
                .filter(SoftwareCatalogStatus::isBrewPackage)
                .map(SoftwareCatalogStatus::brewTokenOf)
                .filter(Objects::nonNull)
                .collect(toSet());
        if (tokens.isEmpty()) {
            return Map.of();
        }
        return catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.BREW, tokens).stream()
                .filter(entry -> entry.getPackageId() != null && entry.getVersion() != null)
                .collect(groupingBy(entry -> entry.getPackageId().toLowerCase(Locale.ROOT)))
                .entrySet().stream()
                .collect(toMap(Map.Entry::getKey, e -> e.getValue().stream().min(FORMULA_FIRST).orElseThrow()));
    }

    private static String versionOf(PackageCatalogEntry entry) {
        return entry.getVersion();
    }

    // a cask version may end in a build after a comma (3.3.3,5004) that the app does not report, or be "latest"
    private static String brewVersionOf(PackageCatalogEntry entry) {
        String version = entry.getVersion();
        if (UNVERSIONED_CASK.equals(version)) {
            return null;
        }
        int build = version.indexOf(CASK_BUILD_SEPARATOR);
        return build < 0 ? version : version.substring(0, build);
    }

    private static boolean isBrewPackage(SoftwareResponse row) {
        return row.getSource() == SoftwareSource.BREW;
    }

    private static String brewTokenOf(SoftwareResponse row) {
        return row.getName() == null ? null : row.getName().toLowerCase(Locale.ROOT);
    }
}
