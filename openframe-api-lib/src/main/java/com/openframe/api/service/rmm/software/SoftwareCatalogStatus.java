package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVersionStatus;
import com.openframe.data.service.rmm.software.matching.InstalledProgram;
import com.openframe.data.service.rmm.software.matching.PackageMatch;
import com.openframe.data.service.rmm.software.matching.SoftwarePackageMatcher;
import com.openframe.core.util.SoftwareVersions;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;
import static org.springframework.util.StringUtils.hasText;

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
    private final PackageManagerAvailability packageManagerAvailability;
    private final MachineRepository machineRepository;
    private final TenantIdProvider tenantIdProvider;

    // Runs after SoftwareAutoUpdateService: a policy's ON / OFF stays, a row without one gets what the catalog allows.
    public void apply(List<SoftwareResponse> rows) {
        apply(rows, manager -> true, packageManagerAvailability::isEnabled);
    }

    // a manager counts on a device only where it runs: there winget's package gives way to the one to adopt into
    public void applyOnDevice(String machineId, List<SoftwareResponse> rows) {
        String tenantId = tenantIdProvider.getTenantId();
        Optional<Machine> found = machineRepository.findByTenantIdAndMachineId(tenantId, machineId);
        if (found.isEmpty()) {
            apply(rows);
            return;
        }
        Machine device = found.get();
        apply(rows, manager -> PackageManagerAvailability.isPresentOn(device, manager),
                manager -> packageManagerAvailability.isAdoptableOn(device, manager));
    }

    private void apply(List<SoftwareResponse> rows, Predicate<PackageManagerType> manages,
                       Predicate<PackageManagerType> adopts) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        Map<String, PackageCatalogEntry> brewPackages = brewPackagesByToken(rows);
        Map<InstalledProgram, SoftwareResponse> rowByProgram = new IdentityHashMap<>();
        rows.forEach(row -> rowByProgram.put(programOf(row), row));
        List<InstalledProgram> programs = List.copyOf(rowByProgram.keySet());
        Map<InstalledProgram, PackageMatch> matches = packageMatcher.match(programs);
        Map<InstalledProgram, PackageMatch> adoptionMatches = packageMatcher.matchForAdoption(programs);
        rowByProgram.forEach((program, row) -> {
            PackageMatch match = matches.get(program);
            PackageCatalogEntry managing = entryOf(match, manages);
            PackageCatalogEntry adoption = entryOf(adoptionMatches.get(program), adopts);
            apply(row, brewPackages, match, managing, adoption);
        });
    }

    private static PackageCatalogEntry entryOf(PackageMatch match, Predicate<PackageManagerType> counts) {
        if (match == null || !match.isMatched()) {
            return null;
        }
        PackageCatalogEntry entry = match.getEntry();
        return counts.test(entry.getManager()) ? entry : null;
    }

    static InstalledProgram programOf(SoftwareResponse row) {
        return InstalledProgram.builder()
                .fleetSource(row.getFleetSource())
                .name(row.getName())
                .publisher(row.getPublisher())
                .upgradeCode(row.getUpgradeCode())
                .productCodes(row.getProductCodes() == null ? List.of() : row.getProductCodes())
                .packageFamilyNames(row.getPackageFamilyNames() == null ? List.of() : row.getPackageFamilyNames())
                .systemComponent(Boolean.TRUE.equals(row.getSystemComponent()))
                .bundleIdentifier(row.getBundleIdentifier())
                .appFileNames(row.getAppFileNames() == null ? List.of() : row.getAppFileNames())
                .topLevelApp(row.getTopLevelApp())
                .storedMatch(row.getPackageMatch())
                .storedAdoptionMatch(row.getAdoptionMatch())
                .build();
    }

    private static void apply(SoftwareResponse row, Map<String, PackageCatalogEntry> brewPackages, PackageMatch match,
                              PackageCatalogEntry managing, PackageCatalogEntry adoption) {
        if (isBrewPackage(row)) {
            applyBrewPackage(row, brewPackages);
        } else if (managing != null) {
            applyManagingPackage(row, managing);
        } else if (adoption != null) {
            applyAdoptionPackage(row, adoption);
        } else {
            applyNoPackage(row, match);
        }
    }

    private static void applyBrewPackage(SoftwareResponse row, Map<String, PackageCatalogEntry> brewPackages) {
        String token = brewTokenOf(row);
        PackageCatalogEntry entry = token == null ? null : brewPackages.get(token);
        String latest = entry == null ? null : brewVersionOf(entry);
        applyLatest(row, latest);
        row.setManagingPackage(entry);
        if (row.getAutoUpdate() == null) {
            row.setAutoUpdate(entry != null ? SoftwareAutoUpdateStatus.OFF : SoftwareAutoUpdateStatus.NO_PACKAGE);
        }
    }

    // winget updates a program it matches whoever installed it, so a match alone makes the program manageable
    private static void applyManagingPackage(SoftwareResponse row, PackageCatalogEntry entry) {
        String latest = versionOf(entry);
        applyLatest(row, latest);
        SoftwareSource source = SOURCE_BY_MANAGER.get(entry.getManager());
        row.setSource(source);
        row.setManagingPackage(entry);
        if (row.getAutoUpdate() == null) {
            row.setAutoUpdate(SoftwareAutoUpdateStatus.OFF);
        }
    }

    // the package's manager updates only what it installed: nothing manages the program until it is adopted
    private static void applyAdoptionPackage(SoftwareResponse row, PackageCatalogEntry entry) {
        String latest = versionOf(entry);
        applyLatest(row, latest);
        SoftwareBundlePackage adoptionPackage = SoftwareBundlePackage.builder()
                .packageManager(entry.getManager())
                .packageName(entry.getPackageId())
                .brewPackageType(entry.getBrewType())
                .version(latest)
                .build();
        row.setAdoptionPackage(adoptionPackage);
        if (row.getAutoUpdate() == null) {
            row.setAutoUpdate(SoftwareAutoUpdateStatus.NEEDS_ADOPTION);
        }
    }

    // a package whose manager does not count here still tells the latest version; several packages leave it unknown
    private static void applyNoPackage(SoftwareResponse row, PackageMatch match) {
        boolean matched = match != null && match.isMatched();
        String latest = matched ? versionOf(match.getEntry()) : null;
        applyLatest(row, latest);
        boolean noPackage = match != null && (matched || match.hasNoPackage());
        if (row.getAutoUpdate() == null && noPackage) {
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
        return hasText(entry.getDisplayVersion()) ? entry.getDisplayVersion() : entry.getVersion();
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
