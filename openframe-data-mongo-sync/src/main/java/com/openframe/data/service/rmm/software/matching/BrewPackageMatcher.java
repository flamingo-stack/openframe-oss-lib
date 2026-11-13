package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toSet;

// brew reports a program it installed under the package's own token, so the token alone finds the package
@Component
@RequiredArgsConstructor
public class BrewPackageMatcher implements PackageMatcher {

    private static final Comparator<PackageCatalogEntry> FORMULA_FIRST =
            Comparator.comparing(entry -> entry.getBrewType() != BrewPackageType.FORMULA);

    private final PackageCatalogRepository catalogRepository;

    @Override
    public PackageManagerType getManager() {
        return PackageManagerType.BREW;
    }

    @Override
    public List<PackageMatch> match(List<InstalledProgram> programs) {
        Set<String> tokens = programs.stream()
                .map(BrewPackageMatcher::tokenOf)
                .filter(Objects::nonNull)
                .collect(toSet());
        if (tokens.isEmpty()) {
            return programs.stream().map(program -> PackageMatch.noPackage()).toList();
        }
        Map<String, List<PackageCatalogEntry>> entriesByToken = catalogRepository
                .findByManagerAndPackageIdIn(PackageManagerType.BREW, tokens).stream()
                .filter(entry -> entry.getPackageId() != null && entry.getVersion() != null)
                .collect(groupingBy(entry -> entry.getPackageId().toLowerCase(Locale.ROOT)));
        return programs.stream()
                .map(BrewPackageMatcher::tokenOf)
                .map(token -> matchOf(entriesByToken.get(token)))
                .toList();
    }

    private static PackageMatch matchOf(List<PackageCatalogEntry> entries) {
        if (entries == null) {
            return PackageMatch.noPackage();
        }
        PackageCatalogEntry entry = entries.stream().min(FORMULA_FIRST).orElseThrow();
        return PackageMatch.of(entry);
    }

    private static String tokenOf(InstalledProgram program) {
        return program.getName() == null ? null : program.getName().toLowerCase(Locale.ROOT);
    }
}
