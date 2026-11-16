package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

// winget reports a package it installed under the package's own id, so the id alone finds the package
@Component
@RequiredArgsConstructor
public class WingetInstalledPackageMatcher implements PackageMatcher {

    private final PackageCatalogRepository catalogRepository;

    @Override
    public FleetSource getFleetSource() {
        return FleetSource.WINGET_PACKAGES;
    }

    @Override
    public boolean isForAdoption() {
        return false;
    }

    @Override
    public List<PackageMatch> match(List<InstalledProgram> programs) {
        Set<String> ids = programs.stream()
                .flatMap(program -> program.getWingetIds().stream())
                .collect(toSet());
        if (ids.isEmpty()) {
            return programs.stream().map(program -> PackageMatch.noPackage()).toList();
        }
        Map<String, PackageCatalogEntry> entriesById = catalogRepository
                .findByManagerAndPackageIdIn(PackageManagerType.WINGET, ids).stream()
                .collect(toMap(PackageCatalogEntry::getPackageId, Function.identity(), (first, second) -> first));
        return programs.stream()
                .map(program -> matchOf(program.getWingetIds(), entriesById))
                .toList();
    }

    // Fleet groups devices into one title by name, so its devices can report different ids: one update order
    // would then carry the wrong id for some of them
    private static PackageMatch matchOf(List<String> ids, Map<String, PackageCatalogEntry> entriesById) {
        if (ids.size() > 1) {
            return PackageMatch.ambiguous();
        }
        PackageCatalogEntry entry = ids.isEmpty() ? null : entriesById.get(ids.getFirst());
        return entry == null ? PackageMatch.noPackage() : PackageMatch.of(entry);
    }
}
