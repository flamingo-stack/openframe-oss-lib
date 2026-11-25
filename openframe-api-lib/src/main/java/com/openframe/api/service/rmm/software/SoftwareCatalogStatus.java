package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareVersionStatus;
import com.openframe.data.service.rmm.software.PackageCatalogVersions;
import com.openframe.data.service.rmm.software.matching.InstalledProgram;
import com.openframe.data.service.rmm.software.matching.PackageMatch;
import com.openframe.data.service.rmm.software.matching.SoftwarePackageMatcher;
import com.openframe.core.util.SoftwareVersions;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.nats.delivery.PackageAdoptReach;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.software.ChocoPackageOwnership;
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
import java.util.Set;
import java.util.function.Predicate;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toSet;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareCatalogStatus {

    private static final Map<PackageManagerType, SoftwareSource> SOURCE_BY_MANAGER =
            Map.of(PackageManagerType.WINGET, SoftwareSource.WINGET,
                    PackageManagerType.CHOCO, SoftwareSource.CHOCOLATEY);

    private final PackageCatalogRepository catalogRepository;
    private final SoftwarePackageMatcher packageMatcher;
    private final PackageManagerAvailability packageManagerAvailability;
    private final PackageAdoptReach packageAdoptReach;
    private final MachineRepository machineRepository;
    private final TenantIdProvider tenantIdProvider;
    private final ChocoPackageOwnership chocoPackageOwnership;

    // Runs after SoftwareAutoUpdateService: a policy's ON / OFF stays, a row without one gets what the catalog allows.
    public void apply(List<SoftwareResponse> rows) {
        apply(rows, entry -> true, entry -> packageManagerAvailability.isAdoptionOffered(entry.getManager()),
                Set.of());
    }

    // a manager counts on a device only where it runs: there winget's package gives way to the one to adopt into
    public void applyOnDevice(String machineId, List<SoftwareResponse> rows, Set<String> installedCasks) {
        String tenantId = tenantIdProvider.getTenantId();
        machineRepository.findByTenantIdAndMachineId(tenantId, machineId)
                .ifPresentOrElse(device -> applyOn(device, rows, installedCasks), () -> apply(rows));
    }

    private void applyOn(Machine device, List<SoftwareResponse> rows, Set<String> installedCasks) {
        String machineId = device.getMachineId();
        boolean reachable = packageAdoptReach.isReachable(machineId);
        apply(rows, entry -> managesOn(device, entry),
                entry -> reachable && packageManagerAvailability.isAdoptableOn(device, entry.getManager()),
                installedCasks);
    }

    private boolean managesOn(Machine device, PackageCatalogEntry entry) {
        PackageManagerType manager = entry.getManager();
        if (manager == PackageManagerType.CHOCO) {
            return chocoPackageOwnership.owns(device, entry.getPackageId());
        }
        return PackageManagerAvailability.isPresentOn(device, manager);
    }

    private void apply(List<SoftwareResponse> rows, Predicate<PackageCatalogEntry> manages,
                       Predicate<PackageCatalogEntry> adopts, Set<String> installedCasks) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        Map<String, List<PackageCatalogEntry>> brewPackages = brewPackagesByToken(rows);
        Map<InstalledProgram, SoftwareResponse> rowByProgram = new IdentityHashMap<>();
        rows.forEach(row -> rowByProgram.put(programOf(row), row));
        List<InstalledProgram> programs = List.copyOf(rowByProgram.keySet());
        Map<InstalledProgram, PackageMatch> matches = packageMatcher.match(programs);
        Map<InstalledProgram, PackageMatch> adoptionMatches = packageMatcher.matchForAdoption(programs);
        for (Map.Entry<InstalledProgram, SoftwareResponse> rowOfProgram : rowByProgram.entrySet()) {
            InstalledProgram program = rowOfProgram.getKey();
            SoftwareResponse row = rowOfProgram.getValue();
            PackageMatch match = matches.get(program);
            PackageMatch adoptionMatch = adoptionMatches.get(program);
            PackageCatalogEntry managing = entryOf(match, manages);
            PackageCatalogEntry installedCask = installedCaskOf(adoptionMatch, installedCasks);
            // brew installs a cask into /Applications: adopting a copy kept only in the user's folder leaves two
            PackageCatalogEntry adoption = Boolean.TRUE.equals(row.getUserApplicationsOnly())
                    ? null : entryOf(adoptionMatch, adopts);
            // a Mac app is taken by no managing matcher: what is known about its package is the adoption match
            PackageMatch known = match != null ? match : adoptionMatch;
            apply(row, brewPackages, known, managing, installedCask, adoption);
        }
    }

    private static PackageCatalogEntry entryOf(PackageMatch match, Predicate<PackageCatalogEntry> counts) {
        if (match == null || !match.isMatched()) {
            return null;
        }
        PackageCatalogEntry entry = match.getEntry();
        return counts.test(entry) ? entry : null;
    }

    // Fleet reports a cask's app twice, under apps and under homebrew_casks: where brew installed that very cask,
    // the apps row is brew's too and adopting it would reinstall what brew already manages
    private static PackageCatalogEntry installedCaskOf(PackageMatch adoptionMatch, Set<String> installedCasks) {
        PackageCatalogEntry entry = entryOf(adoptionMatch, SoftwareCatalogStatus::isBrew);
        if (entry == null || entry.getBrewType() != BrewPackageType.CASK || entry.getPackageId() == null) {
            return null;
        }
        String token = entry.getPackageId().toLowerCase(Locale.ROOT);
        return installedCasks.contains(token) ? entry : null;
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

    private static void apply(SoftwareResponse row, Map<String, List<PackageCatalogEntry>> brewPackages,
                              PackageMatch match, PackageCatalogEntry managing, PackageCatalogEntry installedCask,
                              PackageCatalogEntry adoption) {
        if (isBrewPackage(row)) {
            applyBrewPackage(row, brewPackages);
        } else if (managing != null) {
            applyManagingPackage(row, managing);
        } else if (installedCask != null) {
            applyInstalledCask(row, installedCask);
        } else if (adoption != null) {
            applyAdoptionPackage(row, adoption);
        } else {
            applyNoPackage(row, match);
        }
    }

    private static void applyBrewPackage(SoftwareResponse row, Map<String, List<PackageCatalogEntry>> brewPackages) {
        PackageCatalogEntry entry = brewEntryOf(row, brewPackages);
        String latest = entry == null ? null : PackageCatalogVersions.shownVersionOf(entry);
        applyLatest(row, latest);
        row.setManagingPackage(entry);
        if (row.getAutoUpdate() == null) {
            row.setAutoUpdate(entry != null ? SoftwareAutoUpdateStatus.OFF : SoftwareAutoUpdateStatus.NO_PACKAGE);
        }
    }

    // winget updates a program it matches whoever installed it, so a match alone makes the program manageable
    private static void applyManagingPackage(SoftwareResponse row, PackageCatalogEntry entry) {
        String latest = PackageCatalogVersions.shownVersionOf(entry);
        applyLatest(row, latest);
        SoftwareSource source = SOURCE_BY_MANAGER.get(entry.getManager());
        row.setSource(source);
        row.setManagingPackage(entry);
        if (row.getAutoUpdate() == null) {
            row.setAutoUpdate(SoftwareAutoUpdateStatus.OFF);
        }
    }

    private static void applyInstalledCask(SoftwareResponse row, PackageCatalogEntry cask) {
        String latest = PackageCatalogVersions.shownVersionOf(cask);
        applyLatest(row, latest);
        row.setSource(SoftwareSource.BREW);
        if (row.getAutoUpdate() == null) {
            row.setAutoUpdate(SoftwareAutoUpdateStatus.OFF);
        }
    }

    // the package's manager updates only what it installed: nothing manages the program until it is adopted
    private static void applyAdoptionPackage(SoftwareResponse row, PackageCatalogEntry entry) {
        String latest = PackageCatalogVersions.shownVersionOf(entry);
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
        String latest = matched ? PackageCatalogVersions.shownVersionOf(match.getEntry()) : null;
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

    private static SoftwareVersionStatus versionStatus(SoftwareResponse row, String catalogLatest) {
        String installed = row.getCurrentVersion();
        if (catalogLatest == null || installed == null) {
            return SoftwareVersionStatus.UNKNOWN;
        }
        return SoftwareVersions.compare(installed, catalogLatest) >= 0
                ? SoftwareVersionStatus.UP_TO_DATE : SoftwareVersionStatus.OUTDATED;
    }

    // a formula and a cask can share a token: the type brew reported the title under decides
    private static PackageCatalogEntry brewEntryOf(SoftwareResponse row,
                                                   Map<String, List<PackageCatalogEntry>> brewPackages) {
        String token = brewTokenOf(row);
        List<PackageCatalogEntry> entries = token == null ? null : brewPackages.get(token);
        if (entries == null) {
            return null;
        }
        boolean cask = row.getFleetSource() == FleetSource.HOMEBREW_CASKS;
        BrewPackageType reportedType = cask ? BrewPackageType.CASK : BrewPackageType.FORMULA;
        Comparator<PackageCatalogEntry> reportedTypeFirst =
                Comparator.comparing(entry -> entry.getBrewType() != reportedType);
        return entries.stream().min(reportedTypeFirst).orElseThrow();
    }

    private Map<String, List<PackageCatalogEntry>> brewPackagesByToken(List<SoftwareResponse> rows) {
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
                .collect(groupingBy(entry -> entry.getPackageId().toLowerCase(Locale.ROOT)));
    }

    private static boolean isBrew(PackageCatalogEntry entry) {
        return entry.getManager() == PackageManagerType.BREW;
    }

    private static boolean isBrewPackage(SoftwareResponse row) {
        return row.getSource() == SoftwareSource.BREW;
    }

    private static String brewTokenOf(SoftwareResponse row) {
        return row.getName() == null ? null : row.getName().toLowerCase(Locale.ROOT);
    }
}
