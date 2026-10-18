package com.openframe.api.service.packagesearch;

import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.api.dto.packagesearch.PackageSearchHit;
import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.dto.packagesearch.PackageVersion;
import com.openframe.api.exception.PackageNotFoundException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogHit;
import com.openframe.data.repository.packagesearch.PackageCatalogOrder;
import com.openframe.data.repository.packagesearch.PackageCatalogPage;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BrewPackageClient implements PackageManagerClient {

    private final PackageCatalogRepository packageCatalogRepository;

    @Override
    public PackageManagerType getPackageManagerType() {
        return PackageManagerType.BREW;
    }

    @Override
    public PackageSearchResult search(String query, String afterCursor, int limit) {
        PackageCatalogPage page = packageCatalogRepository.searchByName(
                PackageManagerType.BREW, query, PackageCatalogOrder.MOST_POPULAR_FIRST, afterCursor, limit);
        List<PackageSearchHit> hits = page.getHits().stream()
                .map(this::toHit)
                .toList();
        int total = (int) page.getTotal();
        return PackageSearchResult.builder()
                .hits(hits)
                .total(total)
                .hasMore(page.isHasMore())
                .build();
    }

    private PackageSearchHit toHit(PackageCatalogHit hit) {
        PackageSearchItem item = toItem(hit.getEntry());
        return new PackageSearchHit(item, hit.getCursor());
    }

    @Override
    public PackageDetails findPackage(String packageId, BrewPackageType packageType) {
        PackageCatalogEntry entry = findEntry(packageId, packageType);
        String installCommand = installCommand(entry);
        List<PackageVersion> versions = versionsOf(entry);
        return PackageDetails.builder()
                .id(entry.getPackageId())
                .packageManager(PackageManagerType.BREW)
                .name(entry.getName())
                .description(entry.getDescription())
                .homepage(entry.getHomepage())
                .license(entry.getLicense())
                .installCommand(installCommand)
                .packageType(entry.getBrewType())
                .popularity(entry.getPopularity())
                .tags(List.of())
                .versions(versions)
                .build();
    }

    private PackageSearchItem toItem(PackageCatalogEntry entry) {
        String installCommand = installCommand(entry);
        return PackageSearchItem.builder()
                .id(entry.getPackageId())
                .name(entry.getName())
                .description(entry.getDescription())
                .version(entry.getVersion())
                .homepage(entry.getHomepage())
                .installCommand(installCommand)
                .packageType(entry.getBrewType())
                .popularity(entry.getPopularity())
                .packageManager(PackageManagerType.BREW)
                .build();
    }

    private PackageCatalogEntry findEntry(String packageId, BrewPackageType packageType) {
        List<PackageCatalogEntry> found = packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.BREW, packageId);
        for (BrewPackageType candidateType : lookupOrder(packageType)) {
            for (PackageCatalogEntry entry : found) {
                if (candidateType == entry.getBrewType()) {
                    return entry;
                }
            }
        }
        throw new PackageNotFoundException(packageId);
    }

    private static List<BrewPackageType> lookupOrder(BrewPackageType requested) {
        if (requested != null) {
            return List.of(requested);
        }
        return List.of(BrewPackageType.FORMULA, BrewPackageType.CASK);
    }

    private static List<PackageVersion> versionsOf(PackageCatalogEntry entry) {
        String version = entry.getVersion();
        if (version == null) {
            return List.of();
        }
        PackageVersion current = PackageVersion.builder().version(version).build();
        return List.of(current);
    }

    private static String installCommand(PackageCatalogEntry entry) {
        String id = entry.getPackageId();
        return entry.getBrewType() == BrewPackageType.CASK ? "brew install --cask " + id : "brew install " + id;
    }
}
