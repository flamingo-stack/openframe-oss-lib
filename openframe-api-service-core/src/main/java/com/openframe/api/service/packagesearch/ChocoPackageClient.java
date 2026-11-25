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
public class ChocoPackageClient implements PackageManagerClient {

    private final PackageCatalogRepository packageCatalogRepository;

    @Override
    public PackageManagerType getPackageManagerType() {
        return PackageManagerType.CHOCO;
    }

    @Override
    public PackageSearchResult search(String query, String afterCursor, int limit) {
        PackageCatalogPage page = packageCatalogRepository.searchByName(
                PackageManagerType.CHOCO, query, PackageCatalogOrder.BY_NAME, afterCursor, limit);
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
        PackageCatalogEntry entry = findEntry(packageId);
        String id = entry.getPackageId();
        String installCommand = installCommand(id);
        PackageVersion version = PackageVersion.builder().version(entry.getVersion()).build();
        return PackageDetails.builder()
                .id(id)
                .packageManager(PackageManagerType.CHOCO)
                .name(entry.getName())
                .description(entry.getDescription())
                .homepage(entry.getHomepage())
                .installCommand(installCommand)
                .tags(List.of())
                .versions(List.of(version))
                .build();
    }

    private PackageCatalogEntry findEntry(String packageId) {
        List<PackageCatalogEntry> found =
                packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(PackageManagerType.CHOCO, packageId);
        if (found.isEmpty()) {
            throw new PackageNotFoundException(packageId);
        }
        return found.getFirst();
    }

    private PackageSearchItem toItem(PackageCatalogEntry entry) {
        String id = entry.getPackageId();
        String installCommand = installCommand(id);
        return PackageSearchItem.builder()
                .id(id)
                .name(entry.getName())
                .description(entry.getDescription())
                .version(entry.getVersion())
                .homepage(entry.getHomepage())
                .installCommand(installCommand)
                .packageManager(PackageManagerType.CHOCO)
                .build();
    }

    private static String installCommand(String packageId) {
        return "choco install " + packageId;
    }
}
