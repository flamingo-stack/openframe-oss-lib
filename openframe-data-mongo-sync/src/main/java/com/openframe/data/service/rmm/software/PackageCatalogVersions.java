package com.openframe.data.service.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.stream.Stream;

import static org.springframework.util.StringUtils.hasText;

@Component
@RequiredArgsConstructor
public class PackageCatalogVersions {

    private static final String CASK_BUILD_SEPARATOR = ",";
    private static final String UNVERSIONED_CASK = "latest";

    private final PackageCatalogRepository catalogRepository;

    // false for a package the catalog does not carry
    public boolean hasLatest(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return versions(manager, packageId, brewType).findAny().isPresent();
    }

    public String latest(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return versions(manager, packageId, brewType).findFirst()
                .orElseThrow(() -> new IllegalStateException("No catalog version of " + manager + "/" + packageId));
    }

    // false as well for a cask the catalog carries only as "latest"
    public boolean hasShownLatest(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return shownVersions(manager, packageId, brewType).findAny().isPresent();
    }

    public String shownLatest(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return shownVersions(manager, packageId, brewType).findFirst()
                .orElseThrow(() -> new IllegalStateException("No catalog version to show of " + manager + "/" + packageId));
    }

    // the version a screen shows and an installed one is compared with: latest() stays the raw catalog value
    public static String shownVersionOf(PackageCatalogEntry entry) {
        return entry.getManager() == PackageManagerType.BREW ? brewVersionOf(entry) : displayVersionOf(entry);
    }

    private Stream<String> versions(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return entries(manager, packageId, brewType)
                .map(PackageCatalogEntry::getVersion)
                .filter(Objects::nonNull);
    }

    private Stream<String> shownVersions(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return entries(manager, packageId, brewType)
                .map(PackageCatalogVersions::shownVersionOf)
                .filter(Objects::nonNull);
    }

    // A brew formula and cask can share a token, so the brew type picks between them.
    private Stream<PackageCatalogEntry> entries(PackageManagerType manager, String packageId, BrewPackageType brewType) {
        return catalogRepository.findByManagerAndPackageIdIgnoreCase(manager, packageId).stream()
                .filter(entry -> manager != PackageManagerType.BREW || brewType == null || brewType == entry.getBrewType());
    }

    private static String displayVersionOf(PackageCatalogEntry entry) {
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
}
