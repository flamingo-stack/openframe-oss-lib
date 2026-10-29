package com.openframe.data.service.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.stream.Stream;

@Component
@RequiredArgsConstructor
public class PackageCatalogVersions {

    private final PackageCatalogRepository catalogRepository;

    // false for a package the catalog does not carry (Chocolatey is not in it)
    public boolean hasLatest(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return versions(manager, packageId, brewType).findAny().isPresent();
    }

    public String latest(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return versions(manager, packageId, brewType).findFirst()
                .orElseThrow(() -> new IllegalStateException("No catalog version of " + manager + "/" + packageId));
    }

    // A brew formula and cask can share a token, so the brew type picks between them.
    private Stream<String> versions(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return catalogRepository.findByManagerAndPackageIdIgnoreCase(manager, packageId).stream()
                .filter(entry -> manager != PackageManagerType.BREW || brewType == null || brewType == entry.getBrewType())
                .map(PackageCatalogEntry::getVersion)
                .filter(Objects::nonNull);
    }
}
