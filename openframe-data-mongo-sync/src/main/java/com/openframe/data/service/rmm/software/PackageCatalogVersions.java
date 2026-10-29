package com.openframe.data.service.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class PackageCatalogVersions {

    private final PackageCatalogRepository catalogRepository;

    // Latest released version; empty for a package the catalog does not carry (Chocolatey is not in it).
    // A brew formula and cask can share a token, so the brew type picks between them.
    public Optional<String> latest(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return catalogRepository.findByManagerAndPackageIdIgnoreCase(manager, packageId).stream()
                .filter(entry -> manager != PackageManagerType.BREW || brewType == null || brewType == entry.getBrewType())
                .map(PackageCatalogEntry::getVersion)
                .filter(Objects::nonNull)
                .findFirst();
    }
}
