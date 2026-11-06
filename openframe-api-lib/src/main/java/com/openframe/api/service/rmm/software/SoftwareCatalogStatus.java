package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVersionStatus;
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

/**
 * What the package catalog says about software rows: the newest release, whether a row is behind it, and whether
 * auto-update can keep it. Fleet names a Homebrew formula by its token, so only those rows map onto the catalog; for
 * every other row the newest release known is the highest version on the tenant's devices.
 */
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareCatalogStatus {

    // a formula and a cask can share a token: the title is taken as the formula then
    private static final Comparator<PackageCatalogEntry> FORMULA_FIRST =
            Comparator.comparing(entry -> entry.getBrewType() != BrewPackageType.FORMULA);

    private final PackageCatalogRepository catalogRepository;

    // Runs after SoftwareAutoUpdateService: a policy's ON / OFF stays, a row without one gets what the catalog allows.
    public void apply(List<SoftwareResponse> rows) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        Map<String, String> latest = latestBrewVersions(rows);
        for (SoftwareResponse row : rows) {
            String catalogLatest = catalogLatest(row, latest);
            apply(row, catalogLatest);
        }
    }

    private static String catalogLatest(SoftwareResponse row, Map<String, String> latest) {
        String token = brewToken(row);
        return token == null ? null : latest.get(token);
    }

    private static void apply(SoftwareResponse row, String catalogLatest) {
        if (catalogLatest != null) {
            row.setLatestVersion(catalogLatest);
        }
        SoftwareVersionStatus status = versionStatus(row, catalogLatest);
        row.setVersionStatus(status);
        if (row.getAutoUpdate() == null && row.getSource() == SoftwareSource.BREW) {
            row.setAutoUpdate(catalogLatest != null ? SoftwareAutoUpdateStatus.OFF : SoftwareAutoUpdateStatus.NO_PACKAGE);
        }
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

    private Map<String, String> latestBrewVersions(List<SoftwareResponse> rows) {
        Set<String> tokens = rows.stream().map(SoftwareCatalogStatus::brewToken).filter(Objects::nonNull).collect(toSet());
        if (tokens.isEmpty()) {
            return Map.of();
        }
        return catalogRepository.findByManagerAndPackageIdIn(PackageManagerType.BREW, tokens).stream()
                .filter(entry -> entry.getPackageId() != null && entry.getVersion() != null)
                .collect(groupingBy(entry -> entry.getPackageId().toLowerCase(Locale.ROOT)))
                .entrySet().stream()
                .collect(toMap(Map.Entry::getKey,
                        e -> e.getValue().stream().min(FORMULA_FIRST).orElseThrow().getVersion()));
    }

    private static String brewToken(SoftwareResponse row) {
        if (row.getSource() != SoftwareSource.BREW || row.getName() == null) {
            return null;
        }
        return row.getName().toLowerCase(Locale.ROOT);
    }
}
