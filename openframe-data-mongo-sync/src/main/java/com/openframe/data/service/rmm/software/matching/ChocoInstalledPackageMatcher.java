package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

import static java.util.stream.Collectors.toMap;

@Component
@ConditionalOnProperty(name = "openframe.package-managers.choco-enabled", havingValue = "true")
@RequiredArgsConstructor
public class ChocoInstalledPackageMatcher implements PackageMatcher {

    private final PackageCatalogRepository catalogRepository;

    @Override
    public FleetSource getFleetSource() {
        return FleetSource.CHOCOLATEY_PACKAGES;
    }

    @Override
    public boolean isForAdoption() {
        return false;
    }

    @Override
    public List<PackageMatch> match(List<InstalledProgram> programs) {
        if (programs.stream().map(InstalledProgram::getName).allMatch(Objects::isNull)) {
            return programs.stream().map(program -> PackageMatch.noPackage()).toList();
        }
        List<PackageCatalogEntry> catalog = catalogRepository.findByManager(PackageManagerType.CHOCO);
        Map<String, PackageCatalogEntry> entriesById = catalog.stream()
                .collect(toMap(entry -> lowerCase(entry.getPackageId()), Function.identity(), (first, second) -> first));
        return programs.stream()
                .map(program -> matchOf(program.getName(), entriesById))
                .toList();
    }

    private static PackageMatch matchOf(String name, Map<String, PackageCatalogEntry> entriesById) {
        PackageCatalogEntry entry = name == null ? null : entriesById.get(lowerCase(name));
        return entry == null ? PackageMatch.noPackage() : PackageMatch.of(entry);
    }

    private static String lowerCase(String packageId) {
        return packageId.toLowerCase(Locale.ROOT);
    }
}
