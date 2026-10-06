package com.openframe.api.service.packagesearch;

import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.dto.packagesearch.PackageVersion;
import com.openframe.api.exception.PackageNotFoundException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogPage;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BrewPackageClient implements PackageManagerClient {

    private static final Sort MOST_POPULAR_FIRST = Sort.by(Sort.Order.desc("popularity"), Sort.Order.asc("packageId"));

    private final PackageCatalogRepository packageCatalogRepository;

    @Override
    public PackageManagerType getPackageManagerType() {
        return PackageManagerType.BREW;
    }

    @Override
    public PackageSearchResult search(String query, int limit, int offset) {
        PackageCatalogPage page = packageCatalogRepository.searchByName(PackageManagerType.BREW, query, MOST_POPULAR_FIRST, offset, limit);
        List<PackageSearchItem> items = page.getEntries().stream()
                .map(this::toItem)
                .toList();
        int total = (int) page.getTotal();
        boolean hasMore = offset + limit < total;
        return PackageSearchResult.builder()
                .items(items)
                .total(total)
                .hasMore(hasMore)
                .build();
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
