package com.openframe.api.service.packagesearch;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.api.dto.packagesearch.PackageSearchItem;
import com.openframe.api.dto.packagesearch.PackageSearchResult;
import com.openframe.api.dto.packagesearch.PackageVersion;
import com.openframe.api.exception.PackageNotFoundException;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class BrewPackageService implements PackageManagerClient {


    private final PackageCatalogRepository packageCatalogRepository;

    @Override
    public PackageManagerType getPackageManagerType() {
        return PackageManagerType.BREW;
    }

    @Override
    public PackageSearchResult search(String query, int limit, int offset) {
        String normalizedQuery = query.trim().toLowerCase(Locale.ROOT);
        List<Scored> matched = scoreCandidates(normalizedQuery);
        List<PackageSearchItem> items = pageOf(matched, limit, offset);
        int total = matched.size();
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
        BrewPackageType entryType = typeOf(entry);
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
                .packageType(entryType)
                .popularity(entry.getPopularity())
                .tags(List.of())
                .versions(versions)
                .build();
    }

    private List<Scored> scoreCandidates(String query) {
        String managerName = PackageManagerType.BREW.name();
        List<PackageCatalogEntry> candidates = packageCatalogRepository.findByManagerAndSearchBlobContaining(managerName, query);
        return candidates.stream()
                .map(entry -> scoreEntry(query, entry))
                .filter(Scored::isMatch)
                .sorted(byRelevance())
                .toList();
    }

    private Scored scoreEntry(String query, PackageCatalogEntry entry) {
        int score = PackageMatcher.score(query, entry.getPackageId(), entry.getName(),
                entry.getAliases(), entry.getDescription());
        return new Scored(score, entry);
    }

    private static Comparator<Scored> byRelevance() {
        Comparator<Scored> byScore = Comparator.comparingInt(Scored::getScore).reversed();
        Comparator<Scored> byPopularity = Comparator.comparingInt(Scored::popularityOrZero).reversed();
        return byScore.thenComparing(byPopularity).thenComparing(Scored::entryPackageId);
    }

    private List<PackageSearchItem> pageOf(List<Scored> matched, int limit, int offset) {
        return matched.stream()
                .skip(offset)
                .limit(limit)
                .map(this::toItem)
                .toList();
    }

    private PackageSearchItem toItem(Scored scored) {
        PackageCatalogEntry entry = scored.getEntry();
        BrewPackageType entryType = typeOf(entry);
        String installCommand = installCommand(entry);
        return PackageSearchItem.builder()
                .id(entry.getPackageId())
                .name(entry.getName())
                .description(entry.getDescription())
                .version(entry.getVersion())
                .homepage(entry.getHomepage())
                .installCommand(installCommand)
                .packageType(entryType)
                .popularity(entry.getPopularity())
                .packageManager(PackageManagerType.BREW)
                .build();
    }

    private PackageCatalogEntry findEntry(String packageId, BrewPackageType packageType) {
        String managerName = PackageManagerType.BREW.name();
        List<PackageCatalogEntry> found = packageCatalogRepository.findByManagerAndPackageIdIgnoreCase(managerName, packageId);
        for (BrewPackageType candidateType : lookupOrder(packageType)) {
            for (PackageCatalogEntry entry : found) {
                if (candidateType.name().equals(entry.getBrewType())) {
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

    private static BrewPackageType typeOf(PackageCatalogEntry entry) {
        return BrewPackageType.valueOf(entry.getBrewType());
    }

    private static String installCommand(PackageCatalogEntry entry) {
        String id = entry.getPackageId();
        return typeOf(entry) == BrewPackageType.CASK ? "brew install --cask " + id : "brew install " + id;
    }

    @Getter
    @AllArgsConstructor
    private static final class Scored {
        private final int score;
        private final PackageCatalogEntry entry;

        private boolean isMatch() {
            return score > 0;
        }

        private int popularityOrZero() {
            Integer popularity = entry.getPopularity();
            return popularity == null ? 0 : popularity;
        }

        private String entryPackageId() {
            return entry.getPackageId();
        }
    }
}
